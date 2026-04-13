import { AzureOpenAI } from "openai";
import type { ParsedOneNoteBooking } from "./onenote-booking-parser";

const DEFAULT_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";

const DEFAULT_BOOKING_SYSTEM_PROMPT = [
  "You extract structured hotel booking data from a OneNote booking note.",
  "Return only valid JSON with no markdown, no prose, and no code fences.",
  "Do not invent facts. If a field is missing, return null for that field.",
  "Keep original guest names, payment notes, and operational notes in their original language.",
  "Use this exact JSON shape:",
  "{",
  '  "room": string | null,',
  '  "guestName": string | null,',
  '  "arrivalNote": string | null,',
  '  "adults": number | null,',
  '  "children": number | null,',
  '  "childDetails": string | null,',
  '  "nationality": string | null,',
  '  "phone": string | null,',
  '  "whatsapp": string | null,',
  '  "nights": number | null,',
  '  "checkOutNote": string | null,',
  '  "bookingSource": string | null,',
  '  "paymentNote": string | null,',
  '  "amountDueEUR": number | null,',
  '  "notes": string | null,',
  '  "dateRange": {',
  '    "checkInDate": string | null,',
  '    "checkOutDate": string | null,',
  '    "year": number | null,',
  '    "month": number | null,',
  '    "startDay": number | null,',
  '    "endDay": number | null',
  "  },",
  '  "rawLines": string[]',
  "}",
  "notes must contain only unmatched operational notes that do not map to another field.",
  "rawLines must be an array of cleaned text lines from the booking note.",
].join("\n");

const getRequiredEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
};

const getClient = () => {
  const endpoint = getRequiredEnv("AZURE_OPENAI_ENDPOINT");
  const apiKey = getRequiredEnv("AZURE_OPENAI_API_KEY");
  const deployment = getRequiredEnv("AZURE_OPENAI_DEPLOYMENT_NAME");

  return {
    deployment,
    client: new AzureOpenAI({
      endpoint,
      apiKey,
      apiVersion: DEFAULT_API_VERSION,
      deployment,
    }),
  };
};

const extractJsonText = (value: unknown) => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object" && "type" in item && (item as { type?: string }).type === "text") {
          return String((item as { text?: string }).text || "");
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
};

const stripCodeFences = (value: string) =>
  value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

const toOptionalString = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
};

const toOptionalNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = Number(value.replace(/,/g, ".").trim());
    return Number.isFinite(normalized) ? normalized : undefined;
  }

  return undefined;
};

const toStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((entry) => toOptionalString(entry))
    .filter((entry): entry is string => Boolean(entry));
};

const normalizeParsedBooking = (value: unknown, fallbackText: string): ParsedOneNoteBooking => {
  const payload = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const dateRangeValue = payload.dateRange && typeof payload.dateRange === "object"
    ? (payload.dateRange as Record<string, unknown>)
    : {};

  const rawLines = toStringArray(payload.rawLines);

  return {
    room: toOptionalString(payload.room),
    guestName: toOptionalString(payload.guestName),
    arrivalNote: toOptionalString(payload.arrivalNote),
    adults: toOptionalNumber(payload.adults),
    children: toOptionalNumber(payload.children),
    childDetails: toOptionalString(payload.childDetails),
    nationality: toOptionalString(payload.nationality),
    phone: toOptionalString(payload.phone),
    whatsapp: toOptionalString(payload.whatsapp),
    nights: toOptionalNumber(payload.nights),
    checkOutNote: toOptionalString(payload.checkOutNote),
    bookingSource: toOptionalString(payload.bookingSource),
    paymentNote: toOptionalString(payload.paymentNote),
    amountDueEUR: toOptionalNumber(payload.amountDueEUR),
    notes: toOptionalString(payload.notes),
    dateRange: {
      checkInDate: toOptionalString(dateRangeValue.checkInDate),
      checkOutDate: toOptionalString(dateRangeValue.checkOutDate),
      year: toOptionalNumber(dateRangeValue.year),
      month: toOptionalNumber(dateRangeValue.month),
      startDay: toOptionalNumber(dateRangeValue.startDay),
      endDay: toOptionalNumber(dateRangeValue.endDay),
    },
    rawLines:
      rawLines.length > 0
        ? rawLines
        : fallbackText
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean),
  };
};

export const extractBookingDataWithAzureOpenAI = async (params: {
  text: string;
  pageTitle?: string;
  systemPrompt?: string;
}) => {
  const { client, deployment } = getClient();
  const systemPrompt = params.systemPrompt?.trim() || process.env.AZURE_OPENAI_BOOKING_SYSTEM_PROMPT?.trim() || DEFAULT_BOOKING_SYSTEM_PROMPT;
  const userPrompt = [
    params.pageTitle ? `PAGE TITLE: ${params.pageTitle}` : undefined,
    "BOOKING NOTE TEXT:",
    params.text.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await client.chat.completions.create({
    model: deployment,
    max_completion_tokens: 1200,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = stripCodeFences(extractJsonText(response.choices[0]?.message?.content));
  if (!content) {
    throw new Error("Azure OpenAI returned an empty response");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new Error("Azure OpenAI returned invalid JSON");
  }

  return normalizeParsedBooking(parsedJson, params.text);
};