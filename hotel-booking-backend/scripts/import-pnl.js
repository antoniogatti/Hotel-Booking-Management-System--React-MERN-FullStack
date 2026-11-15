const crypto = require("node:crypto");
const path = require("node:path");
const mongoose = require("mongoose");
require("ts-node/register");
const PnlEntry = require("../src/models/pnl-entry").default;
const PnlRecordedIncome = require("../src/models/pnl-recorded-income").default;

class ImportValidationError extends Error {}
const fail = (sheet, row, message) => { throw new ImportValidationError(`${sheet} row ${row}: ${message}`); };
const text = (cells, key) => (cells[key] || "").trim();
const integer = (cells, key, sheet, row, min, max) => {
  if (!text(cells, key)) return null;
  const value = Number(cells[key]);
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(sheet, row, `invalid ${key}`);
  return value;
};
const cents = (cells, key, sheet, row, required = false) => {
  if (!text(cells, key)) {
    if (required) fail(sheet, row, `missing ${key}`);
    return undefined;
  }
  const value = Number(cells[key]);
  const result = Math.round(value * 100);
  if (!Number.isFinite(value) || !Number.isSafeInteger(result) || Math.abs(result) > 10000000000 || (required && result <= 0)) {
    fail(sheet, row, `invalid ${key}`);
  }
  return result;
};
const date = (cells, key, sheet, row) => {
  const serial = integer(cells, key, sheet, row, 2, 2958465);
  if (serial === null) fail(sheet, row, `missing ${key}`);
  const result = new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
  if (result < "1900-01-01" || result > "9998-12-31") fail(sheet, row, `invalid ${key}`);
  return result;
};
const checkHeaders = (rows, required, sheet) => {
  const header = rows.find((row) => row.row === 1)?.cells || {};
  for (const [column, value] of Object.entries(required)) {
    if (text(header, column) !== value) fail(sheet, 1, `unexpected ${column} heading`);
  }
};
const validateDoc = (doc, sheet, row) => {
  const error = doc.validateSync();
  if (error) fail(sheet, row, `invalid fields: ${Object.keys(error.errors).join(", ")}`);
};

