import {
  getOneNotePageContent,
  listPrenotazioniPages,
} from "./onenote-service";
import {
  extractPlainTextLinesFromOneNoteHtml,
  ParsedOneNoteBooking,
  parseOneNoteBookingPage,
} from "./onenote-booking-parser";
import { extractBookingDataWithAzureOpenAI } from "./azure-openai-booking-extractor";

type SyncBookingTarget = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  adultCount?: number;
  childCount?: number;
  checkIn: Date | string;
  checkOut: Date | string;
};

type SyncHotelTarget = {
  name?: string;
  slug?: string;
};

type ParsedPrenotazioniPage = {
  pageId: string;
  title?: string;
  sectionName?: string;
  parsed: ParsedOneNoteBooking;
};

const BATCH_SIZE = 5;

const mergeParsedBooking = (preferred: ParsedOneNoteBooking, fallback: ParsedOneNoteBooking): ParsedOneNoteBooking => ({
  room: preferred.room || fallback.room,
  guestName: preferred.guestName || fallback.guestName,
  arrivalNote: preferred.arrivalNote || fallback.arrivalNote,
  adults: typeof preferred.adults === "number" ? preferred.adults : fallback.adults,
  children: typeof preferred.children === "number" ? preferred.children : fallback.children,
  childDetails: preferred.childDetails || fallback.childDetails,
  nationality: preferred.nationality || fallback.nationality,
  phone: preferred.phone || fallback.phone,
  whatsapp: preferred.whatsapp || fallback.whatsapp,
  nights: typeof preferred.nights === "number" ? preferred.nights : fallback.nights,
  checkOutNote: preferred.checkOutNote || fallback.checkOutNote,
  bookingSource: preferred.bookingSource || fallback.bookingSource,
  paymentNote: preferred.paymentNote || fallback.paymentNote,
  amountDueEUR:
    typeof preferred.amountDueEUR === "number" ? preferred.amountDueEUR : fallback.amountDueEUR,
  notes: preferred.notes || fallback.notes,
  dateRange: preferred.dateRange?.checkInDate || preferred.dateRange?.checkOutDate ? preferred.dateRange : fallback.dateRange,
  rawLines: preferred.rawLines.length > 0 ? preferred.rawLines : fallback.rawLines,
});

const normalizeText = (value?: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizePhone = (value?: string) => String(value || "").replace(/\D+/g, "");

const toDateKey = (value: Date | string | undefined) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const getGuestFullName = (booking: SyncBookingTarget) =>
  normalizeText(`${booking.firstName || ""} ${booking.lastName || ""}`);

const getRoomToken = (hotel: SyncHotelTarget) => normalizeText(hotel.slug || hotel.name);

const fetchParsedPages = async (accessToken: string) => {
  const { sections, pages } = await listPrenotazioniPages(accessToken);
  const parsedPages: ParsedPrenotazioniPage[] = [];

  for (let index = 0; index < pages.length; index += BATCH_SIZE) {
    const batch = pages.slice(index, index + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (page) => {
        try {
          const html = await getOneNotePageContent(accessToken, page.id);
          return {
            pageId: page.id,
            title: page.title,
            sectionName: page.parentSection?.displayName,
            parsed: parseOneNoteBookingPage({
              title: page.title,
              html,
            }),
          } satisfies ParsedPrenotazioniPage;
        } catch {
          return null;
        }
      })
    );

    for (const entry of batchResults) {
      if (entry) {
        parsedPages.push(entry);
      }
    }
  }

  return {
    sectionCount: sections.length,
    parsedPages,
  };
};

const scoreParsedPage = (params: {
  page: ParsedPrenotazioniPage;
  booking: SyncBookingTarget;
  hotel: SyncHotelTarget;
}) => {
  const bookingGuestName = getGuestFullName(params.booking);
  const parsedGuestName = normalizeText(params.page.parsed.guestName);
  const bookingPhone = normalizePhone(params.booking.phone);
  const parsedPhone = normalizePhone(params.page.parsed.phone);
  const roomToken = getRoomToken(params.hotel);
  const parsedRoom = normalizeText(params.page.parsed.room);

  let score = 0;

  if (roomToken && parsedRoom && roomToken === parsedRoom) {
    score += 4;
  }

  if (bookingGuestName && parsedGuestName && bookingGuestName === parsedGuestName) {
    score += 5;
  } else if (
    bookingGuestName &&
    parsedGuestName &&
    (bookingGuestName.includes(parsedGuestName) || parsedGuestName.includes(bookingGuestName))
  ) {
    score += 2;
  }

  if (bookingPhone && parsedPhone && bookingPhone === parsedPhone) {
    score += 2;
  }

  if (
    typeof params.booking.adultCount === "number" &&
    typeof params.page.parsed.adults === "number" &&
    params.booking.adultCount === params.page.parsed.adults
  ) {
    score += 1;
  }

  if (
    typeof params.booking.childCount === "number" &&
    typeof params.page.parsed.children === "number" &&
    params.booking.childCount === params.page.parsed.children
  ) {
    score += 1;
  }

  return score;
};

