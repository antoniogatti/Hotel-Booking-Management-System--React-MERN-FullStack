type ParsedBookingDateRange = {
  checkInDate?: string;
  checkOutDate?: string;
  year?: number;
  month?: number;
  startDay?: number;
  endDay?: number;
};

export type ParsedOneNoteBooking = {
  room?: string;
  guestName?: string;
  arrivalNote?: string;
  adults?: number;
  children?: number;
  childDetails?: string;
  nationality?: string;
  phone?: string;
  whatsapp?: string;
  nights?: number;
  checkOutNote?: string;
  bookingSource?: string;
  paymentNote?: string;
  amountDueEUR?: number;
  notes?: string;
  dateRange?: ParsedBookingDateRange;
  rawLines: string[];
};

const ITALIAN_MONTHS: Record<string, number> = {
  gennaio: 1,
  febbraio: 2,
  marzo: 3,
  aprile: 4,
  maggio: 5,
  giugno: 6,
  luglio: 7,
  agosto: 8,
  settembre: 9,
  ottobre: 10,
  novembre: 11,
  dicembre: 12,
};

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, codePoint) => {
      const parsedCodePoint = Number.parseInt(codePoint, 10);
      return Number.isFinite(parsedCodePoint) ? String.fromCharCode(parsedCodePoint) : _;
    });

export const extractPlainTextLinesFromOneNoteHtml = (html: string) => {
  const normalized = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li|tr|h\d)>/gi, "\n")
    .replace(/<(li|p|div|tr|h\d)[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(normalized)
    .split(/\r?\n/)
    .map((line) => line.replace(/^[•\-\s]+/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
};

export const parseDateRangeFromTitle = (title?: string): ParsedBookingDateRange | undefined => {
  const match = String(title || "")
    .trim()
    .match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([A-ZÀ-ÿ]+)\s+(\d{4})/i);

  if (!match) {
    return undefined;
  }

  const startDay = Number(match[1]);
  const endDay = Number(match[2]);
  const month = ITALIAN_MONTHS[match[3].toLowerCase()];
  const year = Number(match[4]);

  if (!month || !year || !startDay || !endDay) {
    return undefined;
  }

  const checkInDate = new Date(Date.UTC(year, month - 1, startDay)).toISOString();
  const checkOutDate = new Date(Date.UTC(year, month - 1, endDay)).toISOString();

  return {
    checkInDate,
    checkOutDate,
    year,
    month,
    startDay,
    endDay,
  };
};

const parseAmountDue = (value: string) => {
  const match = value.match(/(\d+(?:[.,]\d+)?)\s*EURO/i);
  if (!match) {
    return undefined;
  }

  return Number(match[1].replace(",", "."));
};

export const parseOneNoteBookingPage = (params: { title?: string; html: string }) => {
  try {
    const rawLines = extractPlainTextLinesFromOneNoteHtml(params.html);
    const parsed: ParsedOneNoteBooking = {
      rawLines,
      dateRange: parseDateRangeFromTitle(params.title),
    };

    const unmatchedLines: string[] = [];

    rawLines.forEach((line) => {
      try {
        if (!parsed.room && /^(ALEATICO|MALVASIA|VERDECA|FUOCOROSA)\b/i.test(line)) {
          parsed.room = line.split(/\s+/)[0].trim();
          return;
        }

        const guestNameMatch = line.match(/^Nome:\s*(.+)$/i);
        if (guestNameMatch) {
          parsed.guestName = guestNameMatch[1].trim();
          return;
        }

        const arrivalMatch = line.match(/^Arrivo\s+previsto:\s*(.+)$/i);
        if (arrivalMatch) {
          parsed.arrivalNote = arrivalMatch[1].trim();
          return;
        }

        const adultsMatch = line.match(/(\d+)\s*ADULT/i);
        const childrenMatch = line.match(/(\d+)\s*BAMBIN/i);
        if (adultsMatch || childrenMatch) {
          parsed.adults = adultsMatch ? Number(adultsMatch[1]) : parsed.adults || 0;
          parsed.children = childrenMatch ? Number(childrenMatch[1]) : parsed.children || 0;
          const childDetailsMatch = line.match(/\(([^)]+)\)/);
          parsed.childDetails = childDetailsMatch ? childDetailsMatch[1].trim() : parsed.childDetails;
          return;
        }

        const nationalityMatch = line.match(/^Nazionalit[àa]\s*:\s*(.+)$/i);
        if (nationalityMatch) {
          parsed.nationality = nationalityMatch[1].trim();
          return;
        }

        const phoneMatch = line.match(/^Telefono:\s*(.+)$/i);
        if (phoneMatch) {
          parsed.phone = phoneMatch[1].trim();
          return;
        }

        const whatsappMatch = line.match(/^Whatsapp\s*:\s*(.+)$/i);
        if (whatsappMatch) {
          parsed.whatsapp = whatsappMatch[1].trim();
          return;
        }

        const nightsMatch = line.match(/(\d+)\s+Nott/i);
        if (nightsMatch) {
          parsed.nights = Number(nightsMatch[1]);
          return;
        }

        const checkoutMatch = line.match(/^CHECK-OUT\s+(.+)$/i);
        if (checkoutMatch) {
          parsed.checkOutNote = checkoutMatch[1].trim();
          return;
        }

        const bookingSourceMatch = line.match(/^PRENOTAZIONE\s+(?:VIA\s+)?([^:]+):\s*(.+)$/i);
        if (bookingSourceMatch) {
          parsed.bookingSource = bookingSourceMatch[1].trim();
          parsed.paymentNote = bookingSourceMatch[2].trim();
          parsed.amountDueEUR = parseAmountDue(bookingSourceMatch[2]);
          return;
        }

        unmatchedLines.push(line);
      } catch {
        unmatchedLines.push(line);
      }
    });

    parsed.notes = unmatchedLines.length > 0 ? unmatchedLines.join("\n") : undefined;
    return parsed;
  } catch {
    return {
      rawLines: [],
      dateRange: parseDateRangeFromTitle(params.title),
      notes: undefined,
    };
  }
};