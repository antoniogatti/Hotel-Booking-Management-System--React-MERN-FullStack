import express, { NextFunction, Request, RequestHandler, Response } from "express";
import axios from "axios";
import verifyToken from "../middleware/auth";
import WAConversation from "../models/wa-conversation";
import WAContact from "../models/wa-contact";

const router = express.Router();

const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN || "";
const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || "1373088652564505";

const DEFAULT_LIST_LIMIT = 20;
const DEFAULT_THREAD_LIMIT = 30;
const MAX_LIMIT = 100;

const safe =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch((err) => {
      // 422 (not 5xx) so a rejected send is shown to the admin rather than looking like an outage
      if (err instanceof WASendError && !res.headersSent) return res.status(422).json({ message: err.message });
      console.error("[wa-inbox] handler error:", err);
      if (!res.headersSent) res.status(500).json({ message: "Something went wrong" });
      else next(err);
    });
  };

const intParam = (value: unknown, fallback: number, min: number, max: number) => {
  const n = parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
};

// A send failure whose message is safe to show to the admin in the inbox.
class WASendError extends Error {}

function explainSendError(err: unknown): string {
  const meta = axios.isAxiosError(err) ? err.response?.data?.error : undefined;
  switch (meta?.code) {
    case 131047:
      return "WhatsApp only allows free-form replies within 24h of the guest's last message, and that window has closed.";
    case 131030:
      return "This number is not on the allowed recipient list of the WhatsApp test account.";
    case 190:
      return "The WhatsApp access token is invalid or has expired.";
  }
  return meta?.message ?? (err instanceof Error ? err.message : "Could not send the message");
}

async function sendWhatsAppMsg(to: string, body: string): Promise<string | null> {
  if (!WA_ACCESS_TOKEN) throw new WASendError("WA_ACCESS_TOKEN is not configured on the server.");
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v19.0/${WA_PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body } },
      { headers: { Authorization: `Bearer ${WA_ACCESS_TOKEN}`, "Content-Type": "application/json" } }
    );
    return (res.data?.messages?.[0]?.id as string) ?? null;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error("[wa-inbox] Meta send failed:", err.response?.status, JSON.stringify(err.response?.data));
    }
    throw new WASendError(explainSendError(err));
  }
}

// ─── Contacts (registered BEFORE /:phone to avoid routing conflicts) ──────────

router.get(
  "/contacts",
  verifyToken,
  safe(async (_req, res) => {
    const contacts = await WAContact.find({}).sort({ name: 1 }).lean();
    return res.json(contacts.map((c) => ({ phone: c.phone, name: c.name, notes: c.notes })));
  })
);

router.post(
  "/contacts",
  verifyToken,
  safe(async (req, res) => {
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
  })
);

// ─── Media proxy (audio voice notes from Meta) ────────────────────────────────