const splitGuestName = (guestName?: string) => {
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

const enhanceMatchedPageWithAzureOpenAI = async (params: {
  accessToken: string;
  page: ParsedPrenotazioniPage;
}) => {
  try {
    const html = await getOneNotePageContent(params.accessToken, params.page.pageId);
    const text = extractPlainTextLinesFromOneNoteHtml(html).join("\n");
    if (!text.trim()) {
      return params.page;
    }

    const aiParsed = await extractBookingDataWithAzureOpenAI({
      text,
      pageTitle: params.page.title,
    });

    return {
      ...params.page,
      parsed: mergeParsedBooking(aiParsed, params.page.parsed),
    } satisfies ParsedPrenotazioniPage;
  } catch {
    return params.page;
  }
};

export const syncBookingFromOneNote = async (params: {
  accessToken: string;
  booking: SyncBookingTarget;
  hotel: SyncHotelTarget;
}) => {
  const { parsedPages, sectionCount } = await fetchParsedPages(params.accessToken);
  const targetCheckIn = toDateKey(params.booking.checkIn);
  const targetCheckOut = toDateKey(params.booking.checkOut);

  const exactDateMatches = parsedPages.filter((page) => {
    const parsedCheckIn = toDateKey(page.parsed.dateRange?.checkInDate);
    const parsedCheckOut = toDateKey(page.parsed.dateRange?.checkOutDate);
    return parsedCheckIn === targetCheckIn && parsedCheckOut === targetCheckOut;
  });

  if (exactDateMatches.length === 0) {
    return {
      matched: false as const,
      reason: `No OneNote page matched dates ${targetCheckIn || "unknown"} to ${targetCheckOut || "unknown"}`,
      pageCount: parsedPages.length,
      sectionCount,
    };
  }

  if (exactDateMatches.length === 1) {
    const matchedPage = await enhanceMatchedPageWithAzureOpenAI({
      accessToken: params.accessToken,
      page: exactDateMatches[0],
    });
    return {
      matched: true as const,
      pageCount: parsedPages.length,
      sectionCount,
      page: matchedPage,
      guestName: splitGuestName(matchedPage.parsed.guestName),
    };
  }

  const rankedMatches = exactDateMatches
    .map((page) => ({
      page,
      score: scoreParsedPage({
        page,
        booking: params.booking,
        hotel: params.hotel,
      }),
    }))
    .sort((left, right) => right.score - left.score);

  const [bestMatch, secondBestMatch] = rankedMatches;
  if (!bestMatch || bestMatch.score <= 0) {
    return {
      matched: false as const,
      reason: "Multiple OneNote pages matched the booking dates, but none could be confidently identified.",
      pageCount: parsedPages.length,
      sectionCount,
      candidates: exactDateMatches.map((page) => page.title || page.pageId),
    };
  }

  if (secondBestMatch && secondBestMatch.score === bestMatch.score) {
    return {
      matched: false as const,
      reason: "Multiple OneNote pages matched this booking equally. Manual review is required.",
      pageCount: parsedPages.length,
      sectionCount,
      candidates: rankedMatches.slice(0, 3).map((entry) => ({
        title: entry.page.title,
        score: entry.score,
      })),
    };
  }

  const enhancedBestMatch = await enhanceMatchedPageWithAzureOpenAI({
    accessToken: params.accessToken,
    page: bestMatch.page,
  });

  return {
    matched: true as const,
    pageCount: parsedPages.length,
    sectionCount,
    page: enhancedBestMatch,
    guestName: splitGuestName(enhancedBestMatch.parsed.guestName),
  };
};