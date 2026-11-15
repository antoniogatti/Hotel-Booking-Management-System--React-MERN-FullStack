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
