// Thin client for the Beds24 API v2, the channel manager that carries the Booking.com connection.
//
// Booking.com does not issue direct API credentials to single properties, so reservations are
// read from, and availability is written to, Beds24 which syncs with Booking.com on our behalf.
// Mock mode (BOOKING_COM_API_MODE=mock, the default) returns no reservations and skips pushes.
//
// In the per-room mapping, `propertyId` and `roomId` are the Beds24 property and room IDs.

export type BookingComApiReservation = {
  reservationId: string;
  propertyId: string;
  status: "new" | "modified" | "cancelled";
  roomId: string;
  arrivalDate: string; // YYYY-MM-DD
  departureDate: string; // YYYY-MM-DD
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  guestCount: number;
  totalPrice: number;
  currency: string;
  remarks: string;
  country: string;
  city: string;
  channel: string;
  bookedAt?: string;
};

export type BookingComAriDay = {
  date: string; // YYYY-MM-DD
  roomsToSell: number;
  price?: number;
};

export type BookingComApiMode = "mock" | "live";

const BEDS24_BASE_URL = "https://beds24.com/api/v2";
const BOOKING_STATUSES = ["confirmed", "request", "new", "black", "inquiry", "cancelled"];
const MAX_PAGES = 20;

export const getBookingComApiMode = (): BookingComApiMode =>
  String(process.env.BOOKING_COM_API_MODE || "mock").toLowerCase() === "live" ? "live" : "mock";

let cachedToken: { value: string; expiresAt: number } | null = null;

const getAccessToken = async () => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const refreshToken = process.env.BEDS24_REFRESH_TOKEN?.trim();

  if (!refreshToken) {
    throw new Error("BEDS24_REFRESH_TOKEN is required when BOOKING_COM_API_MODE=live");
  }

  const response = await fetch(`${BEDS24_BASE_URL}/authentication/token`, {
    headers: { refreshToken },
  });

  if (!response.ok) {
    throw new Error(`Beds24 authentication failed with status ${response.status}`);
  }

  const body = (await response.json()) as { token?: string; expiresIn?: number };

  if (!body.token) {
    throw new Error("Beds24 authentication returned no token");
  }

  cachedToken = { value: body.token, expiresAt: Date.now() + (body.expiresIn || 3600) * 1000 };
  return body.token;
};

const text = (value: unknown) =>
  value === undefined || value === null ? "" : String(value).trim();

const normalizeStatus = (booking: any): BookingComApiReservation["status"] => {
  if (text(booking.status) === "cancelled") return "cancelled";
  return "new";
};

export const mapBeds24Booking = (booking: any): BookingComApiReservation | null => {
  const reservationId = text(booking?.id);

  if (!reservationId || !booking?.arrival || !booking?.departure) {
    return null;
  }

  return {
    reservationId,
    propertyId: text(booking.propertyId),
    status: normalizeStatus(booking),
    roomId: text(booking.roomId),
    arrivalDate: text(booking.arrival),
    departureDate: text(booking.departure),
    firstName: text(booking.firstName),
    lastName: text(booking.lastName),
    email: text(booking.email),
    phone: text(booking.phone || booking.mobile),
    guestCount: (Number(booking.numAdult) || 0) + (Number(booking.numChild) || 0),
    totalPrice: Number(booking.price) || 0,
    currency: text(booking.currency),
    remarks: text(booking.comments),
    country: text(booking.country2 || booking.country),
    city: text(booking.city),
    channel: text(booking.channel) || "beds24",
    bookedAt: text(booking.bookingTime) || undefined,
  };
};

export const fetchBookingComReservations = async (params: {
  propertyId: string;
  roomId: string;
  since?: Date;
}): Promise<BookingComApiReservation[]> => {
  if (getBookingComApiMode() === "mock") {
    return [];
  }

  const token = await getAccessToken();
  const results: BookingComApiReservation[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL(`${BEDS24_BASE_URL}/bookings`);
    url.searchParams.append("propertyId", params.propertyId);
    url.searchParams.append("roomId", params.roomId);
    BOOKING_STATUSES.forEach((status) => url.searchParams.append("status", status));
    // Without a lower bound Beds24 only returns upcoming stays, which is what we want to block.
    if (params.since) {
      url.searchParams.set("modifiedFrom", params.since.toISOString().slice(0, 19));
    }
    url.searchParams.set("page", String(page));

    const response = await fetch(url, { headers: { token } });

    if (!response.ok) {
      throw new Error(`Beds24 bookings request failed with status ${response.status}`);
    }

    const body = (await response.json()) as {
      data?: unknown[];
      pages?: { nextPageExists?: boolean };
    };

    for (const booking of body.data || []) {
      const mapped = mapBeds24Booking(booking);
      if (mapped) {
        results.push(mapped);
      }
    }

    if (!body.pages?.nextPageExists) {
      break;
    }
  }

  return results;
};

export const buildCalendarPayload = (params: { roomId: string; days: BookingComAriDay[] }) => {
  // Collapse consecutive days with identical values into from/to ranges to keep payloads small.
  const ranges: Array<{ from: string; to: string; numAvail: number; price1?: number }> = [];

  for (const day of params.days) {
    const last = ranges[ranges.length - 1];
    const expectedNext = last ? new Date(`${last.to}T00:00:00Z`).getTime() + 86400000 : 0;

    if (
      last &&
      last.numAvail === day.roomsToSell &&
      last.price1 === day.price &&
      expectedNext === new Date(`${day.date}T00:00:00Z`).getTime()
    ) {
      last.to = day.date;
    } else {
      ranges.push({ from: day.date, to: day.date, numAvail: day.roomsToSell, price1: day.price });
    }
  }

  return [
    {
      roomId: Number(params.roomId),
      calendar: ranges.map(({ price1, ...range }) => ({
        ...range,
        ...(price1 !== undefined ? { price1 } : {}),
      })),
    },
  ];
};

export const pushBookingComAvailability = async (params: {
  propertyId: string;
  roomId: string;
  days: BookingComAriDay[];
}) => {
  if (params.days.length === 0 || getBookingComApiMode() === "mock") {
    return;
  }

  const token = await getAccessToken();
  const response = await fetch(`${BEDS24_BASE_URL}/inventory/rooms/calendar`, {
    method: "POST",
    headers: { token, "Content-Type": "application/json" },
    body: JSON.stringify(buildCalendarPayload({ roomId: params.roomId, days: params.days })),
  });

  const body = (await response.json().catch(() => null)) as Array<{ success?: boolean; errors?: unknown }> | null;
  const failed = !response.ok || (Array.isArray(body) && body.some((entry) => entry.success === false));

  if (failed) {
    throw new Error(
      `Beds24 availability push failed with status ${response.status}: ${JSON.stringify(body).slice(0, 300)}`
    );
  }
};
