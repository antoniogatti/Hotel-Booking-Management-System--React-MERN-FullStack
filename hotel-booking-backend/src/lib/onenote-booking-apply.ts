import { ParsedOneNoteBooking } from "./onenote-booking-parser";

export type OneNoteMatchedPage = {
  pageId: string;
  title?: string;
  sectionName?: string;
  parsed: ParsedOneNoteBooking;
};

type OneNoteSyncRecord = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  nationality?: string;
  adultCount?: number;
  childCount?: number;
  checkInInfo?: {
    arrivalTime?: string;
    phone?: string;
    email?: string;
    nationality?: string;
    bookingChannel?: string;
    paymentDetails?: string;
    specialNotes?: string;
    breakfast?: {
      time?: string;
      savouryCount?: number;
      sweetCount?: number;
    };
    documents?: string[];
    cityTax?: number;
    checkedInAt?: Date;
  };
  oneNoteSync?: Record<string, unknown>;
};

export const splitGuestName = (guestName?: string) => {
  const parts = String(guestName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
};

export const applyOneNoteSyncToRecord = (params: {
  record: OneNoteSyncRecord;
  matchedPage: OneNoteMatchedPage;
  guestName: {
    firstName: string;
    lastName: string;
  };
  fallback: {
    phone?: string;
    email?: string;
    nationality?: string;
  };
}) => {
  const { record, matchedPage, guestName, fallback } = params;
  const parsed = matchedPage.parsed;
  const existingCheckInInfo =
    record.checkInInfo && typeof (record.checkInInfo as { toObject?: () => Record<string, unknown> }).toObject === "function"
      ? (record.checkInInfo as { toObject: () => Record<string, unknown> }).toObject()
      : (record.checkInInfo || {});

  if (guestName.firstName) {
    record.firstName = guestName.firstName;
  }
  if (guestName.lastName) {
    record.lastName = guestName.lastName;
  }
  if (parsed.phone) {
    record.phone = parsed.phone;
  }
  if (parsed.nationality) {
    record.nationality = parsed.nationality;
  }
  if (typeof parsed.adults === "number") {
    record.adultCount = parsed.adults;
  }
  if (typeof parsed.children === "number") {
    record.childCount = parsed.children;
  }

  const nextCheckInInfo: Record<string, unknown> = {
    ...existingCheckInInfo,
    arrivalTime: parsed.arrivalNote || existingCheckInInfo.arrivalTime || "",
    phone: parsed.phone || existingCheckInInfo.phone || fallback.phone || "",
    email: existingCheckInInfo.email || fallback.email || "",
    nationality: parsed.nationality || existingCheckInInfo.nationality || fallback.nationality || "",
    bookingChannel: parsed.bookingSource || existingCheckInInfo.bookingChannel || "",
    paymentDetails: parsed.paymentNote || existingCheckInInfo.paymentDetails || "",
    specialNotes: existingCheckInInfo.specialNotes || "",
    documents: Array.isArray(existingCheckInInfo.documents) ? existingCheckInInfo.documents : [],
    cityTax: typeof existingCheckInInfo.cityTax === "number" ? existingCheckInInfo.cityTax : 0,
  };

  if (existingCheckInInfo.breakfast) {
    nextCheckInInfo.breakfast = existingCheckInInfo.breakfast;
  }

  if (existingCheckInInfo.checkedInAt) {
    nextCheckInInfo.checkedInAt = existingCheckInInfo.checkedInAt;
  }

  record.checkInInfo = nextCheckInInfo as typeof record.checkInInfo;

  record.oneNoteSync = {
    lastSyncedAt: new Date(),
    matchedPageId: matchedPage.pageId,
    matchedPageTitle: matchedPage.title,
    matchedSectionName: matchedPage.sectionName,
    room: parsed.room,
    guestName: parsed.guestName,
    arrivalNote: parsed.arrivalNote,
    nationality: parsed.nationality,
    phone: parsed.phone,
    whatsapp: parsed.whatsapp,
    nights: parsed.nights,
    checkOutNote: parsed.checkOutNote,
    bookingSource: parsed.bookingSource,
    paymentNote: parsed.paymentNote,
    amountDueEUR: parsed.amountDueEUR,
    notes: parsed.notes,
    rawLines: parsed.rawLines,
  };
};