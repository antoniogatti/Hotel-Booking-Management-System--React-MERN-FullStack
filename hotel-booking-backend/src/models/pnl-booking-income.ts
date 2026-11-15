import mongoose from "mongoose";
import pnlBookingDetailsSchema from "./pnl-booking-details";

const pnlBookingIncomeSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    source: { type: String, enum: ["local", "booking_com"], required: true },
    bookingId: { type: String, required: true },
    details: { type: pnlBookingDetailsSchema, required: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true, autoCreate: false, autoIndex: false }
);

export default mongoose.model("PnlBookingIncome", pnlBookingIncomeSchema);
