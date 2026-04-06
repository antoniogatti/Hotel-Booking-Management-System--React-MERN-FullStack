import mongoose, { Document } from "mongoose";

export type ExternalCalendarEventSource = "booking_com";
export type ExternalCalendarEventStatus = "active" | "inactive";

export interface IExternalCalendarEvent extends Document {
  hotelId: string;
  source: ExternalCalendarEventSource;
  externalUid: string;
  summary: string;
  startDate: Date;
  endDate: Date;
  dtStamp?: Date;
  status: ExternalCalendarEventStatus;
  lastSeenAt: Date;
  rawEvent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const externalCalendarEventSchema = new mongoose.Schema(
  {
    hotelId: { type: String, required: true, index: true },
    source: {
      type: String,
      enum: ["booking_com"],
      required: true,
      default: "booking_com",
      index: true,
    },
    externalUid: { type: String, required: true },
    summary: { type: String, default: "" },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    dtStamp: { type: Date },
    status: {
      type: String,
      enum: ["active", "inactive"],
      required: true,
      default: "active",
      index: true,
    },
    lastSeenAt: { type: Date, required: true, default: Date.now },
    rawEvent: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

externalCalendarEventSchema.index(
  { hotelId: 1, source: 1, externalUid: 1 },
  { unique: true }
);
externalCalendarEventSchema.index({ hotelId: 1, status: 1, startDate: 1, endDate: 1 });

export default mongoose.model<IExternalCalendarEvent>(
  "ExternalCalendarEvent",
  externalCalendarEventSchema
);