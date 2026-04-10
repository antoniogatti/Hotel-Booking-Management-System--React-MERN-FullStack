const workbookDriveId = process.env.MS_BOOKINGS_EXCEL_DRIVE_ID;
const workbookItemId = process.env.MS_BOOKINGS_EXCEL_ITEM_ID;
const workbookWorksheetName = process.env.MS_BOOKINGS_EXCEL_SHEET_NAME || "Ricavi";

type RevenueRow = {
  rowNumber: number;
  guestName: string;
  room: string;
  date: string;
  country: string;
  city: string;
  pax?: number;
  totalPrice?: number;
  unitPrice?: number;
  netPrice?: number;
  paymentVia: string;
  invoiceNumber: string;
  identifier: string;
  raw: Record<string, string | number | null>;
};

const normalizeText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();

const normalizeRoom = (value: unknown) => normalizeText(value).replace(/\s+/g, "");

const toNumber = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  const normalized = String(value || "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const excelSerialToIsoDate = (value: number) => {
  const utcDays = Math.floor(value - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000).toISOString().slice(0, 10);
};

const normalizeDate = (value: unknown) => {
  if (typeof value === "number") {
    return excelSerialToIsoDate(value);
  }

  const asNumber = toNumber(value);
  if (typeof asNumber === "number" && /^\d+(?:\.\d+)?$/.test(String(value || "").trim())) {
    return excelSerialToIsoDate(asNumber);
  }

  const parsed = new Date(String(value || ""));
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return "";
};

const splitGuestName = (value: string) => {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" ") || parts[0],
  };
};

const getCanonicalRoomName = (hotel: { name?: string; slug?: string }) => {
  const slug = normalizeRoom(hotel.slug || "");
  if (slug) {
    return slug;
  }

  const hotelName = normalizeRoom(hotel.name || "");
  for (const roomName of ["malvasia", "verdeca", "aleatico", "fuocorosa"]) {
    if (hotelName.includes(roomName)) {
      return roomName;
    }
  }

  return hotelName;
};

const graphGet = async (accessToken: string, path: string) => {
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || "Graph request failed");
  }

  return data;
};

const getWorksheetValues = async (accessToken: string) => {
  if (!workbookDriveId || !workbookItemId) {
    throw new Error("Excel workbook is not configured. Set MS_BOOKINGS_EXCEL_DRIVE_ID and MS_BOOKINGS_EXCEL_ITEM_ID.");
  }

  const worksheetPath = `/drives/${encodeURIComponent(
    workbookDriveId
  )}/items/${encodeURIComponent(
    workbookItemId
  )}/workbook/worksheets('${encodeURIComponent(workbookWorksheetName)}')/usedRange(valuesOnly=true)?$select=values`;

  const payload = await graphGet(accessToken, worksheetPath);
  return Array.isArray(payload?.values) ? payload.values : [];
};

const mapRevenueRows = (rows: unknown[][]): RevenueRow[] => {
  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((header) => String(header || "").trim());

  return rows.slice(1).map((row, index) => {
    const raw = headers.reduce<Record<string, string | number | null>>((acc, header, headerIndex) => {
      const cellValue = row?.[headerIndex];
      acc[header] = cellValue == null ? null : (cellValue as string | number);
      return acc;
    }, {});

    return {
      rowNumber: index + 2,
      guestName: String(raw["NOME OSPITE"] || "").trim(),
      room: String(raw["Camera"] || "").trim(),
      date: normalizeDate(raw["Data"]),
      country: String(raw["Paese"] || "").trim(),
      city: String(raw["Città"] || raw["Citta"] || "").trim(),
      pax: toNumber(raw["PAX"]),
      totalPrice: toNumber(raw["Prezzo Totale"]),
      unitPrice: toNumber(raw["Prezzo Unità"] || raw["Prezzo Unita"]),
      netPrice: toNumber(raw["Prezzo no tass sog"]),
      paymentVia: String(raw["Pagamento via"] || "").trim(),
      invoiceNumber: String(raw["Fattura Num"] || "").trim(),
      identifier: String(raw["Identificativo"] || "").trim(),
      raw,
    };
  });
};

export const syncBookingFromExcel = async (params: {
  accessToken: string;
  booking: {
    firstName: string;
    lastName: string;
    checkIn: Date;
  };
  hotel: {
    name?: string;
    slug?: string;
  };
}) => {
  const sheetRows = mapRevenueRows(await getWorksheetValues(params.accessToken));
  const bookingDate = new Date(params.booking.checkIn).toISOString().slice(0, 10);
  const bookingRoom = getCanonicalRoomName(params.hotel);
  const matchingRows = sheetRows.filter(
    (row) => normalizeRoom(row.room) === bookingRoom && row.date === bookingDate
  );

  if (matchingRows.length === 0) {
    return {
      matched: false,
      reason: `No Excel row matched room ${bookingRoom || "unknown"} and date ${bookingDate}`,
    };
  }

  const normalizedGuestName = normalizeText(
    `${params.booking.firstName || ""} ${params.booking.lastName || ""}`
  );
  const exactGuestMatch = matchingRows.find(
    (row) => normalizeText(row.guestName) === normalizedGuestName
  );

  if (matchingRows.length > 1 && !exactGuestMatch) {
    return {
      matched: false,
      reason: "Multiple Excel rows matched this booking. Guest name disambiguation is required.",
      candidates: matchingRows.map((row) => ({
        rowNumber: row.rowNumber,
        guestName: row.guestName,
        paymentVia: row.paymentVia,
        totalPrice: row.totalPrice,
      })),
    };
  }

  const row = exactGuestMatch || matchingRows[0];
  const guestName = splitGuestName(row.guestName);

  return {
    matched: true,
    row,
    guestName,
    workbook: {
      driveId: workbookDriveId,
      itemId: workbookItemId,
      sheetName: workbookWorksheetName,
    },
  };
};