async function main(payload, { connectionString, expectedDatabase, mode, expectedSnapshot }) {
  if (!/^[a-f0-9]{64}$/.test(payload.snapshot) || (mode && payload.snapshot !== expectedSnapshot)) throw new ImportValidationError("Source snapshot mismatch.");
  const income = payload.sheets?.Ricavi;
  const expenses = payload.sheets?.Costi;
  if (!Array.isArray(income) || !Array.isArray(expenses)) throw new ImportValidationError("Required worksheets are missing.");
  checkHeaders(income, { A: "ID", J: "Data", N: "Prezzo Totale", P: "Prezzo no tass sog" }, "Income");
  checkHeaders(expenses, { A: "Descrizione", F: "Data", H: "Importo", I: "Stato" }, "Expenses");

  await mongoose.connect(connectionString, { autoCreate: false, autoIndex: false });
  if (mongoose.connection.db.databaseName !== expectedDatabase) throw new ImportValidationError("Connected database does not match the requested database.");
  const rooms = await mongoose.connection.db.collection("hotels").find({}, { projection: { name: 1 } }).toArray();
  const roomId = (label, row) => {
    if (!label) return "";
    const matches = rooms.filter((room) => String(room.name || "").split(" - ")[0].trim().toUpperCase() === label.toUpperCase());
    if (matches.length !== 1) fail("Income", row, "room label is not uniquely matched");
    return String(matches[0]._id);
  };
  const batch = payload.snapshot;
  const id = (sheet, row) => crypto.createHash("sha256").update(`${batch}:${sheet}:${row}`).digest("hex");
  const incomeDocs = [];
  const expenseDocs = [];
  const processRows = (rows, sheet, dateKey, amountKey, convert) => {
    for (const row of rows.filter((item) => item.row > 1)) {
      const { cells } = row;
      if (!text(cells, dateKey) && (!text(cells, amountKey) || Number(cells[amountKey]) === 0)) continue;
      const errors = row.errors.filter((column) => !(sheet === "Income" && column === "O"));
      if (errors.length) fail(sheet, row.row, `source formula errors in columns ${errors.join(", ")}`);
      convert(cells, row.row, date(cells, dateKey, sheet, row.row), cents(cells, amountKey, sheet, row.row, true));
    }
  };
  processRows(income, "Income", "J", "N", (cells, row, day, gross) => {
    const label = text(cells, "F");
    const details = {
      country: text(cells, "G"), identifier: text(cells, "H"), city: text(cells, "I"),
      guestCount: integer(cells, "M", "Income", row, 1, 1000) ?? undefined,
      grossAmountCents: gross, netAmountCents: cents(cells, "P", "Income", row),
      guestDetails: text(cells, "Q"), paymentMethod: text(cells, "R"), taxQuarter: text(cells, "S"),
      invoiceNumber: text(cells, "E"),
    };
    const doc = new PnlRecordedIncome({
      _id: id("income", row), reference: text(cells, "A"), guestName: text(cells, "B"),
      phone: text(cells, "C"), email: text(cells, "D"), roomId: roomId(label, row), roomName: label,
      date: day, nights: integer(cells, "L", "Income", row, 1, 10000), details,
      importBatch: batch, importRow: row, updatedBy: "pnl-import",
    });
    validateDoc(doc, "Income", row);
    incomeDocs.push(doc.toObject());
  });
  processRows(expenses, "Expenses", "F", "H", (cells, row, day, amount) => {
    const status = text(cells, "I").toLowerCase();
    if (status && status !== "pagato") fail("Expenses", row, "unknown payment status");
    const doc = new PnlEntry({
      _id: new mongoose.Types.ObjectId(id("expense", row).slice(0, 24)),
      type: "expense", date: day, amountCents: amount, category: "Uncategorized", description: text(cells, "A"),
      roomId: null, status: status ? "paid" : "unknown",
      nights: integer(cells, "B", "Expenses", row, 0, 10000),
      guestCount: integer(cells, "C", "Expenses", row, 0, 10000),
      payee: text(cells, "D"), reference: text(cells, "E"), invoice: text(cells, "J"),
      notes: text(cells, "K"), numberOfNights: integer(cells, "L", "Expenses", row, 0, 10000),
      importBatch: batch, importRow: row, createdBy: "pnl-import",
    });
    validateDoc(doc, "Expenses", row);
    expenseDocs.push(doc.toObject());
  });
  if (!incomeDocs.length || !expenseDocs.length) throw new ImportValidationError("A worksheet has no usable rows.");
  const years = [...new Set([...incomeDocs, ...expenseDocs].map((doc) => doc.date.slice(0, 4)))];
  const filter = { $or: years.map((year) => ({ date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } })) };
  const [existingIncome, existingExpenses] = await Promise.all([
    PnlRecordedIncome.find(filter).select("_id importBatch importRow").lean(),
    PnlEntry.find({ ...filter, type: "expense" }).select("_id importBatch importRow").lean(),
  ]);
  if (existingIncome.some((doc) => doc.importBatch !== batch) || existingExpenses.some((doc) => doc.importBatch !== batch)) {
    throw new ImportValidationError("Existing recorded income or expenses in the affected years need manual reconciliation before import.");
  }
  const incomeIds = new Set(incomeDocs.map((doc) => doc._id));
  const expenseIds = new Set(expenseDocs.map((doc) => String(doc._id)));
  if (existingIncome.some((doc) => !incomeIds.has(doc._id)) || existingExpenses.some((doc) => !expenseIds.has(String(doc._id)))) {
    throw new ImportValidationError("Existing imported rows do not match this snapshot.");
  }
  const starts = years.map((year) => ({
    $gte: new Date(`${year}-01-01T00:00:00Z`),
    $lt: new Date(`${Number(year) + 1}-01-01T00:00:00Z`),
  }));
  const [bookings, importedBookings] = await Promise.all([
    mongoose.connection.db.collection("bookings").find({
      $or: starts.map((range) => ({ checkIn: range })), status: { $in: ["confirmed", "arrived", "completed"] },
    }, { projection: { hotelId: 1, checkIn: 1 } }).toArray(),
    mongoose.connection.db.collection("externalcalendarevents").find({
      $or: starts.map((range) => ({ startDate: range })), source: "booking_com", status: "active",
    }, { projection: { hotelId: 1, startDate: 1 } }).toArray(),
  ]);
  const overlaps = [...bookings.map((item) => ({ room: String(item.hotelId), date: item.checkIn })),
    ...importedBookings.map((item) => ({ room: String(item.hotelId), date: item.startDate }))].filter((booking) =>
    booking.date instanceof Date && incomeDocs.some((doc) =>
      doc.date === booking.date.toISOString().slice(0, 10) && (!doc.roomId || doc.roomId === booking.room)
    )
  ).length;
  const combinations = new Map();
  for (const doc of incomeDocs) {
    const key = `${doc.roomId}|${doc.date}`;
    combinations.set(key, (combinations.get(key) || 0) + 1);
  }
  console.log(JSON.stringify({
    mode: mode ? "apply" : "dry-run", database: expectedDatabase, snapshot: batch,
    incomeRows: incomeDocs.length, expenseRows: expenseDocs.length,
    existingIncomeRows: existingIncome.length, existingExpenseRows: existingExpenses.length,
    expenseStatusUnknown: expenseDocs.filter((doc) => doc.status === "unknown").length,
    incomeRoomUnassigned: incomeDocs.filter((doc) => !doc.roomId).length,
    repeatedIncomeRoomDates: [...combinations.values()].filter((count) => count > 1).length,
    possibleBookingOverlaps: overlaps, years,
  }));
  if (mode) {
    const operations = (docs) => docs.map((doc) => ({ updateOne: { filter: { _id: doc._id }, update: { $setOnInsert: doc }, upsert: true } }));
    await PnlRecordedIncome.bulkWrite(operations(incomeDocs), { ordered: true });
    await PnlEntry.bulkWrite(operations(expenseDocs), { ordered: true });
    console.log("Import completed.");
  }
}

if (require.main === module) {
  const [environmentFile, expectedDatabase, mode, expectedSnapshot] = process.argv.slice(2);
  if (!environmentFile || !expectedDatabase || (mode && mode !== "--apply") || (mode && !/^[a-f0-9]{64}$/.test(expectedSnapshot || ""))) {
    throw new Error("Provide an environment file, database name, and optionally an approved snapshot.");
  }
  const env = require("dotenv").config({ path: path.resolve(environmentFile) });
  if (env.error) throw new Error("Unable to load the requested environment file.");
  if (!env.parsed.MONGODB_CONNECTION_STRING) throw new Error("The requested environment file has no database connection.");
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { input += chunk; });
  process.stdin.on("end", async () => {
    try { await main(JSON.parse(input), { connectionString: env.parsed.MONGODB_CONNECTION_STRING, expectedDatabase, mode, expectedSnapshot }); }
    catch (error) {
      const message = error instanceof ImportValidationError ? error.message : `unexpected ${String(error.name || "error").replace(/[^a-zA-Z0-9]/g, "")}`;
      console.error(`Import stopped: ${message}`);
      process.exitCode = 1;
    }
    finally { await mongoose.disconnect(); }
  });
}

module.exports = { main };
