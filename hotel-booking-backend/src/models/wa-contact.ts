import mongoose, { Document, Schema } from "mongoose";

export interface IWAContact extends Document {
  phone: string;
  name: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WAContactSchema = new Schema<IWAContact>(
  {
    phone: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    notes: { type: String },
  },
  { timestamps: true }
);

export default (mongoose.models.WAContact ||
  mongoose.model<IWAContact>("WAContact", WAContactSchema)) as mongoose.Model<IWAContact>;
