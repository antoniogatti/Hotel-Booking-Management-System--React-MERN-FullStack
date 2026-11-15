const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET_KEY = "local-test-secret";
const User = require("../src/models/user").default;
const Hotel = require("../src/models/hotel").default;
const Booking = require("../src/models/booking").default;
const ExternalCalendarEvent = require("../src/models/external-calendar-event").default;
const PnlBookingIncome = require("../src/models/pnl-booking-income").default;
const bookingsRouter = require("../src/routes/bookings").default;
const pnlRouter = require("../src/routes/pnl").default;

const admin = new mongoose.Types.ObjectId();
const owner = new mongoose.Types.ObjectId();
const otherOwner = new mongoose.Types.ObjectId();
const hotel = new mongoose.Types.ObjectId();
const otherHotel = new mongoose.Types.ObjectId();
const ids = Object.fromEntries(["local", "unchecked", "legacy", "overridden", "imported", "self", "other", "past"]
  .map((key) => [key, new mongoose.Types.ObjectId()]));
let mongo;
let server;
let base;

test.before(async () => {
  mongo = await MongoMemoryServer.create({
    binary: process.platform === "win32" && process.arch === "arm64" ? { arch: "x64" } : {},
  });
  await mongoose.connect(mongo.getUri());
  await User.collection.insertMany([
    { _id: admin, role: "admin", email: "admin@example.test" },
    { _id: owner, role: "hotel_owner", email: "owner@example.test" },
    { _id: otherOwner, role: "hotel_owner", email: "other@example.test" },
  ]);
  await Hotel.collection.insertMany([
    { _id: hotel, userId: String(owner), name: "Owned room" },
    { _id: otherHotel, userId: String(otherOwner), name: "Other room" },
  ]);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrow = new Date(today.getTime() + 86400000);
  const yesterday = new Date(today.getTime() - 86400000);
  const local = (id, extra = {}) => ({
    _id: ids[id], hotelId: String(hotel), reservationNumber: id, firstName: id, lastName: "Guest",
    status: "confirmed", checkIn: today, checkOut: tomorrow, ...extra,
  });
  await Booking.collection.insertMany([
    local("local", { checkInInfo: { checkedInAt: now } }),
    local("unchecked"),
    local("legacy", { pnlIncome: { checkInDesk: true } }),
    local("overridden", { pnlIncome: { checkInDesk: true } }),
    local("other", { hotelId: String(otherHotel) }),
    local("past", { checkIn: yesterday, checkOut: today }),
  ]);
  const imported = (id, extra = {}) => ({
    _id: ids[id], hotelId: String(hotel), source: "booking_com", status: "active",
    externalUid: id, firstName: id, startDate: today, endDate: tomorrow, ...extra,
  });
  await ExternalCalendarEvent.collection.insertMany([
    imported("imported", { checkInInfo: { checkedInAt: now } }),
    imported("self"),
  ]);
  const record = (source, id, details) => ({
    _id: `${source}:${ids[id]}`, source, bookingId: String(ids[id]), details, updatedBy: String(admin),
  });
  await PnlBookingIncome.collection.insertMany([
    record("local", "local", { checkInDesk: true }),
    record("local", "overridden", { checkInDesk: false }),
    record("local", "other", { checkInDesk: true }),
    record("local", "past", { checkInDesk: true }),
    record("booking_com", "imported", { checkInDesk: true }),
    record("booking_com", "self", { selfCheckIn: true }),
  ]);

  const app = express();
  app.use(express.json(), cookieParser());
  app.use("/api/bookings", bookingsRouter);
  app.use("/api/pnl", pnlRouter);
  server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

const request = (path, user = owner, options = {}) => fetch(`${base}${path}`, {
  ...options,
  headers: { Authorization: `Bearer ${jwt.sign({ userId: String(user) }, process.env.JWT_SECRET_KEY)}`, ...options.headers },
});

test("desk filters both booking sources and counts by the saved marker without changing overview", async () => {
  const desk = await request("/api/bookings/dashboard/upcoming-check-ins?days=1&deskOnly=true");
  assert.equal(desk.status, 200);
  const data = await desk.json();
  assert.deepEqual(new Set(data.rows.map((row) => row._id)), new Set(["local", "legacy", "imported"].map((key) => String(ids[key]))));
  assert.equal(data.summary.arrivalsToday, 3);
  assert.equal(data.summary.inHouseToday, 2);
  assert.equal(data.summary.checkedInToday, 2);
  assert.ok(data.rows.every((row) => !("pnlIncome" in row)));

  const overview = await (await request("/api/bookings/dashboard/upcoming-check-ins?days=1")).json();
  assert.equal(overview.rows.length, 6);
  assert.equal(overview.summary.arrivalsToday, 6);
  assert.equal((await request("/api/bookings/dashboard/upcoming-check-ins?deskOnly=invalid")).status, 400);
  assert.equal((await request(`/api/bookings/dashboard/upcoming-check-ins?deskOnly=true&hotelId=${otherHotel}`)).status, 403);

  const updated = await request(`/api/pnl/bookings/booking_com/${ids.imported}`, admin, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkInDesk: false, selfCheckIn: true }),
  });
  assert.equal(updated.status, 200);
  const after = await (await request("/api/bookings/dashboard/upcoming-check-ins?days=1&deskOnly=true")).json();
  assert.deepEqual(new Set(after.rows.map((row) => row._id)), new Set(["local", "legacy"].map((key) => String(ids[key]))));
  assert.equal(after.summary.arrivalsToday, 2);
  assert.equal(after.summary.checkedInToday, 1);
  assert.equal(after.summary.inHouseToday, 1);

  const newlyMarked = await request(`/api/pnl/bookings/local/${ids.unchecked}`, admin, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkInDesk: true }),
  });
  assert.equal(newlyMarked.status, 200);
  const refreshed = await (await request("/api/bookings/dashboard/upcoming-check-ins?days=1&deskOnly=true")).json();
  assert.ok(refreshed.rows.some((row) => row._id === String(ids.unchecked)));
  assert.equal(refreshed.summary.arrivalsToday, 3);

  const past = await (await request("/api/bookings/dashboard/upcoming-check-ins?horizon=past&deskOnly=true")).json();
  assert.ok(past.rows.some((row) => row._id === String(ids.past)));
  assert.ok(!past.rows.some((row) => row._id === String(ids.overridden)));
});

