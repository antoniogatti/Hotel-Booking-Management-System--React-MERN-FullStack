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
