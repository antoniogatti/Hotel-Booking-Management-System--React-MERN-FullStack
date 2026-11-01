import express, { Request, Response } from "express";
import axios from "axios";
import Anthropic from "@anthropic-ai/sdk";
import mongoose, { Schema, Document } from "mongoose";
import Hotel from "../models/hotel";
import Booking from "../models/booking";

const router = express.Router();

const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || "1034926836378800";
const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN || "";
const WA_VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || "palazzopinto2024";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── MongoDB: property knowledge (synced from GitHub by n8n) ──────────────────
interface IPropertyKnowledge extends Document {
  slug: string;
  title: string;
  content: string;
  updated_at: Date;
}
const PropertyKnowledgeSchema = new Schema<IPropertyKnowledge>({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  updated_at: { type: Date, default: Date.now },
});
const PropertyKnowledge = (
  mongoose.models.PropertyKnowledge ||
  mongoose.model<IPropertyKnowledge>("PropertyKnowledge", PropertyKnowledgeSchema)
) as mongoose.Model<IPropertyKnowledge>;

// ─── MongoDB: per-guest conversation history (24h TTL) ───────────────────────
interface IWAConversation extends Document {
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

// ─── Knowledge cache (refresh hourly) ────────────────────────────────────────
let knowledgeCache = "";
let knowledgeCachedAt = 0;

async function getKnowledge(): Promise<string> {
  const now = Date.now();
  if (knowledgeCache && now - knowledgeCachedAt < 3_600_000) return knowledgeCache;

  const docs = await PropertyKnowledge.find({}).sort({ slug: 1 }).lean();
  if (docs.length > 0) {
    knowledgeCache = docs.map((d: any) => `## ${d.title}\n\n${d.content}`).join("\n\n---\n\n");
  } else {
    // Fallback until n8n seeds MongoDB
    knowledgeCache = [
      "## Overview",
      "Palazzo Pinto B&B — boutique mansion built in 1901, heart of Brindisi, 5 min walk from Central Station.",
      "Address: Via Masaniello 30, 72100 Brindisi. Email: info@palazzopintobnb.com. Website: palazzopintobnb.com",
      "",
      "## Rooms",
      "- Malvasia: double with balcony, 18m², queen bed, €100/night, min 2 nights, max 2 adults",
      "- Verdeca: double with balcony, 22m², queen bed, €110/night, min 2 nights, max 2 adults",
      "- Aleatico: apartment, 60m², queen+sofa bed, full kitchen, €130/night, min 3 nights, max 2 adults + 2 children",
      "- Fuocorosa: ground-floor apartment, 60m², queen+sofa bed, full kitchen, €140/night, min 4 nights, max 2 adults + 2 children",
      "All rooms include Wi-Fi, air conditioning, breakfast (rooms), coffee maker.",
      "City tax: €2.50/person/night (included in rate).",
      "",
      "## Policies",
      "Check-in: 14:00–20:00. Check-out: 10:00.",
      "Cancellation: free if 7+ days before arrival; full charge within 7 days.",
      "Payment at check-in by cash or card. Valid ID required for all guests.",
      "No pets. No smoking indoors (€250 fee). No private parking (street parking nearby).",
      "Lost keys: €300 charge.",
    ].join("\n");
  }
  knowledgeCachedAt = now;
  return knowledgeCache;
}

// ─── Sofia tools ──────────────────────────────────────────────────────────────
const SOFIA_TOOLS: Anthropic.Tool[] = [
  {
    name: "lookup_booking",
    description: "Look up a guest booking by reservation reference (e.g. PP-12345). Returns booking status, dates, and room.",
    input_schema: {
      type: "object" as const,
      properties: {
        booking_reference: {
          type: "string",
          description: "Reservation reference code, format PP-XXXXX",
        },
      },
      required: ["booking_reference"],
    },
  },
  {
    name: "check_availability",
    description: "Check which rooms are available for given dates.",
    input_schema: {
      type: "object" as const,
      properties: {
        check_in: {
          type: "string",
          description: "Check-in date in YYYY-MM-DD format",
        },
        check_out: {
          type: "string",
          description: "Check-out date in YYYY-MM-DD format",
        },
      },
      required: ["check_in", "check_out"],
    },
  },
];

async function runTool(name: string, input: Record<string, string>): Promise<string> {
  if (name === "lookup_booking") {
    const ref = input.booking_reference?.toUpperCase().replace(/\s/g, "");
    const normalized = ref?.match(/PP-?(\d+)/i) ? `PP-${ref.match(/PP-?(\d+)/i)![1]}` : ref;
    const booking = await Booking.findOne({ reservationNumber: normalized }).lean() as any;
    if (!booking) return `No booking found for reference ${normalized}.`;
    const cin = new Date(booking.checkIn).toLocaleDateString("it-IT");
    const cout = new Date(booking.checkOut).toLocaleDateString("it-IT");
    return `Booking ${booking.reservationNumber}: check-in ${cin}, check-out ${cout}, status: ${booking.status}, guests: ${booking.adultCount} adults.`;
  }

  if (name === "check_availability") {
    const checkIn = new Date(input.check_in);
    const checkOut = new Date(input.check_out);
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return "Could not parse the dates. Please ask the guest for dates in a clear format.";
    }
    const activeStatuses = ["pending", "confirmed", "arrived", "completed"];
    const candidates = await Hotel.find({ isActive: true }).select("_id name pricePerNight").lean();
    const available: string[] = [];
    for (const h of candidates) {
      const overlap = await Booking.findOne({
        hotelId: h._id,
        status: { $in: activeStatuses },
        checkIn: { $lt: checkOut },
        checkOut: { $gt: checkIn },
      }).select("_id").lean();
      if (!overlap) available.push(`${(h as any).name} (€${(h as any).pricePerNight}/night)`);
    }
    if (available.length === 0) return "No rooms available for those dates.";
    return `Available rooms: ${available.join(", ")}.`;
  }

