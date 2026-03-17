import mongoose, { Document } from "mongoose";

export interface IBookingDayStatus extends Document {
  hotelId: string;
  date: Date;
  status: "closed";
  note?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const bookingDayStatusSchema = new mongoose.Schema(
  {
    hotelId: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["closed"],
      required: true,
      default: "closed",
      index: true,
    },
    note: { type: String, default: "" },
    createdBy: { type: String },
  },
  {
    timestamps: true,
  }
);

bookingDayStatusSchema.index({ hotelId: 1, date: 1 }, { unique: true });

export default mongoose.model<IBookingDayStatus>(
  "BookingDayStatus",
  bookingDayStatusSchema
);
