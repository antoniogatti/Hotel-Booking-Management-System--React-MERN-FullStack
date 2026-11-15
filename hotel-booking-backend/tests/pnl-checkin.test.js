const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

process.env.JWT_SECRET_KEY = "local-test-secret";
process.env.MS_ENTRA_TENANT_ID = "test-tenant";
process.env.MS_ENTRA_CLIENT_ID = "test-client";
process.env.MS_ENTRA_CLIENT_SECRET = "test-secret";
process.env.PUBLIC_WEB_URL = "https://example.test";
delete process.env.DISABLE_CONTACT_EMAILS;

const User = require("../src/models/user").default;
const Booking = require("../src/models/booking").default;
const ExternalCalendarEvent = require("../src/models/external-calendar-event").default;
const router = require("../src/routes/pnl").default;

const admin = "507f1f77bcf86cd799439011";
const owner = "507f1f77bcf86cd799439012";
const localId = "507f1f77bcf86cd799439013";
const importedId = "507f1f77bcf86cd799439014";
const local = { status: "confirmed", email: "guest@example.test", firstName: "Test", lastName: "Guest", reservationNumber: "LOCAL-1", checkIn: new Date("2026-09-01") };
const imported = { status: "active", email: "imported@example.test", firstName: "Imported", externalUid: "IMPORT-1", startDate: new Date("2026-09-02") };
User.findById = (id) => ({ select: async () => ({ role: id === admin ? "admin" : "hotel_owner" }) });
Booking.findById = (id) => ({ lean: async () => id === localId ? local : null });
ExternalCalendarEvent.findOne = ({ _id }) => ({ lean: async () => _id === importedId ? imported : null });

const app = express();
app.use(express.json(), cookieParser());
app.use("/api/pnl", router);
const realFetch = global.fetch;
const mail = [];
let mailFails = false;
let server;
let url;
test.before(async () => {
  global.fetch = async (target, options) => {
    if (String(target).startsWith("https://login.microsoftonline.com/")) {
      return Response.json({ access_token: "mock-token" });
    }
    if (String(target).startsWith("https://graph.microsoft.com/")) {
      if (mailFails) return new Response("mock error", { status: 500 });
      mail.push(JSON.parse(options.body));
      return new Response(null, { status: 202 });
    }
    return realFetch(target, options);
  };
  server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  url = `http://127.0.0.1:${server.address().port}/api/pnl/check-in-invitations`;
});
test.after(async () => {
  global.fetch = realFetch;
  await new Promise((resolve) => server.close(resolve));
});
const request = (body, user = admin) => realFetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user }, process.env.JWT_SECRET_KEY)}` } : {}) },
  body: JSON.stringify(body),
});

test("invitations require admin access, eligible bookings, and valid self check-in details", async () => {
  const body = { source: "local", id: localId, mode: "desk", expectedEmail: "guest@example.test" };
  assert.equal((await request(body, null)).status, 401);
  assert.equal((await request(body, owner)).status, 403);
  assert.equal((await request({ ...body, source: "recorded" })).status, 400);
  assert.equal((await request({ ...body, mode: "self", accessCode: "", locker: "", breakfastIncluded: true })).status, 400);
  assert.equal((await request({ ...body, mode: "self", accessCode: "1234", locker: "123", breakfastIncluded: true })).status, 400);
  local.status = "cancelled";
  assert.equal((await request(body)).status, 400);
  local.status = "confirmed";
  local.email = "";
  assert.equal((await request(body)).status, 400);
  local.email = "guest@example.test";
  assert.equal((await request({ ...body, expectedEmail: "old@example.test" })).status, 409);
  assert.equal(mail.length, 0);
});

test("sends individual desk and self check-in emails to the stored guest address", async () => {
  assert.equal((await request({ source: "local", id: localId, mode: "desk", expectedEmail: "guest@example.test", email: "attacker@example.test" })).status, 200);
  assert.equal(mail[0].message.toRecipients[0].emailAddress.address, "guest@example.test");
  assert.match(mail[0].message.body.content, /team will assist/);
  assert.doesNotMatch(mail[0].message.body.content, /\/self-checkin/);
  assert.equal((await request({ source: "booking_com", id: importedId, expectedEmail: "imported@example.test", mode: "self", accessCode: "4589", locker: "2", breakfastIncluded: false })).status, 200);
  assert.equal(mail[1].message.toRecipients[0].emailAddress.address, "imported@example.test");
  assert.match(mail[1].message.body.content, /https:\/\/example\.test\/self-checkin\?q=4589&amp;l=2&amp;b=false/);
  assert.match(mail[1].message.body.content, /keep it private/);
});

test("reports disabled or unsuccessful email delivery without claiming success", async () => {
  const body = { source: "local", id: localId, mode: "desk", expectedEmail: "guest@example.test" };
  process.env.DISABLE_CONTACT_EMAILS = "true";
  assert.equal((await request(body)).status, 500);
  delete process.env.DISABLE_CONTACT_EMAILS;
  mailFails = true;
  const response = await request(body);
  assert.equal(response.status, 500);
  assert.match((await response.json()).message, /Check sent mail/);
  mailFails = false;
  assert.equal(mail.length, 2);
});
