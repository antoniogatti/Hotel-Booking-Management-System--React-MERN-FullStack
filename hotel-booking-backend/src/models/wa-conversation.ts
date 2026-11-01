import mongoose, { Schema, Document } from "mongoose";

export interface IWAConversation extends Document {
  phone: string;
  messages: Array<{ role: "user" | "assistant"; content: string; ts: Date }>;
  updated_at: Date;
}

const WAConversationSchema = new Schema<IWAConversation>({
  phone: { type: String, required: true, unique: true },
  messages: [{ role: String, content: String, ts: Date }],
  updated_at: { type: Date, default: Date.now, expires: 86400 },
});

const WAConversation = (
  mongoose.models.WAConversation ||
  mongoose.model<IWAConversation>("WAConversation", WAConversationSchema)
) as mongoose.Model<IWAConversation>;

export default WAConversation;
