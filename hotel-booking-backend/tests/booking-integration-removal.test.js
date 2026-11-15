const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET_KEY = "local-test-secret";
const Booking = require("../src/models/booking").default;
const ExternalCalendarEvent = require("../src/models/external-calendar-event").default;
const Hotel = require("../src/models/hotel").default;
const User = require("../src/models/user").default;
const SchedulerRunLog = require("../src/models/scheduler-run-log").default;
const bookingsRouter = require("../src/routes/bookings").default;
const myBookingsRouter = require("../src/routes/my-bookings").default;
const schedulerRouter = require("../src/routes/scheduler-monitor").default;
const mcpRouter = require("../src/routes/mcp").default;

const userId = "507f1f77bcf86cd799439011";
const roomId = "507f1f77bcf86cd799439012";
const localId = "507f1f77bcf86cd799439013";
const importedId = "507f1f77bcf86cd799439014";
const token = jwt.sign({ userId, role: "admin" }, process.env.JWT_SECRET_KEY);
const localBooking = new Booking({
  _id: localId, userId, hotelId: roomId, reservationNumber: "LOCAL-1",
  firstName: "Alex", lastName: "Guest", email: "guest@example.test",
  phone: "12345", nationality: "Italian", adultCount: 2, childCount: 0,
  checkIn: new Date("2026-03-01"), checkOut: new Date("2026-03-02"),
  totalCost: 100, status: "confirmed",
  checkInInfo: { paymentDetails: "Card", specialNotes: "Existing note" },
  pnlIncome: { identifier: "private identifier", invoiceRequired: true, invoiceNumber: "INV-1" },
  oneNoteSync: { phone: "old phone", arrivalNote: "14:30", paymentNote: "old payment", notes: "old note" },
  excelSync: { paymentVia: "old payment", invoiceNumber: "private metadata" },
});
const imported = new ExternalCalendarEvent({
  _id: importedId, hotelId: roomId, externalUid: "IMPORT-1",
  firstName: "Sam", lastName: "Guest",
  startDate: new Date("2026-03-01"), endDate: new Date("2026-03-02"),
  oneNoteSync: { arrivalNote: "15:45", bookingSource: "Direct", notes: "Late arrival" },
  excelSync: { paymentVia: "Cash", invoiceNumber: "private metadata" },
});
const hotel = { _id: roomId, userId, name: "Test room", city: "Test city", country: "Italy" };
User.findById = () => ({ select: async () => ({ role: "admin" }) });
Hotel.findById = () => ({ ...hotel, select: async () => hotel, toObject: () => hotel });
Booking.findById = (id) => ({ populate: async () => id === localId ? localBooking : null });
Booking.find = () => ({ sort: async () => [localBooking] });
ExternalCalendarEvent.findById = async (id) => id === importedId ? imported : null;
SchedulerRunLog.find = () => ({ sort: () => ({ lean: async () => [{
  _id: localId, slotKey: "morning", status: "failed", processed: 1, errorCount: 1,
  syncedOneNote: 1, syncedExcel: 1, errorMessage: "legacy integration error",
  errorDetails: [{ message: "legacy details" }], reason: "legacy reason",
}] }) });
let selectedFields;
Booking.findOne = () => ({
  select: (fields) => {
    selectedFields = fields;
    return { lean: async () => {
      const { oneNoteSync, excelSync, pnlIncome, ...booking } = localBooking.toObject();
      return booking;
    } };
  },
});

const app = express();
app.use(express.json(), cookieParser());
app.use("/api/bookings", bookingsRouter);
app.use("/api/my-bookings", myBookingsRouter);
app.use("/api/scheduler-monitor", schedulerRouter);
app.use("/api/mcp", mcpRouter);
let server;
let baseUrl;
test.before(async () => {
  server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => new Promise((resolve) => server.close(resolve)));
const request = (path, options = {}) => fetch(`${baseUrl}${path}`, {
  ...options,
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
});
const assertRedacted = (booking) => {
  assert.equal("oneNoteSync" in booking, false);
  assert.equal("excelSync" in booking, false);
  assert.equal("pnlIncome" in booking, false);
};

test("booking serialization redacts metadata without changing the document", () => {
  const json = JSON.parse(JSON.stringify({ booking: localBooking })).booking;
  assertRedacted(json);
  assert.equal(json.firstName, "Alex");
  assert.equal(json.checkInInfo.arrivalTime, "14:30");
  assert.equal(json.checkInInfo.phone, "12345");
  assert.equal(json.checkInInfo.paymentDetails, "Card");
  assert.equal(json.checkInInfo.specialNotes, "Existing note");
  assert.equal(localBooking.toObject().oneNoteSync.arrivalNote, "14:30");
  assert.equal(localBooking.toObject().excelSync.invoiceNumber, "private metadata");
  const cleared = new Booking({
    checkInInfo: { paymentDetails: "", specialNotes: "" },
    oneNoteSync: { paymentNote: "old payment", notes: "old note" },
  }).toJSON();
  assert.equal(cleared.checkInInfo.paymentDetails, "");
  assert.equal(cleared.checkInInfo.specialNotes, "");
});

test("local, imported, and nested booking responses retain usable data without metadata", async () => {
  const local = await (await request(`/api/bookings/${localId}`)).json();
  assertRedacted(local);
  assert.equal(local.firstName, "Alex");
  assert.equal(local.checkInInfo.paymentDetails, "Card");
  const external = await (await request(`/api/bookings/${importedId}`)).json();
  assertRedacted(external);
  assert.equal(external.reservationNumber, "IMPORT-1");
  assert.equal(external.checkInInfo.arrivalTime, "15:45");
  assert.equal(external.checkInInfo.paymentDetails, "Cash");
  assert.equal(external.checkInInfo.specialNotes, "Late arrival");
  const nested = await (await request("/api/my-bookings")).json();
  assertRedacted(nested[0].bookings[0]);
  assert.equal(nested[0].bookings[0].firstName, "Alex");
});

test("legacy endpoints are absent and scheduler history contains only safe summaries", async () => {
  for (const path of [`/api/bookings/${localId}/sync-excel`, `/api/bookings/${localId}/sync-onenote`]) {
    assert.equal((await request(path, { method: "POST" })).status, 404);
  }
  const response = await request("/api/scheduler-monitor/enrichment/runs?date=2026-03-01");
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.active, false);
  assert.equal(data.runs[0].errors, 1);
  assert.equal(JSON.stringify(data).includes("legacy"), false);
  assert.equal("syncedExcel" in data.runs[0], false);
  assert.equal("syncedOneNote" in data.runs[0], false);
});

test("MCP booking verification excludes legacy metadata from the lean query", async () => {
  const response = await request("/api/mcp/execute", {
    method: "POST",
    body: JSON.stringify({ tool: "bookings.verify", params: { bookingId: localId } }),
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(selectedFields, "-oneNoteSync -excelSync -pnlIncome");
  assertRedacted(data.booking);
  assert.equal(data.booking.firstName, "Alex");
});
