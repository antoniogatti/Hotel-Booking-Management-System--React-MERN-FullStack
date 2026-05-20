import mongoose, { Document } from "mongoose";

export interface IBooking extends Document {
  _id: string;
  reservationNumber: string;
  userId: string;
  hotelId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  adultCount: number;
  childCount: number;
  checkIn: Date;
  checkOut: Date;
  totalCost: number;
  status: "pending" | "confirmed" | "arrived" | "cancelled" | "completed" | "refunded";
  specialRequests: string;
  cancellationReason: string;
  refundAmount: number;
  createdAt: Date;
  updatedAt: Date;
  checkInInfo?: {
    arrivalTime: string;
    phone: string;
    email: string;
    nationality: string;
    bookingChannel: string;
    paymentDetails: string;
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
  oneNoteSync?: {
    lastSyncedAt?: Date;
    matchedPageId?: string;
    matchedPageTitle?: string;
    matchedSectionName?: string;
    room?: string;
    guestName?: string;
    arrivalNote?: string;
    nationality?: string;
    phone?: string;
    whatsapp?: string;
    nights?: number;
    checkOutNote?: string;
    bookingSource?: string;
    paymentNote?: string;
    amountDueEUR?: number;
    notes?: string;
    rawLines?: string[];
  };
  city?: string;
  country?: string;
  arrivalTime?: "Morning" | "Afternoon" | "Evening" | "Night";
  nationality?: string;
  /** If set, this booking is closed and should not appear in check-in desk */
  closedAt?: Date;
}

const bookingSchema = new mongoose.Schema(
  {
    reservationNumber: { type: String },
    userId: { type: String, required: true, index: true },
    hotelId: { type: String, required: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, index: true },
    phone: { type: String },
    adultCount: { type: Number, required: true },
    childCount: { type: Number, required: true },
    checkIn: { type: Date, required: true, index: true },
    checkOut: { type: Date, required: true },
    totalCost: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "arrived", "cancelled", "completed", "refunded"],
      default: "pending",
      index: true,
    },
    specialRequests: { type: String },
    cancellationReason: { type: String },
    refundAmount: { type: Number, default: 0 },
    // Audit fields
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    // Address Information
    city: { type: String },
    country: { type: String },
    arrivalTime: {
      type: String,
      enum: ["Morning", "Afternoon", "Evening", "Night"],
    },
    nationality: { type: String },
    // Booking closed logic
    closedAt: { type: Date },
    // Check-in Information
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
    oneNoteSync: {
      lastSyncedAt: { type: Date },
      matchedPageId: { type: String },
      matchedPageTitle: { type: String },
      matchedSectionName: { type: String },
      room: { type: String },
      guestName: { type: String },
      arrivalNote: { type: String },
      nationality: { type: String },
      phone: { type: String },
      whatsapp: { type: String },
      nights: { type: Number },
      checkOutNote: { type: String },
      bookingSource: { type: String },
      paymentNote: { type: String },
      amountDueEUR: { type: Number },
      notes: { type: String },
      rawLines: [{ type: String }],
    },
  },
  {
    timestamps: true,
  }
);

// Add compound indexes for better query performance
bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ hotelId: 1, checkIn: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });
bookingSchema.index({ checkIn: 1, status: 1 });
bookingSchema.index({ reservationNumber: 1 }, { unique: true, sparse: true });
bookingSchema.index({ hotelId: 1, email: 1, checkIn: 1, checkOut: 1, createdAt: -1 });

export default mongoose.model<IBooking>("Booking", bookingSchema);
