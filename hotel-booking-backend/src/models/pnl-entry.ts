import mongoose from "mongoose";

const pnlEntrySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["income", "expense"], required: true },
    date: { type: String, required: true },
    amountCents: { type: Number, required: true, min: 1, max: 10000000000, validate: Number.isSafeInteger },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, required: true, trim: true, maxlength: 200 },
    roomId: { type: String, default: null },
    status: { type: String, enum: ["paid", "pending", "unknown"], required: true },
    nights: { type: Number, min: 0, max: 10000, validate: (value: number | null) => value === null || Number.isSafeInteger(value) },
    guestCount: { type: Number, min: 0, max: 10000, validate: (value: number | null) => value === null || Number.isSafeInteger(value) },
    numberOfNights: { type: Number, min: 0, max: 10000, validate: (value: number | null) => value === null || Number.isSafeInteger(value) },
    payee: { type: String, trim: true, maxlength: 200 },
    reference: { type: String, trim: true, maxlength: 200 },
    invoice: { type: String, trim: true, maxlength: 200 },
    notes: { type: String, trim: true, maxlength: 1000 },
    importBatch: { type: String },
    importRow: { type: Number },
    createdBy: { type: String, required: true },
  },
  { timestamps: true, autoCreate: false, autoIndex: false }
);

export default mongoose.model("PnlEntry", pnlEntrySchema);