test("60-day desk horizon includes marked future site and calendar arrivals, but not the next day", async () => {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const atDay = (day) => new Date(today + day * 86400000);
  const localId = new mongoose.Types.ObjectId();
  const importedId = new mongoose.Types.ObjectId();
  const outsideId = new mongoose.Types.ObjectId();
  const unmarkedId = new mongoose.Types.ObjectId();
  await Booking.collection.insertMany([
    { _id: localId, hotelId: String(hotel), reservationNumber: "future", firstName: "Future", lastName: "Guest",
      status: "confirmed", checkIn: atDay(43), checkOut: atDay(45) },
    { _id: unmarkedId, hotelId: String(hotel), reservationNumber: "unmarked-future", firstName: "Unmarked", lastName: "Guest",
      status: "confirmed", checkIn: atDay(43), checkOut: atDay(45) },
  ]);
  await ExternalCalendarEvent.collection.insertMany([
    { _id: importedId, hotelId: String(hotel), source: "booking_com", status: "active", externalUid: "future-59",
      firstName: "Calendar", startDate: atDay(59), endDate: atDay(61) },
    { _id: outsideId, hotelId: String(hotel), source: "booking_com", status: "active", externalUid: "future-60",
      firstName: "Outside", startDate: atDay(60), endDate: atDay(62) },
  ]);
  await PnlBookingIncome.collection.insertMany([
    { _id: `local:${localId}`, source: "local", bookingId: String(localId), details: { checkInDesk: true }, updatedBy: String(admin) },
    ...[importedId, outsideId].map((id) => ({ _id: `booking_com:${id}`, source: "booking_com", bookingId: String(id),
      details: { checkInDesk: true }, updatedBy: String(admin) })),
  ]);
  const short = await (await request("/api/bookings/dashboard/upcoming-check-ins?days=30&deskOnly=true")).json();
  assert.ok(!short.rows.some((row) => row._id === String(localId)));
  const response = await request("/api/bookings/dashboard/upcoming-check-ins?days=60&deskOnly=true");
  assert.equal(response.status, 200);
  const data = await response.json();
  const idsInDesk = new Set(data.rows.map((row) => row._id));
  assert.ok(idsInDesk.has(String(localId)));
  assert.ok(idsInDesk.has(String(importedId)));
  assert.ok(!idsInDesk.has(String(outsideId)));
  assert.ok(!idsInDesk.has(String(unmarkedId)));
});

