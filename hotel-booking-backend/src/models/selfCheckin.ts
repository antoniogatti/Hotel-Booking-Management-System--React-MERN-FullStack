import mongoose, { Document } from "mongoose";

export interface ISelfCheckin extends Document {
  fullName: string;
  numberOfNights: number;
  breakfastTime?: string;
  guests: Array<{
    givenName: string;
    familyName: string;
    documentType: "id_card" | "passport";
    documentNumber: string;
    breakfastChoice?: "Savoury" | "Sweet";
    documents: Array<{
      gridFsId: mongoose.Types.ObjectId;
      filename: string;
      mimeType: string;
      size: number;
      uploadedAt: Date;
    }>;
  }>;
  sourceCode?: string;
  ipAddress?: string;
  userAgent?: string;
  code?: string;
  createdAt: Date;
  updatedAt: Date;
}

const guestDocumentRefSchema = new mongoose.Schema(
  {
    gridFsId: { type: mongoose.Schema.Types.ObjectId, required: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const guestSchema = new mongoose.Schema(
  {
    givenName: { type: String, required: true, trim: true },
    familyName: { type: String, required: true, trim: true },
    documentType: {
      type: String,
      enum: ["id_card", "passport"],
      required: true,
    },
    documentNumber: { type: String, required: true, trim: true },
    breakfastChoice: {
      type: String,
      enum: ["Savoury", "Sweet"],
      required: false,
    },
    documents: {
      type: [guestDocumentRefSchema],
      default: [],
    },
  },
  { _id: false }
);

const selfCheckinSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    numberOfNights: { type: Number, required: true, min: 1 },
    breakfastTime: { type: String, required: false },
    guests: {
      type: [guestSchema],
      required: true,
      validate: {
        validator: (value: unknown[]) => Array.isArray(value) && value.length >= 1 && value.length <= 4,
        message: "Guests must be between 1 and 4",
      },
    },
    sourceCode: { type: String, index: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    code: { type: String, index: true },
  },
  { timestamps: true }
);

selfCheckinSchema.index({ createdAt: -1 });
selfCheckinSchema.index({ sourceCode: 1, createdAt: -1 });

export default mongoose.model<ISelfCheckin>("SelfCheckin", selfCheckinSchema);
