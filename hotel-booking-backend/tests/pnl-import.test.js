const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const PnlEntry = require("../src/models/pnl-entry").default;
const PnlRecordedIncome = require("../src/models/pnl-recorded-income").default;
const { main } = require("../scripts/import-pnl");

const income = new Map();
const expenses = new Map();
const room = new mongoose.Types.ObjectId();
const originalConnect = mongoose.connect;
const originalDb = mongoose.connection.db;
const originalIncomeFind = PnlRecordedIncome.find;
const originalExpenseFind = PnlEntry.find;
const originalIncomeBulk = PnlRecordedIncome.bulkWrite;
const originalExpenseBulk = PnlEntry.bulkWrite;
const snapshot = "b".repeat(64);
const payload = {
  snapshot,
  sheets: {
    Ricavi: [
      { row: 1, cells: { A: "ID", J: "Data", N: "Prezzo Totale", P: "Prezzo no tass sog" }, errors: [] },
      { row: 2, cells: { B: "Guest", F: "TEST", J: "46000", L: "3", N: "100.00", P: "90.00", E: "INV-1" }, errors: [] },
    ],
    Costi: [
      { row: 1, cells: { A: "Descrizione", F: "Data", H: "Importo", I: "Stato" }, errors: [] },
      { row: 2, cells: { A: "Cleaning", F: "46000", H: "12.34" }, errors: [] },
    ],
  },
};
const config = { connectionString: "unused", expectedDatabase: "test" };
const find = (store) => () => ({ select: () => ({ lean: async () => [...store.values()] }) });
const bulk = (store) => async (operations) => {
  for (const { updateOne } of operations) {
    const key = String(updateOne.filter._id);
    if (!store.has(key)) store.set(key, updateOne.update.$setOnInsert);
  }
};

test.before(() => {
  mongoose.connect = async () => mongoose;
  mongoose.connection.db = {
    databaseName: "test",
    collection: (name) => ({
      find: () => ({ toArray: async () => name === "hotels" ? [{ _id: room, name: "Test - Room" }] : [] }),
    }),
  };
  PnlRecordedIncome.find = find(income);
  PnlEntry.find = find(expenses);
  PnlRecordedIncome.bulkWrite = bulk(income);
  PnlEntry.bulkWrite = bulk(expenses);
});
test.after(() => {
  mongoose.connect = originalConnect;
  mongoose.connection.db = originalDb;
  PnlRecordedIncome.find = originalIncomeFind;
  PnlEntry.find = originalExpenseFind;
  PnlRecordedIncome.bulkWrite = originalIncomeBulk;
  PnlEntry.bulkWrite = originalExpenseBulk;
});

test("dry run is read-only and retry preserves edits without duplicating rows", async () => {
  await main(payload, config);
  assert.equal(income.size + expenses.size, 0);
  const apply = { ...config, mode: "--apply", expectedSnapshot: snapshot };
  await main(payload, apply);
  assert.equal(income.size, 1);
  assert.equal(expenses.size, 1);
  const record = [...income.values()][0];
  assert.equal(record.roomId, String(room));
  assert.equal(record.details.invoiceNumber, "INV-1");
  assert.equal(record.details.invoiceRequired, undefined);
  assert.equal([...expenses.values()][0].status, "unknown");
  record.details.invoiceNumber = "EDITED";
  await main(payload, apply);
  assert.equal(income.size, 1);
  assert.equal(expenses.size, 1);
  assert.equal([...income.values()][0].details.invoiceNumber, "EDITED");
});

test("changed snapshots and conflicting existing rows block writes", async () => {
  await assert.rejects(main(payload, { ...config, mode: "--apply", expectedSnapshot: "c".repeat(64) }), /snapshot mismatch/i);
  expenses.set("conflict", { _id: "conflict", type: "expense", date: "2025-12-09" });
  await assert.rejects(main(payload, { ...config, mode: "--apply", expectedSnapshot: snapshot }), /manual reconciliation/i);
  assert.equal(income.size, 1);
  assert.equal(expenses.size, 2);
});