router.get(
  "/media/:mediaId",
  verifyToken,
  safe(async (req, res) => {
    const { mediaId } = req.params;
    if (!WA_ACCESS_TOKEN) return res.status(500).json({ message: "WA token not configured" });
    // Step 1: resolve the temporary download URL from Meta
    const metaRes = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${WA_ACCESS_TOKEN}` },
    });
    const url: string = metaRes.data.url;
    const mimeType: string = (metaRes.data.mime_type as string) || "audio/ogg";
    // Step 2: stream the audio to the browser
    const audioRes = await axios.get<NodeJS.ReadableStream>(url, {
      headers: { Authorization: `Bearer ${WA_ACCESS_TOKEN}` },
      responseType: "stream",
    });
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    audioRes.data.pipe(res);
    return;
  })
);

// ─── Conversations list ────────────────────────────────────────────────────────

router.get(
  "/",
  verifyToken,
  safe(async (req, res) => {
    const limit = intParam(req.query.limit, DEFAULT_LIST_LIMIT, 1, MAX_LIMIT);
    const skip = intParam(req.query.skip, 0, 0, 100_000);

    const [rows, total] = await Promise.all([
      WAConversation.aggregate<{
        phone: string;
        updated_at: Date;
        adminReadAt?: Date;
        messageCount: number;
        auto: boolean;
        hasPending: boolean;
        lastMessage?: { role: "user" | "assistant"; content: string; ts: Date };
      }>([
        { $sort: { updated_at: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            phone: 1,
            updated_at: 1,
            adminReadAt: 1,
            auto: { $ifNull: ["$auto", false] },
            hasPending: { $cond: [{ $ifNull: ["$pendingReply", false] }, true, false] },
            messageCount: { $size: { $ifNull: ["$messages", []] } },
            lastMessage: { $arrayElemAt: ["$messages", -1] },
          },
        },
      ]),
      WAConversation.estimatedDocumentCount(),
    ]);

    const contacts = await WAContact.find({ phone: { $in: rows.map((r) => r.phone) } }, { phone: 1, name: 1 }).lean();
    const nameByPhone = new Map(contacts.map((c) => [c.phone, c.name]));

    const conversations = rows.map((r) => {
      const lastMsg = r.lastMessage;
      const unread =
        lastMsg?.role === "user" &&
        (!r.adminReadAt || new Date(r.updated_at) > new Date(r.adminReadAt));
      return {
        phone: r.phone,
        name: nameByPhone.get(r.phone),
        auto: r.auto,
        hasPending: r.hasPending,
        unread,
        lastMessage: lastMsg
          ? { role: lastMsg.role, content: lastMsg.content, ts: lastMsg.ts }
          : null,
        updated_at: r.updated_at,
        messageCount: r.messageCount,
      };
    });

    return res.json({ conversations, total, hasMore: skip + rows.length < total });
  })
);

// ─── Thread ────────────────────────────────────────────────────────────────────

router.get(
  "/:phone",
  verifyToken,
  safe(async (req, res) => {
    const { phone } = req.params;
    const limit = intParam(req.query.limit, DEFAULT_THREAD_LIMIT, 1, MAX_LIMIT);

    const meta = await WAConversation.aggregate<{
      total: number;
      updated_at: Date;
      auto: boolean;
      pendingReply?: { inReplyTo: string; suggestions: string[]; createdAt: Date };
    }>([
      { $match: { phone } },
      {
        $project: {
          _id: 0,
          updated_at: 1,
          auto: { $ifNull: ["$auto", false] },
          pendingReply: 1,
          total: { $size: { $ifNull: ["$messages", []] } },
        },
      },
    ]);

    if (meta.length === 0) {
      // Return empty thread for new conversations (e.g. started from admin)
      return res.json({ phone, auto: false, messages: [], start: 0, total: 0, updated_at: new Date() });
    }

    const { total, updated_at, auto, pendingReply } = meta[0];

    let start: number;
    let count: number;
    if (req.query.after !== undefined) {
      start = intParam(req.query.after, total, 0, total);
      count = Math.min(total - start, MAX_LIMIT * 5);
    } else {
      const end = req.query.before !== undefined ? intParam(req.query.before, total, 0, total) : total;
      start = Math.max(0, end - limit);
      count = end - start;
    }

    let messages: Array<{ role: string; content: string; ts: Date; source?: string; messageId?: string; status?: string }> = [];
    if (count > 0) {
      const doc = await WAConversation.findOne({ phone }, { messages: { $slice: [start, count] } }).lean();
      messages = (doc?.messages ?? []).map((m) => ({
        role: m.role,
        content: m.content,
        ts: m.ts,
        ...(m.source ? { source: m.source } : {}),
        ...(m.messageId ? { messageId: m.messageId } : {}),
        ...(m.status ? { status: m.status } : {}),
      }));
    }

    const contact = await WAContact.findOne({ phone }, { name: 1 }).lean();

    // Mark as read (fire-and-forget)
    void WAConversation.updateOne({ phone }, { $set: { adminReadAt: new Date() } });

    return res.json({
      phone,
      name: contact?.name,
      auto,
      messages,
      start,
      total,
      updated_at,
      ...(pendingReply ? { pendingReply } : {}),
    });
  })
);

// ─── Mark conversation as read ─────────────────────────────────────────────────

router.post(
  "/:phone/read",
  verifyToken,
  safe(async (req, res) => {
    const { phone } = req.params;
    await WAConversation.updateOne({ phone }, { $set: { adminReadAt: new Date() } });
    return res.json({ ok: true });
  })
);

// ─── Toggle auto mode ──────────────────────────────────────────────────────────

router.patch(
  "/:phone/auto",
  verifyToken,
  safe(async (req, res) => {
    const { phone } = req.params;
    const { auto } = req.body as { auto: boolean };
    if (typeof auto !== "boolean") return res.status(400).json({ message: "auto must be a boolean" });
    await WAConversation.findOneAndUpdate({ phone }, { $set: { auto } }, { upsert: true });
    return res.json({ ok: true, auto });
  })
);

// ─── Approve pending reply ─────────────────────────────────────────────────────

router.post(
  "/:phone/approve",
  verifyToken,
  safe(async (req, res) => {
    const { phone } = req.params;
    const { text } = req.body as { text: string };
    if (!text?.trim()) return res.status(400).json({ message: "text is required" });

    const approveId = await sendWhatsAppMsg(phone, text.trim());

    await WAConversation.findOneAndUpdate(
      { phone },
      {
        $push: {
          messages: {
            role: "assistant",
            content: text.trim(),
            ts: new Date(),
            source: "approved_ai",
            ...(approveId ? { messageId: approveId, status: "sent" } : {}),
          },
        },
        $unset: { pendingReply: 1 },
        $set: { updated_at: new Date() },
      },
      { upsert: true }
    );

    return res.json({ ok: true });
  })
);

// ─── Dismiss pending reply ─────────────────────────────────────────────────────

router.delete(
  "/:phone/pending",
  verifyToken,
  safe(async (req, res) => {
    const { phone } = req.params;
    await WAConversation.findOneAndUpdate({ phone }, { $unset: { pendingReply: 1 } });
    return res.json({ ok: true });
  })
);

// ─── Manual reply from admin ───────────────────────────────────────────────────

router.post(
  "/:phone/reply",
  verifyToken,
  safe(async (req, res) => {
    const { phone } = req.params;
    const { message } = req.body as { message: string };

    if (!message?.trim()) return res.status(400).json({ message: "message is required" });

    const replyId = await sendWhatsAppMsg(phone, message.trim());

    await WAConversation.findOneAndUpdate(
      { phone },
      {
        $push: {
          messages: {
            role: "assistant",
            content: message.trim(),
            ts: new Date(),
            source: "manual",
            ...(replyId ? { messageId: replyId, status: "sent" } : {}),
          },
        },
        $unset: { pendingReply: 1 },
        $set: { updated_at: new Date() },
      },
      { upsert: true }
    );

    return res.json({ ok: true });
  })
);

export default router;
