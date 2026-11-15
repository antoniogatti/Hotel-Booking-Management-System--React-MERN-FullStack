import mongoose from "mongoose";
import pnlBookingDetailsSchema from "./pnl-booking-details";

const pnlRecordedIncomeSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    reference: { type: String, default: "" },
    guestName: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    roomId: { type: String, default: "" },
    roomName: { type: String, default: "" },
    date: { type: String, required: true },
    nights: { type: Number, min: 1, max: 10000, validate: (value: number | null) => value === null || Number.isSafeInteger(value) },
    details: { type: pnlBookingDetailsSchema, required: true },
    importBatch: { type: String, required: true },
    importRow: { type: Number, required: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true, autoCreate: false, autoIndex: false }
);

export default mongoose.model("PnlRecordedIncome", pnlRecordedIncomeSchema);
