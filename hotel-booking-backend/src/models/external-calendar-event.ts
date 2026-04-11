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
  city?: string;
  country?: string;
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
    breakfast?: {
      time?: string;
      savouryCount?: number;
      sweetCount?: number;
    };
    documents?: string[];
    cityTax?: number;
    checkedInAt?: Date;
  };
  status: ExternalCalendarEventStatus;
  excelSync?: {
    lastSyncedAt?: Date;
    sheetName?: string;
    workbookItemId?: string;
    matchedRowNumber?: number;
    matchedRoom?: string;
    matchedDate?: Date;
    guestName?: string;
    invoiceNumber?: string;
    identifier?: string;
    paymentVia?: string;
    pax?: number;
    totalPrice?: number;
    unitPrice?: number;
    netPrice?: number;
    city?: string;
    country?: string;
    raw?: Record<string, string | number | null>;
  };
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
    city: { type: String, default: "" },
    country: { type: String, default: "" },
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
      breakfast: {
        time: { type: String },
        savouryCount: { type: Number, default: 0 },
        sweetCount: { type: Number, default: 0 },
      },
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
    excelSync: {
      lastSyncedAt: { type: Date },
      sheetName: { type: String },
      workbookItemId: { type: String },
      matchedRowNumber: { type: Number },
      matchedRoom: { type: String },
      matchedDate: { type: Date },
      guestName: { type: String },
      invoiceNumber: { type: String },
      identifier: { type: String },
      paymentVia: { type: String },
      pax: { type: Number },
      totalPrice: { type: Number },
      unitPrice: { type: Number },
      netPrice: { type: Number },
      city: { type: String },
      country: { type: String },
      raw: { type: mongoose.Schema.Types.Mixed },
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