const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET_KEY = "local-test-secret";
const User = require("../src/models/user").default;
const Hotel = require("../src/models/hotel").default;
const Booking = require("../src/models/booking").default;
const ExternalCalendarEvent = require("../src/models/external-calendar-event").default;
const PnlEntry = require("../src/models/pnl-entry").default;
const PnlBookingIncome = require("../src/models/pnl-booking-income").default;
const PnlRecordedIncome = require("../src/models/pnl-recorded-income").default;
const PnlGridView = require("../src/models/pnl-grid-view").default;
const router = require("../src/routes/pnl").default;

const adminId = "507f1f77bcf86cd799439011";
const ownerId = "507f1f77bcf86cd799439012";
const secondAdminId = "507f1f77bcf86cd799439015";
const roomId = "507f1f77bcf86cd799439013";
const entryId = "507f1f77bcf86cd799439014";
const token = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET_KEY);
let saved;
const dedicated = new Map();
const recorded = [];
const gridViews = new Map();

User.findById = (id) => ({
  select: async () => id === adminId || id === secondAdminId ? { role: "admin" } : id === ownerId ? { role: "hotel_owner" } : null,
});
PnlGridView.find = ({ userId }) => ({ sort: () => ({ lean: async () => [...gridViews.values()].filter((view) => view.userId === userId) }) });
PnlGridView.create = async (value) => {
  const view = { ...value, _id: new mongoose.Types.ObjectId() };
  gridViews.set(String(view._id), view);
  return view;
};
PnlGridView.findOneAndUpdate = async ({ _id, userId }, value) => {
  const view = gridViews.get(_id);
  if (!view || view.userId !== userId) return null;
  Object.assign(view, value);
  return view;
};
PnlGridView.findOneAndDelete = async ({ _id, userId }) => {
  const view = gridViews.get(_id);
  if (!view || view.userId !== userId) return null;
  gridViews.delete(_id);
  return view;
};
Hotel.exists = async ({ _id }) => _id === roomId;
PnlEntry.create = async (value) => (saved = { ...value, _id: entryId });
PnlEntry.find = () => ({ lean: async () => saved ? [saved] : [] });
PnlEntry.findByIdAndUpdate = async (id, value) => {
  if (!saved || id !== entryId) return null;
  return (saved = { ...saved, ...value });
};
PnlEntry.findByIdAndDelete = async (id) => {
  if (!saved || id !== entryId) return null;
  const deleted = saved;
  saved = undefined;
  return deleted;
};

const findRows = (rows) => () => ({ select: () => ({ lean: async () => rows }) });
const localBookings = [
  {
    _id: new mongoose.Types.ObjectId(), hotelId: roomId, reservationNumber: "LOCAL-1",
    firstName: "Guest", lastName: "Example", email: "guest@example.test",
    checkIn: new Date("2026-01-02T00:00:00Z"), checkOut: new Date("2026-01-05T00:00:00Z"),
    status: "confirmed", totalCost: 123.45, city: "Rome", country: "Italy", adultCount: 2, childCount: 1,
    excelSync: { identifier: "ID-123", invoiceNumber: "OLD-1", netPrice: 90, raw: { "Età": "F 45 - M 40" } },
  },
  {
    _id: new mongoose.Types.ObjectId(), hotelId: roomId, reservationNumber: "DUP-1",
    checkIn: new Date("2026-02-02T00:00:00Z"), checkOut: new Date("2026-02-05T00:00:00Z"),
    status: "confirmed", totalCost: 60,
  },
  {
    _id: new mongoose.Types.ObjectId(), hotelId: roomId, reservationNumber: "PENDING-1",
    checkIn: new Date("2026-03-02T00:00:00Z"), checkOut: new Date("2026-03-03T00:00:00Z"),
    status: "pending", totalCost: 75,
  },
];
const importedBookings = [
  {
    _id: new mongoose.Types.ObjectId(), hotelId: roomId, externalUid: "BOOKING-1",
    startDate: new Date("2026-02-02T00:00:00Z"), endDate: new Date("2026-02-05T00:00:00Z"),
    totalCost: 60, currency: "EUR",
  },
  {
    _id: new mongoose.Types.ObjectId(), hotelId: roomId, externalUid: "BOOKING-2",
    startDate: new Date("2026-04-02T00:00:00Z"), endDate: new Date("2026-04-05T00:00:00Z"),
    totalCost: 0, currency: "",
  },
  {
    _id: new mongoose.Types.ObjectId(), hotelId: roomId, externalUid: "BOOKING-3",
    startDate: new Date("2026-05-02T00:00:00Z"), endDate: new Date("2026-05-03T00:00:00Z"),
    totalCost: 100, currency: "USD",
  },
  {
    _id: new mongoose.Types.ObjectId(), hotelId: roomId, externalUid: "BOOKING-4",
    startDate: new Date("2026-06-02T00:00:00Z"), endDate: new Date("2026-06-03T00:00:00Z"),
    totalCost: 99.95, currency: "EUR",
  },
];
Booking.find = findRows(localBookings);
ExternalCalendarEvent.find = findRows(importedBookings);
Booking.exists = async ({ _id }) => localBookings.some((row) => String(row._id) === _id);
ExternalCalendarEvent.exists = async ({ _id }) => importedBookings.some((row) => String(row._id) === _id);
PnlBookingIncome.find = () => ({ lean: async () => [...dedicated.values()] });
PnlBookingIncome.findByIdAndUpdate = async (id, update) => {
  const record = { _id: id, ...update.$set };
  dedicated.set(id, record);
  return record;
};
PnlRecordedIncome.find = () => ({ lean: async () => recorded });
PnlRecordedIncome.findByIdAndUpdate = async (id, update) => {
  const item = recorded.find((row) => row._id === id);
  if (!item) return null;
  Object.assign(item, update.$set);
  return item;
};

