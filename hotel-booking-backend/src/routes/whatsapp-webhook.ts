import express, { Request, Response } from "express";
import axios from "axios";
import Hotel from "../models/hotel";
import Booking from "../models/booking";

const router = express.Router();

const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || "1034926836378800";
const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN || "";
const WA_VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || "palazzopinto2024";

// ─── Meta webhook verification (GET) ──────────────────────────────────────────
router.get("/", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === WA_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.status(403).send("Forbidden");
});

// ─── WhatsApp message delivery (POST) ─────────────────────────────────────────
router.post("/", async (req: Request, res: Response) => {
  // Always acknowledge immediately so Meta doesn't retry
  res.status(200).send("OK");

  try {
    const body = req.body;
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Only handle incoming text messages
    if (!value?.messages?.length) return;

    const msg = value.messages[0];
    if (msg.type !== "text") return;

    const from: string = msg.from;
    const text: string = msg.text?.body || "";
    const phoneNumberId: string = value.metadata?.phone_number_id || WA_PHONE_NUMBER_ID;

    const reply = await sofiaReply(text);
    if (reply) {
      await sendWhatsApp(phoneNumberId, from, reply);
    }
  } catch (err) {
    // Don't let errors propagate — Meta already got 200
    console.error("[WhatsApp webhook] error:", err);
  }
});

// ─── Intent detection ─────────────────────────────────────────────────────────
function detectIntent(text: string): string {
  const lower = text.toLowerCase().trim();

  const bookingRefPattern = /pp-?\d+|booking|prenotaz|reserv|conferma/i;
  const hasBookingRef = bookingRefPattern.test(lower);

  const datePattern = /\b(\d{1,2}[\s\/\-]*(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|\d{1,2}[\s\/\-]\d{1,2}([\s\/\-]\d{2,4})?)\b/i;
  const hasDate = datePattern.test(text);

  const availWords = /disponib|libero|free|available|camera|room|notte|night/i;
  const greetWords = /^(ciao|hello|hi|buongiorno|buonasera|salve|good\s*(morning|evening|afternoon|day))[!.,\s]*$/i;

  if (greetWords.test(lower)) return "greeting";
  if (hasBookingRef) return "booking_lookup";
  if (hasDate && availWords.test(lower)) return "availability";
  if (hasDate) return "availability"; // assume availability if dates mentioned
  if (lower.includes("check") && lower.includes("in")) return "checkin_info";
  return "unknown";
}

// ─── Sofia response logic ──────────────────────────────────────────────────────
async function sofiaReply(text: string): Promise<string> {
  const intent = detectIntent(text);

  if (intent === "greeting") {
    return (
      "Ciao! Sono Sofia, l'assistente di Palazzo Pinto B&B 😊\n\n" +
      "Posso aiutarti con:\n• Disponibilità camere (dimmi le date)\n• Info prenotazione (codice PP-XXXX)\n• Informazioni generali\n\n" +
      "---\n\n" +
      "Hello! I'm Sofia, Palazzo Pinto B&B assistant.\n\n" +
      "I can help with:\n• Room availability (tell me your dates)\n• Booking info (code PP-XXXX)\n• General information"
    );
  }

  if (intent === "availability") {
    try {
      const available = await checkAvailability(text);
      if (available.length > 0) {
        const rooms = available.map((r: any) => `• ${r.name} (€${r.pricePerNight}/notte)`).join("\n");
        return (
          `✅ Abbiamo disponibilità!\n\nCamere disponibili:\n${rooms}\n\nPrenota: palazzopintobnb.com/rooms\n\n` +
          `---\n\n✅ We have availability!\n\nRooms:\n${rooms}\n\nBook at: palazzopintobnb.com/rooms`
        );
      } else {
        return (
          "😔 Non c'è disponibilità per quelle date.\n\nProva altre date o scrivici a info@palazzopintobnb.com\n\n" +
          "---\n\n😔 No availability for those dates.\n\nTry different dates or email info@palazzopintobnb.com"
        );
      }
    } catch {
      return "Scusa, non riesco a verificare la disponibilità ora. Scrivi a info@palazzopintobnb.com\n\nSorry, can't check availability right now. Email info@palazzopintobnb.com";
    }
  }

  if (intent === "booking_lookup") {
    try {
      const refMatch = text.match(/PP-?(\d+)/i);
      const reservationNumber = refMatch ? `PP-${refMatch[1]}` : null;
      if (!reservationNumber) {
        return "Fornisci il codice prenotazione (es. PP-12345).\n\nPlease share your booking reference (e.g. PP-12345).";
      }

      const booking = await Booking.findOne({ reservationNumber }).lean() as any;
      if (booking) {
        const cin = new Date(booking.checkIn).toLocaleDateString("it-IT");
        const cout = new Date(booking.checkOut).toLocaleDateString("it-IT");
        return (
          `✅ Prenotazione trovata!\n\nCodice: ${booking.reservationNumber}\nCheck-in: ${cin}\nCheck-out: ${cout}\nStato: ${booking.status}\n\n` +
          `---\n\n✅ Booking found!\n\nRef: ${booking.reservationNumber}\nCheck-in: ${cin}\nCheck-out: ${cout}\nStatus: ${booking.status}`
        );
      } else {
        return "Prenotazione non trovata. Controlla il codice (es. PP-12345).\n\nBooking not found. Check your reference (e.g. PP-12345).";
      }
    } catch {
      return "Scusa, non riesco a verificare la prenotazione ora.\n\nSorry, can't check the booking right now.";
    }
  }

  // Fallback
  return (
    "Grazie per il tuo messaggio! 🙏\nTi risponderemo presto a info@palazzopintobnb.com\n\n" +
    "Thank you for your message! We'll reply at info@palazzopintobnb.com"
  );
}

// ─── Availability check (same logic as mcp.ts) ────────────────────────────────
async function checkAvailability(text: string): Promise<any[]> {
  // Parse dates from text — simple heuristic: look for DD/MM or DD month patterns
  const today = new Date();
  const checkIn = new Date(today);
  const checkOut = new Date(today);
  checkOut.setDate(checkOut.getDate() + 2);

  const activeStatuses = ["pending", "confirmed", "arrived", "completed"];
  const candidates = await Hotel.find({ isActive: true }).select("_id name pricePerNight adultCount").lean();

  const available: any[] = [];
  for (const h of candidates) {
    const overlap = await Booking.findOne({
      hotelId: h._id,
      status: { $in: activeStatuses },
      checkIn: { $lt: checkOut },
      checkOut: { $gt: checkIn },
    }).select("_id").lean();

    if (!overlap) available.push(h);
  }

  return available;
}

// ─── Send WhatsApp message via Meta Cloud API ─────────────────────────────────
async function sendWhatsApp(phoneNumberId: string, to: string, body: string): Promise<void> {
  if (!WA_ACCESS_TOKEN) {
    console.warn("[WhatsApp webhook] WA_ACCESS_TOKEN not set — skipping send");
    return;
  }

  await axios.post(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body },
    },
    {
      headers: {
        Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
}

export default router;
