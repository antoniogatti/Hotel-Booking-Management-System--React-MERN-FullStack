import express, { Request, Response } from "express";
import axios from "axios";
import verifyToken from "../middleware/auth";
import WAConversation from "../models/wa-conversation";
import WAContact from "../models/wa-contact";

const router = express.Router();

const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN || "";
const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || "1373088652564505";

// ─── Contacts (registered BEFORE /:phone to avoid routing conflicts) ──────────

// GET /api/wa-inbox/contacts
router.get("/contacts", verifyToken, async (_req: Request, res: Response) => {
  const contacts = await WAContact.find({}).sort({ name: 1 }).lean();
  return res.json(contacts.map((c) => ({ phone: c.phone, name: c.name, notes: c.notes })));
});

// POST /api/wa-inbox/contacts — upsert by phone
router.post("/contacts", verifyToken, async (req: Request, res: Response) => {
  const { phone, name, notes } = req.body as { phone: string; name: string; notes?: string };
  if (!phone?.trim() || !name?.trim()) {
    return res.status(400).json({ message: "phone and name are required" });
  }
  await WAContact.findOneAndUpdate(
    { phone },
    { name, notes: notes ?? "" },
    { upsert: true, new: true }
  );
  return res.json({ ok: true });
});

// ─── Conversations ─────────────────────────────────────────────────────────────

// GET /api/wa-inbox — list all conversations, sorted by most recent
router.get("/", verifyToken, async (_req: Request, res: Response) => {
  const convos = await WAConversation.find({})
    .sort({ updated_at: -1 })
    .lean();

  const result = convos.map((c) => {
    const last = c.messages[c.messages.length - 1];
    return {
      phone: c.phone,
      lastMessage: last
        ? { role: last.role, content: last.content, ts: last.ts }
        : null,
      updated_at: c.updated_at,
      messageCount: c.messages.length,
    };
  });

  return res.json(result);
});

// GET /api/wa-inbox/:phone — full thread
router.get("/:phone", verifyToken, async (req: Request, res: Response) => {
  const convo = await WAConversation.findOne({ phone: req.params.phone }).lean();
  if (!convo) return res.status(404).json({ message: "Conversation not found" });

  return res.json({
    phone: convo.phone,
    messages: convo.messages.map((m) => ({ role: m.role, content: m.content, ts: m.ts })),
    updated_at: convo.updated_at,
  });
});

// POST /api/wa-inbox/:phone/reply — send manual reply as Sofia
router.post("/:phone/reply", verifyToken, async (req: Request, res: Response) => {
  const { phone } = req.params;
  const { message } = req.body as { message: string };

  if (!message?.trim()) {
    return res.status(400).json({ message: "message is required" });
  }

  if (!WA_ACCESS_TOKEN) {
    return res.status(503).json({ message: "WA_ACCESS_TOKEN not configured" });
  }

  await axios.post(
    `https://graph.facebook.com/v19.0/${WA_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "text",
      text: { body: message },
    },
    {
      headers: {
        Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  await WAConversation.findOneAndUpdate(
    { phone },
    {
      $push: { messages: { role: "assistant", content: message, ts: new Date() } },
      $set: { updated_at: new Date() },
    },
    { upsert: true }
  );

  return res.json({ ok: true });
});

export default router;