const app = express();
app.use(express.json(), cookieParser());
app.use("/api/pnl", router);
let server;
let url;
test.before(async () => {
  server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  url = `http://127.0.0.1:${server.address().port}/api/pnl`;
});
test.after(() => new Promise((resolve) => server.close(resolve)));

const request = (path, { user = adminId, method = "GET", body } = {}) => fetch(`${url}${path}`, {
  method,
  headers: { ...(user ? { Authorization: `Bearer ${token(user)}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

test("P&L endpoints require an admin", async () => {
  assert.equal((await request("/entries?year=2026", { user: null })).status, 401);
  assert.equal((await request("/entries?year=2026", { user: ownerId })).status, 403);
  assert.equal((await request("/bookings?year=2026", { user: ownerId })).status, 403);
  assert.equal((await request("/views", { user: ownerId })).status, 403);
});

test("grid views validate and persist layouts per admin", async () => {
  const layout = { name: "Invoices", columns: ["roomId", "invoiceNumber"], hiddenGroups: ["guest"], frozenColumns: 1, widths: { roomId: 210 } };
  const colorDefaults = { colorTags: [], columnColors: {}, colorFilter: "", columnFilters: {} };
  const defaultWidths = new PnlGridView({ ...layout, userId: adminId, widths: {} });
  assert.equal(defaultWidths.validateSync(), undefined);
  assert.deepEqual(defaultWidths.toObject().widths, {});
  assert.equal((await request("/views", { method: "POST", body: { ...layout, columns: ["roomId", "roomId"] } })).status, 400);
  assert.equal((await request("/views", { method: "POST", body: { ...layout, frozenColumns: 3 } })).status, 400);
  assert.equal((await request("/views", { method: "POST", body: { ...layout, widths: { roomId: 601 } } })).status, 400);
  assert.equal((await request("/views", { method: "POST", body: { ...layout, widths: { other: 120 } } })).status, 400);
  const response = await request("/views", { method: "POST", body: layout });
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.deepEqual({ ...created, id: undefined }, { ...layout, ...colorDefaults, id: undefined });
  assert.equal((await (await request("/views", { user: secondAdminId })).json()).views.length, 0);
  assert.equal((await request(`/views/${created.id}`, { user: secondAdminId, method: "PUT", body: layout })).status, 404);
  assert.equal((await request(`/views/${created.id}`, { user: secondAdminId, method: "DELETE" })).status, 404);
  const changed = { ...layout, name: "Guest", frozenColumns: 2, hiddenGroups: [], widths: { roomId: 300 },
    colorTags: [{ id: "color-1", name: "Important", color: "#123456" }], columnColors: { invoiceNumber: "color-1" },
    colorFilter: "color-1", columnFilters: { invoiceNumber: "INV-1" } };
  assert.equal((await request("/views", { method: "POST", body: { ...changed, columnColors: { roomId: "missing" } } })).status, 400);
  assert.equal((await request("/views", { method: "POST", body: { ...changed, colorTags: [{ id: "color-1", name: " ", color: "#123456" }] } })).status, 400);
  assert.equal((await request("/views", { method: "POST", body: { ...changed, colorTags: [{ id: "color-1", name: "Important", color: "red" }] } })).status, 400);
  assert.equal((await request("/views", { method: "POST", body: { ...changed, columnFilters: { other: "x" } } })).status, 400);
  assert.equal((await request("/views", { method: "POST", body: { ...changed, colorFilter: "missing" } })).status, 400);
  assert.equal((await request(`/views/${created.id}`, { method: "PUT", body: changed })).status, 200);
  assert.deepEqual((await (await request("/views")).json()).views[0], { id: created.id, ...changed });
  assert.equal((await request(`/views/${created.id}`, { method: "DELETE" })).status, 204);
  assert.equal((await request(`/views/${created.id}`, { method: "DELETE" })).status, 404);
});

test("manual ledger validates and persists create, update and delete", async () => {
  const entry = { type: "expense", date: "2026-02-04", amountCents: 1234, category: "Cleaning", description: "Room clean", roomId, status: "pending" };
  assert.equal((await request("/entries?year=no")).status, 400);
  assert.equal((await request("/entries", { method: "POST", body: { ...entry, date: "2026-02-30" } })).status, 400);
  assert.equal((await request("/entries", { method: "POST", body: { ...entry, amountCents: 1.5 } })).status, 400);
  assert.equal((await request("/entries", { method: "POST", body: { ...entry, roomId: ownerId } })).status, 400);
  const created = await request("/entries", { method: "POST", body: entry });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).amountCents, 1234);
  assert.equal((await (await request("/entries?year=2026")).json()).entries.length, 1);
  const updated = await request(`/entries/${entryId}`, { method: "PUT", body: { ...entry, amountCents: 1550, roomId: null } });
  assert.equal((await updated.json()).amountCents, 1550);
  assert.equal((await request(`/entries/${entryId}`, { method: "DELETE" })).status, 204);
  assert.equal((await request(`/entries/${entryId}`, { method: "DELETE" })).status, 404);
});

test("booking income exposes references and stay dates, excluding uncertain values and duplicates", async () => {
  const response = await request("/bookings?year=2026");
  assert.equal(response.status, 200);
  const { bookings } = await response.json();
  const local = bookings.find((entry) => entry.reference === "LOCAL-1");
  assert.deepEqual([local.checkIn, local.checkOut, local.amountCents, local.reason], ["2026-01-02", "2026-01-05", 12345, ""]);
  assert.deepEqual([local.country, local.city, local.identifier, local.guestCount, local.nights], ["Italy", "Rome", "ID-123", 3, 3]);
  assert.deepEqual([local.netAmountCents, local.unitAmountCents, local.guestDetails], [9000, 3000, "F 45 - M 40"]);
  assert.deepEqual([local.invoiceRequired, local.invoiceCreated, local.invoiceNumber], [null, null, "OLD-1"]);
  assert.equal("excelSync" in local, false);
  assert.equal(bookings.find((entry) => entry.reference === "BOOKING-2").reason, "Amount unavailable");
  assert.equal(bookings.find((entry) => entry.reference === "BOOKING-3").reason, "Currency is not confirmed as EUR");
  assert.equal(bookings.find((entry) => entry.reference === "BOOKING-4").amountCents, 9995);
  assert.equal(bookings.find((entry) => entry.reference === "BOOKING-4").reason, "");
  assert.equal(bookings.find((entry) => entry.reference === "PENDING-1").reason, "Booking is not confirmed");
  assert.equal(bookings.find((entry) => entry.reference === "DUP-1").reason, "Possible duplicate stay");
  assert.equal(bookings.find((entry) => entry.reference === "BOOKING-1").reason, "Possible duplicate stay");
});

test("booking income details and invoice tracking are editable without altering booking data", async () => {
  const localId = String(localBookings[0]._id);
  const importedId = String(importedBookings[1]._id);
  const originalTotal = localBookings[0].totalCost;
  const path = `/bookings/local/${localId}`;
  assert.equal((await request(path, { user: ownerId, method: "PUT", body: { invoiceRequired: false } })).status, 403);
  assert.equal((await request(path, { method: "PUT", body: { invoiceRequired: true, invoiceCreated: true } })).status, 400);
  assert.equal((await request(path, { method: "PUT", body: { invoiceRequired: false, invoiceNumber: "X" } })).status, 400);
  assert.equal((await request(path, { method: "PUT", body: { guestCount: 1.5 } })).status, 400);
  assert.equal((await request(path, { method: "PUT", body: { netAmountCents: 0.1 } })).status, 400);
  const details = {
    country: "France", city: "Paris", identifier: "PASS-1", guestDetails: "F 44 - M 45",
    guestCount: 2, grossAmountCents: 24000, netAmountCents: 21000,
    invoiceRequired: true, invoiceCreated: false,
  };
  assert.equal((await request(path, { method: "PUT", body: details })).status, 200);
  let rows = (await (await request("/bookings?year=2026")).json()).bookings;
  let local = rows.find((row) => row.id === localId);
  assert.deepEqual([local.country, local.city, local.identifier, local.guestCount], ["France", "Paris", "PASS-1", 2]);
  assert.deepEqual([local.amountCents, local.netAmountCents, local.unitAmountCents], [24000, 21000, 7000]);
  assert.deepEqual([local.invoiceRequired, local.invoiceCreated], [true, false]);
  assert.equal(localBookings[0].totalCost, originalTotal);
  assert.equal(localBookings[0].country, "Italy");
  assert.equal((await request(path, { method: "PUT", body: { ...details, unitAmountCents: 6900, invoiceCreated: true, invoiceNumber: "INV-1" } })).status, 200);
  rows = (await (await request("/bookings?year=2026")).json()).bookings;
  local = rows.find((row) => row.id === localId);
  assert.deepEqual([local.invoiceRequired, local.invoiceCreated, local.invoiceNumber], [true, true, "INV-1"]);
  assert.equal(local.unitAmountCents, 7000);
  assert.equal((await request(`/bookings/booking_com/${importedId}`, { method: "PUT", body: { grossAmountCents: 5000, netAmountCents: -2900, invoiceRequired: false } })).status, 200);
  const imported = (await (await request("/bookings?year=2026")).json()).bookings.find((row) => row.id === importedId);
  assert.deepEqual([imported.amountCents, imported.currency, imported.reason, imported.netAmountCents, imported.unitAmountCents], [5000, "EUR", "", -2900, -967]);
  assert.equal(imported.invoiceRequired, false);
  assert.equal((await request(`/bookings/local/${importedId}`, { method: "PUT", body: {} })).status, 404);
  assert.equal((await request(path, { method: "PUT", body: {} })).status, 200);
  rows = (await (await request("/bookings?year=2026")).json()).bookings;
  local = rows.find((row) => row.id === localId);
  assert.deepEqual([local.amountCents, local.country, local.invoiceRequired], [12345, "Italy", null]);
});

test("standalone income is reported, editable and prevents possible booking overlap", async () => {
  const id = "a".repeat(64);
  recorded.push({
    _id: id, date: "2026-01-02", nights: 3, roomId,
    guestName: "Example", details: { grossAmountCents: 10100, netAmountCents: 10000, invoiceNumber: "INV-UNKNOWN" },
  });
  let rows = (await (await request("/bookings?year=2026")).json()).bookings;
  const item = rows.find((row) => row.id === id);
  assert.deepEqual([item.source, item.nights, item.unitAmountCents, item.invoiceRequired, item.invoiceNumber], ["recorded", 3, 3333, null, "INV-UNKNOWN"]);
  assert.equal(rows.find((row) => row.reference === "LOCAL-1").reason, "Possible overlap with recorded income");
  const localId = String(localBookings[0]._id);
  assert.equal((await request(`/bookings/local/${localId}`, { method: "PUT", body: { includePossibleOverlap: true } })).status, 200);
  rows = (await (await request("/bookings?year=2026")).json()).bookings;
  assert.equal(rows.find((row) => row.reference === "LOCAL-1").reason, "");
  assert.equal(rows.find((row) => row.reference === "LOCAL-1").possibleRecordedOverlap, true);
  const identity = { reference: "", guestName: "Example", phone: "", email: "", roomId, roomName: "", date: "2026-01-02", nights: 3 };
  assert.equal((await request(`/bookings/recorded/${id}`, { method: "PUT", body: { ...identity, details: { grossAmountCents: 12000, netAmountCents: 11000, invoiceNumber: "INV-UNKNOWN" } } })).status, 200);
  rows = (await (await request("/bookings?year=2026")).json()).bookings;
  assert.equal(rows.find((row) => row.id === id).unitAmountCents, 3667);
  assert.equal((await request(`/bookings/recorded/${id}`, { method: "PUT", body: { ...identity, details: { grossAmountCents: 12000, excludeFromTotals: true } } })).status, 200);
  rows = (await (await request("/bookings?year=2026")).json()).bookings;
  assert.equal(rows.find((row) => row.id === id).reason, "Excluded by administrator");
  assert.equal(rows.find((row) => row.reference === "LOCAL-1").possibleRecordedOverlap, false);
  assert.equal((await request(`/bookings/recorded/${id}`, { method: "PUT", body: {} })).status, 400);
  recorded.length = 0;
});

test("expense counts can be cleared and unspecified payment status stays unknown", async () => {
  const entry = new PnlEntry({
    type: "expense", date: "2026-01-01", amountCents: 100, category: "Other", description: "Cost",
    status: "unknown", nights: null, guestCount: null, numberOfNights: null, createdBy: adminId,
  });
  assert.equal(entry.validateSync(), undefined);
  const result = await request("/entries", { method: "POST", body: entry.toObject() });
  assert.equal(result.status, 201);
  assert.equal((await result.json()).status, "unknown");
});
