const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET_KEY = "local-test-secret";
const User = require("../src/models/user").default;
const ExternalCalendarEvent = require("../src/models/external-calendar-event").default;
const Booking = require("../src/models/booking").default;
const PnlBookingIncome = require("../src/models/pnl-booking-income").default;
const router = require("../src/routes/pnl").default;

const admin = "507f1f77bcf86cd799439011";
const roomId = "507f1f77bcf86cd799439013";
User.findById = () => ({ select: async () => ({ role: "admin" }) });
let mongo;
let server;
let baseUrl;
test.before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const app = express();
  app.use(express.json(), cookieParser(), router);
  server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

test("screenshot patch persists and preserves legacy and concurrent fields", async () => {
  const event = await ExternalCalendarEvent.create({
    hotelId: roomId, externalUid: "opaque", source: "booking_com",
    startDate: new Date("2027-01-02T00:00:00Z"), endDate: new Date("2027-01-05T00:00:00Z"),
    pnlIncome: { notes: "Legacy note", checkInDesk: true, grossAmountCents: 5000 },
  });
  const body = { roomId, checkIn: "2027-01-02", checkOut: "2027-01-05" };
  const request = (details) => fetch(`${baseUrl}/bookings/booking_com/${event.id}/screenshot`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt.sign({ userId: admin }, process.env.JWT_SECRET_KEY)}` },
    body: JSON.stringify({ ...body, details }),
  });
  assert.equal((await request({ bookingReference: "1234567890", bookingGuestName: "Example Guest" })).status, 200);
  const responses = await Promise.all([request({ guestCount: 3 }), request({ grossAmountCents: 12345 })]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  const saved = await PnlBookingIncome.findById(`booking_com:${event.id}`).lean();
  assert.deepEqual(saved.details, {
    notes: "Legacy note", checkInDesk: true, bookingReference: "1234567890", bookingGuestName: "Example Guest",
    guestCount: 3, grossAmountCents: 12345,
  });
  const original = await ExternalCalendarEvent.findById(event.id).select("+pnlIncome").lean();
  assert.equal(original.externalUid, "opaque");
  assert.equal(original.pnlIncome.grossAmountCents, 5000);
});

test("income loads site bookings and active calendar events by check-in year with editable reporting details", async () => {
  const site = await Booking.create({
    userId: admin, hotelId: roomId, reservationNumber: "SITE-2028", firstName: "Site", lastName: "Guest",
    email: "source@example.test", adultCount: 2, childCount: 0, status: "confirmed", totalCost: 200,
    checkIn: new Date("2028-12-30T00:00:00Z"), checkOut: new Date("2029-01-02T00:00:00Z"),
  });
  const calendar = await ExternalCalendarEvent.create({
    hotelId: roomId, externalUid: "opaque-2028", source: "booking_com", origin: "ical",
    startDate: new Date("2028-06-02T00:00:00Z"), endDate: new Date("2028-06-05T00:00:00Z"),
  });
  await ExternalCalendarEvent.create({
    hotelId: roomId, externalUid: "inactive", source: "booking_com", status: "inactive",
    startDate: new Date("2028-07-01T00:00:00Z"), endDate: new Date("2028-07-03T00:00:00Z"),
  });
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${jwt.sign({ userId: admin }, process.env.JWT_SECRET_KEY)}` };
  const getRows = async (year) => (await (await fetch(`${baseUrl}/bookings?year=${year}`, { headers })).json()).bookings;
  let rows = await getRows(2028);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.id === site.id).source, "local");
  assert.equal(rows.find((row) => row.id === calendar.id).calendarEvent, true);
  assert.equal(rows.find((row) => row.id === calendar.id).amountCents, null);
  assert.equal((await getRows(2029)).some((row) => row.id === site.id), false);
  for (const [source, id] of [["local", site.id], ["booking_com", calendar.id]]) {
    const response = await fetch(`${baseUrl}/bookings/${source}/${id}`, {
      method: "PUT", headers,
      body: JSON.stringify({ bookingGuestName: "Reporting Guest", bookingReference: "CUSTOM", bookingEmail: "report@example.test", bookingPhone: "123", notes: "Keep" }),
    });
    assert.equal(response.status, 200);
  }
  rows = await getRows(2028);
  for (const id of [site.id, calendar.id]) {
    const row = rows.find((item) => item.id === id);
    assert.deepEqual([row.guestName, row.reference, row.email, row.phone, row.notes], ["Reporting Guest", "CUSTOM", "report@example.test", "123", "Keep"]);
  }
  assert.equal(rows.find((row) => row.id === site.id).sourceDetails.email, "source@example.test");
  assert.equal((await Booking.findById(site.id).lean()).email, "source@example.test");
  assert.equal((await ExternalCalendarEvent.findById(calendar.id).lean()).externalUid, "opaque-2028");
});
