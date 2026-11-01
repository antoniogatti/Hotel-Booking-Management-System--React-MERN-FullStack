import mongoose, { Schema, Document } from "mongoose";

export interface IWAMessage {
  role: "user" | "assistant";
  content: string;
  ts: Date;
  source?: "auto" | "approved_ai" | "manual";
}

export interface IWAConversation extends Document {
  phone: string;
  messages: IWAMessage[];
  updated_at: Date;
  auto: boolean;
  pendingReply?: {
    inReplyTo: string;
    suggestions: string[];
    createdAt: Date;
  };
}

const WAConversationSchema = new Schema<IWAConversation>({
  phone: { type: String, required: true, unique: true },
  messages: [
    {
      role: String,
      content: String,
      ts: Date,
      source: { type: String, enum: ["auto", "approved_ai", "manual"], required: false },
    },
  ],
  updated_at: { type: Date, default: Date.now, expires: 86400 },
  auto: { type: Boolean, default: false },
  pendingReply: {
    type: {
      inReplyTo: String,
      suggestions: [String],
      createdAt: { type: Date, default: Date.now },
    },
    required: false,
    default: undefined,
  },
});

const WAConversation = (
  mongoose.models.WAConversation ||
  mongoose.model<IWAConversation>("WAConversation", WAConversationSchema)
) as mongoose.Model<IWAConversation>;

export default WAConversation;