  return "Unknown tool.";
}

// ─── Meta webhook verification (GET) ──────────────────────────────────────────
router.get("/", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === WA_VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.status(403).send("Forbidden");
});

// ─── Incoming WhatsApp message (POST) ─────────────────────────────────────────
router.post("/", async (req: Request, res: Response) => {
  res.status(200).send("OK");

  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    if (!value?.messages?.length) return;

    const msg = value.messages[0];
    if (msg.type !== "text") return;

    const from: string = msg.from;
    const text: string = msg.text?.body || "";
    const phoneNumberId: string = value.metadata?.phone_number_id || WA_PHONE_NUMBER_ID;

    // Load knowledge + conversation history in parallel
    const [knowledge, convoDoc] = await Promise.all([
      getKnowledge(),
      WAConversation.findOne({ phone: from }).lean() as Promise<IWAConversation | null>,
    ]);

    const history: Anthropic.MessageParam[] = (convoDoc?.messages || [])
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    const systemPrompt = `You are Sofia, the virtual assistant for Palazzo Pinto B&B in Brindisi, Italy.
Your personality: warm, professional, concise. You always reply in the same language the guest uses (Italian or English). If unsure, reply bilingually.
Never make up information. If something is outside your knowledge, invite the guest to email info@palazzopintobnb.com.
Do not invent prices, availability, or policies — use only what is in the knowledge base below.
Keep replies short and friendly — this is WhatsApp, not email.

=== PROPERTY KNOWLEDGE BASE ===
${knowledge}
=== END KNOWLEDGE BASE ===`;

    // Agentic loop (max 3 iterations)
    const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: text }];
    let reply = "";

    for (let i = 0; i < 3; i++) {
      const response = await anthropic.messages.create({
        model: "claude-haiku-5-5",
        max_tokens: 600,
        system: systemPrompt,
        tools: SOFIA_TOOLS,
        messages,
      });

      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter((b) => b.type === "tool_use") as Anthropic.ToolUseBlock[];
        messages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of toolUseBlocks) {
          const result = await runTool(block.name, block.input as Record<string, string>);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        }
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      // End of loop — extract text reply
      const textBlock = response.content.find((b) => b.type === "text") as Anthropic.TextBlock | undefined;
      reply = textBlock?.text || "";
      break;
    }

    if (!reply) reply = "Grazie per il messaggio! Ti risponderemo a info@palazzopintobnb.com\n\nThank you! We'll reply at info@palazzopintobnb.com";

    // Persist conversation (upsert)
    await WAConversation.findOneAndUpdate(
      { phone: from },
      {
        $push: {
          messages: {
            $each: [
              { role: "user", content: text, ts: new Date() },
              { role: "assistant", content: reply, ts: new Date() },
            ],
          },
        },
        $set: { updated_at: new Date() },
      },
      { upsert: true }
    );

    await sendWhatsApp(phoneNumberId, from, reply);
  } catch (err) {
    console.error("[Sofia] error:", err);
  }
});

// ─── Send WhatsApp message ────────────────────────────────────────────────────
async function sendWhatsApp(phoneNumberId: string, to: string, body: string): Promise<void> {
  if (!WA_ACCESS_TOKEN) {
    console.warn("[Sofia] WA_ACCESS_TOKEN not set — skipping send");
    return;
  }
  await axios.post(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body } },
    { headers: { Authorization: `Bearer ${WA_ACCESS_TOKEN}`, "Content-Type": "application/json" } }
  );
}

export default router;
