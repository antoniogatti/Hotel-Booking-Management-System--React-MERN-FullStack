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
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  adultCount?: number;
  childCount?: number;
  totalCost?: number;
  nationality?: string;
  specialRequests?: string;
  dtStamp?: Date;
  checkInInfo?: {
    arrivalTime?: string;
    phone?: string;
    email?: string;
    nationality?: string;
    bookingChannel?: string;
    paymentDetails?: string;
    specialNotes?: string;
    documents?: string[];
    cityTax?: number;
    checkedInAt?: Date;
  };
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
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    adultCount: { type: Number, default: 0 },
    childCount: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
    nationality: { type: String, default: "" },
    specialRequests: { type: String, default: "" },
    dtStamp: { type: Date },
    checkInInfo: {
      arrivalTime: { type: String },
      phone: { type: String },
      email: { type: String },
      nationality: { type: String },
      bookingChannel: { type: String },
      paymentDetails: { type: String },
      specialNotes: { type: String },
      documents: [{ type: String }],
      cityTax: { type: Number, default: 0 },
      checkedInAt: { type: Date },
    },
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