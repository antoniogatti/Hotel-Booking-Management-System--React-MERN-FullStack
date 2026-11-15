import mongoose from "mongoose";

export type PnlBookingDetails = {
  country?: string;
  city?: string;
  identifier?: string;
  guestDetails?: string;
  notes?: string;
  guestCount?: number;
  grossAmountCents?: number;
  netAmountCents?: number;
  unitAmountCents?: number;
  invoiceRequired?: boolean;
  invoiceCreated?: boolean;
  invoiceNumber?: string;
  invoiceDate?: string;
  touristTaxCents?: number;
  paymentMethod?: string;
  paymentStatus?: "paid" | "pending" | "unknown";
  taxQuarter?: string;
  includePossibleOverlap?: boolean;
  excludeFromTotals?: boolean;
};

const pnlBookingDetailsSchema = new mongoose.Schema<PnlBookingDetails>(
  {
    country: { type: String, trim: true, maxlength: 100 },
    city: { type: String, trim: true, maxlength: 100 },
    identifier: { type: String, trim: true, maxlength: 100 },
    guestDetails: { type: String, trim: true, maxlength: 300 },
    notes: { type: String, trim: true, maxlength: 1000 },
    guestCount: { type: Number, min: 1, max: 1000, validate: Number.isSafeInteger },
    grossAmountCents: { type: Number, min: 1, max: 10000000000, validate: Number.isSafeInteger },
    netAmountCents: { type: Number, min: -10000000000, max: 10000000000, validate: Number.isSafeInteger },
    unitAmountCents: { type: Number, min: -10000000000, max: 10000000000, validate: Number.isSafeInteger },
    invoiceRequired: { type: Boolean },
    invoiceCreated: { type: Boolean },
    invoiceNumber: { type: String, trim: true, maxlength: 100 },
    invoiceDate: { type: String },
    touristTaxCents: { type: Number, min: 0, max: 10000000000, validate: Number.isSafeInteger },
    paymentMethod: { type: String, trim: true, maxlength: 100 },
    paymentStatus: { type: String, enum: ["paid", "pending", "unknown"] },
    taxQuarter: { type: String, trim: true, maxlength: 100 },
    includePossibleOverlap: { type: Boolean },
    excludeFromTotals: { type: Boolean },
  },
  { _id: false }
);

export default pnlBookingDetailsSchema;