test("check-in reads Income details with access checks and safely saves notes for both sources", async () => {
  const localId = new mongoose.Types.ObjectId();
  const importedId = new mongoose.Types.ObjectId();
  const start = new Date("2026-03-01T00:00:00Z");
  const end = new Date("2026-03-03T00:00:00Z");
  await Booking.collection.insertOne({
    _id: localId, hotelId: String(hotel), reservationNumber: "ORIGINAL",
    firstName: "Original", lastName: "Guest", email: "original@example.test", phone: "111",
    adultCount: 2, childCount: 0, totalCost: 100, checkIn: start, checkOut: end, status: "confirmed",
    pnlIncome: { bookingGuestName: "Legacy Name", notes: "Legacy note", checkInDesk: true },
  });
  await ExternalCalendarEvent.collection.insertOne({
    _id: importedId, hotelId: String(hotel), source: "booking_com", status: "active",
    externalUid: "ICAL", firstName: "Original", lastName: "Guest", email: "original@example.test", phone: "111", adultCount: 2, childCount: 0,
    startDate: start, endDate: end, totalCost: 125, currency: "USD", specialRequests: "Original request",
    nationality: "Italian", checkInInfo: { arrivalTime: "16:00" },
    excelSync: { city: "Paris", country: "France", paymentVia: "Cash" },
  });
  await PnlBookingIncome.collection.insertOne({
    _id: `booking_com:${importedId}`, source: "booking_com", bookingId: String(importedId), updatedBy: String(admin),
    details: { bookingGuestName: "Income Name", bookingReference: "INCOME-REF", bookingPhone: "222",
      bookingEmail: "income@example.test", guestCount: 3, grossAmountCents: 22000, notes: "Income note", arrivalTime: "14:30", checkInDesk: true },
  });

  const legacy = await (await request(`/api/bookings/${localId}?includeIncome=true`)).json();
  assert.equal(legacy.checkInIncome.guestName, "Legacy Name");
  assert.equal(legacy.checkInIncome.notes, "Legacy note");
  assert.equal(legacy.checkInIncome.amountCents, 10000);
  assert.equal(legacy.checkInIncome.guestCount, 2);
  assert.equal(legacy.checkInIncome.email, "original@example.test");
  assert.equal("pnlIncome" in legacy, false);
  const normal = await (await request(`/api/bookings/${localId}`)).json();
  assert.equal("checkInIncome" in normal, false);

  const imported = await (await request(`/api/bookings/${importedId}?includeIncome=true`)).json();
  assert.deepEqual(imported.checkInIncome, {
    reference: "INCOME-REF", guestName: "Income Name", phone: "222", email: "income@example.test",
    city: "Paris", country: "France", guestCount: 3, amountCents: 22000,
    currency: "EUR", paymentMethod: "Cash", notes: "Income note", arrivalTime: "14:30",
    arrivalTimeOverride: "14:30", nationality: "Italian", bookingChannel: "Booking.com",
  });
  assert.equal((await request(`/api/bookings/${importedId}?includeIncome=true`, otherOwner)).status, 403);
  assert.equal((await request(`/api/bookings/${importedId}/check-in-notes`, otherOwner, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: "No", expectedNotes: "Income note" }),
  })).status, 403);

  const saveNotes = (id, notes, expectedNotes) => request(`/api/bookings/${id}/check-in-notes`, owner, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes, expectedNotes }),
  });
  assert.equal((await saveNotes(localId, "New legacy note", "Legacy note")).status, 200);
  const legacyRecord = await PnlBookingIncome.findById(`local:${localId}`).lean();
  assert.equal(legacyRecord.details.bookingGuestName, "Legacy Name");
  assert.equal(legacyRecord.details.checkInDesk, true);
  assert.equal(legacyRecord.details.notes, "New legacy note");
  assert.equal((await (await request(`/api/bookings/${localId}?includeIncome=true`)).json()).checkInIncome.notes, "New legacy note");
  const siteTimeSave = await request(`/api/pnl/bookings/local/${localId}`, admin, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...legacyRecord.details, arrivalTime: "13:00", expectedNotes: "New legacy note", expectedArrivalTime: "" }),
  });
  assert.equal(siteTimeSave.status, 200);
  assert.equal((await (await request(`/api/bookings/${localId}?includeIncome=true`)).json()).checkInIncome.arrivalTime, "13:00");
  const siteCheckInTime = await request(`/api/bookings/${localId}/check-in-notes`, owner, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes: "New legacy note", expectedNotes: "New legacy note", arrivalTime: "14:00", expectedArrivalTime: "13:00" }),
  });
  assert.equal(siteCheckInTime.status, 200);
  assert.equal((await PnlBookingIncome.findById(`local:${localId}`).lean()).details.arrivalTime, "14:00");
  assert.equal((await saveNotes(importedId, "Updated Income note", "Income note")).status, 200);
  assert.equal((await saveNotes(importedId, "Stale edit", "Income note")).status, 409);
  const blankId = new mongoose.Types.ObjectId();
  await ExternalCalendarEvent.collection.insertOne({
    _id: blankId, hotelId: String(hotel), source: "booking_com", status: "active",
    externalUid: "BLANK", startDate: start, endDate: end,
  });
  await PnlBookingIncome.collection.insertOne({
    _id: `booking_com:${blankId}`, source: "booking_com", bookingId: String(blankId), updatedBy: String(admin), details: { checkInDesk: true },
  });
  assert.equal((await saveNotes(blankId, "First note", "")).status, 200);
  assert.equal((await PnlBookingIncome.findById(`booking_com:${blankId}`).lean()).details.checkInDesk, true);
  const unavailable = (await (await request(`/api/bookings/${blankId}?includeIncome=true`)).json()).checkInIncome;
  assert.equal(unavailable.amountCents, null);
  assert.equal(unavailable.guestCount, null);
  assert.equal(unavailable.currency, "");
  const stored = await PnlBookingIncome.findById(`booking_com:${importedId}`).lean();
  assert.equal(stored.details.guestCount, 3);
  assert.equal(stored.details.checkInDesk, true);
  assert.equal(stored.details.notes, "Updated Income note");

  const staleGrid = await request(`/api/pnl/bookings/booking_com/${importedId}`, admin, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes: "Income note", guestCount: 4, expectedNotes: "Income note" }),
  });
  assert.equal(staleGrid.status, 409);
  assert.equal((await PnlBookingIncome.findById(`booking_com:${importedId}`).lean()).details.notes, "Updated Income note");
  const currentGrid = await request(`/api/pnl/bookings/booking_com/${importedId}`, admin, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...stored.details, guestCount: 4, expectedNotes: "Updated Income note", expectedArrivalTime: "14:30" }),
  });
  assert.equal(currentGrid.status, 200);
  assert.equal((await PnlBookingIncome.findById(`booking_com:${importedId}`).lean()).details.notes, "Updated Income note");
  const saveArrival = (arrivalTime, expectedArrivalTime) => request(`/api/bookings/${importedId}/check-in-notes`, owner, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes: "Updated Income note", expectedNotes: "Updated Income note", arrivalTime, expectedArrivalTime }),
  });
  assert.equal((await saveArrival("25:00", "14:30")).status, 400);
  assert.equal((await saveArrival("15:45", "14:30")).status, 200);
  assert.equal((await saveArrival("18:00", "14:30")).status, 409);
  const staleArrivalGrid = await request(`/api/pnl/bookings/booking_com/${importedId}`, admin, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...stored.details, expectedNotes: "Updated Income note", expectedArrivalTime: "14:30" }),
  });
  assert.equal(staleArrivalGrid.status, 409);
  const incomeRows = (await (await request("/api/pnl/bookings?year=2026", admin)).json()).bookings;
  assert.equal(incomeRows.find((row) => row.id === String(importedId)).arrivalTime, "15:45");
  assert.equal((await (await request(`/api/bookings/${importedId}?includeIncome=true`)).json()).checkInIncome.arrivalTime, "15:45");
  assert.equal((await saveArrival("", "15:45")).status, 200);
  assert.equal((await (await request(`/api/bookings/${importedId}?includeIncome=true`)).json()).checkInIncome.arrivalTime, "16:00");

  const newGridId = new mongoose.Types.ObjectId();
  await Booking.collection.insertOne({
    _id: newGridId, hotelId: String(hotel), firstName: "Grid", lastName: "Guest", status: "confirmed",
    checkIn: start, checkOut: end, pnlIncome: { notes: "Legacy", checkInDesk: true },
  });
  const newGridSave = await request(`/api/pnl/bookings/local/${newGridId}`, admin, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes: "Legacy", checkInDesk: true, guestCount: 2, expectedNotes: "Legacy" }),
  });
  assert.equal(newGridSave.status, 200);
  assert.equal((await PnlBookingIncome.findById(`local:${newGridId}`).lean()).details.checkInDesk, true);

  const form = new FormData();
  for (const [key, value] of Object.entries({ firstName: "Income", lastName: "Name", adultCount: "2", childCount: "1" })) {
    form.append(key, value);
  }
  const checkedIn = await request(`/api/bookings/${importedId}/check-in`, owner, { method: "POST", body: form });
  assert.equal(checkedIn.status, 200);
  const checkedInEvent = await ExternalCalendarEvent.findById(importedId).lean();
  assert.equal(checkedInEvent.specialRequests, "Original request");
  assert.equal(checkedInEvent.email, "original@example.test");
  assert.equal(checkedInEvent.phone, "111");
  assert.equal((await PnlBookingIncome.findById(`booking_com:${importedId}`).lean()).details.notes, "Updated Income note");
  form.set("email", "changed@example.test");
  assert.equal((await request(`/api/bookings/${importedId}/check-in`, owner, { method: "POST", body: form })).status, 200);
  assert.equal((await ExternalCalendarEvent.findById(importedId).lean()).email, "changed@example.test");
});
