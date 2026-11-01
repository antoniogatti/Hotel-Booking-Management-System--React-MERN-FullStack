import Hotel from "../models/hotel";
import Booking from "../models/booking";
import BookingDayStatus from "../models/booking-day-status";
import ExternalCalendarEvent from "../models/external-calendar-event";
import {
  BookingComAriDay,
  fetchBookingComReservations,
  getBookingComApiMode,
  pushBookingComAvailability,
} from "./booking-com-api-client";
import { logError, logInfo } from "./logger";

// API reservations are stored as ExternalCalendarEvent rows with the same `source` as iCal
// imports, so availability checks, calendars and enrichment keep working unchanged. When a
// room has the API enabled, the API wins: iCal events for that room are deactivated and the
// iCal sync skips the room (see booking-com-ical.ts).
const BOOKING_COM_SOURCE = "booking_com" as const;
const API_SYNC_INTERVAL_MS = 15 * 60 * 1000;
const ARI_HORIZON_DAYS = 365;
const API_UID_PREFIX = "api-";

type ApiHotel = {
  _id: string;
  name: string;
  pricePerNight?: number;
  bookingComApi?: {
    enabled?: boolean;
    propertyId?: string;
    roomId?: string;
    rateId?: string;
    pushAvailability?: boolean;
    pushPrices?: boolean;
    lastReservationsSyncAt?: Date;
  };
};

export type BookingComApiSyncResult = {
  hotelId: string;
  hotelName: string;
  mode: string;
  reservationsFetched: number;
  reservationsActivated: number;
  reservationsCancelled: number;
  ariDaysPushed: number;
  skipped: boolean;
  reason?: string;
};

let schedulerHandle: NodeJS.Timeout | null = null;
let syncInProgress = false;

const dayStart = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : value;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const isoDay = (value: Date) => value.toISOString().slice(0, 10);

const isApiReady = (hotel: ApiHotel) =>
  Boolean(
    hotel.bookingComApi?.enabled && hotel.bookingComApi.propertyId && hotel.bookingComApi.roomId
  );

const updateApiStatus = async (hotelId: string, set: Record<string, unknown>) => {
  await Hotel.updateOne({ _id: hotelId }, { $set: set });
};

// Called when a room switches to the API so the same stay is never blocked twice.
export const deactivateIcalEventsForRoom = async (hotelId: string) => {
  const result = await ExternalCalendarEvent.updateMany(
    { hotelId, source: BOOKING_COM_SOURCE, status: "active", origin: { $ne: "api" } },
    { $set: { status: "inactive" } }
  );
  return result.modifiedCount || 0;
};

const pullReservations = async (hotel: ApiHotel) => {
  const api = hotel.bookingComApi!;
  const reservations = await fetchBookingComReservations({
    propertyId: api.propertyId!,
    roomId: api.roomId!,
    since: api.lastReservationsSyncAt,
  });
  const seenAt = new Date();
  let activated = 0;
  let cancelled = 0;

  for (const reservation of reservations) {
    // The pull is already filtered by room; this guards against a mismatched response.
    if (reservation.roomId && reservation.roomId !== api.roomId) {
      continue;
    }

    const isCancelled = reservation.status === "cancelled";
    const guestName = `${reservation.firstName} ${reservation.lastName}`.trim();

    await ExternalCalendarEvent.updateOne(
      {
        hotelId: hotel._id,
        source: BOOKING_COM_SOURCE,
        externalUid: `${API_UID_PREFIX}${reservation.reservationId}`,
      },
      {
        $set: {
          origin: "api",
          summary: guestName ? `Booking.com - ${guestName}` : `Booking.com reservation (${reservation.channel})`,
          startDate: dayStart(reservation.arrivalDate),
          endDate: dayStart(reservation.departureDate),
          firstName: reservation.firstName,
          lastName: reservation.lastName,
          email: reservation.email,
          phone: reservation.phone,
          adultCount: reservation.guestCount,
          totalCost: reservation.totalPrice,
          currency: reservation.currency,
          country: reservation.country,
          city: reservation.city,
          specialRequests: reservation.remarks,
          status: isCancelled ? "inactive" : "active",
          lastSeenAt: seenAt,
          rawEvent: JSON.stringify({
            reservationId: reservation.reservationId,
            status: reservation.status,
            channel: reservation.channel,
          }),
        },
        $setOnInsert: {
          hotelId: hotel._id,
          source: BOOKING_COM_SOURCE,
          externalUid: `${API_UID_PREFIX}${reservation.reservationId}`,
        },
      },
      { upsert: true }
    );

    if (isCancelled) {
      cancelled += 1;
    } else {
      activated += 1;
    }
  }

  await updateApiStatus(hotel._id, {
    "bookingComApi.lastReservationsSyncAt": seenAt,
  });

  return { fetched: reservations.length, activated, cancelled };
};

const buildAriDays = async (hotel: ApiHotel): Promise<BookingComAriDay[]> => {
  const from = dayStart(new Date());
  const to = new Date(from.getTime() + ARI_HORIZON_DAYS * 86400000);

  const [bookings, closedDays, events] = await Promise.all([
    Booking.find({
      hotelId: hotel._id,
      status: { $in: ["pending", "confirmed", "arrived", "completed"] },
      checkIn: { $lt: to },
      checkOut: { $gt: from },
    }).select("checkIn checkOut"),
    BookingDayStatus.find({
      hotelId: hotel._id,
      status: "closed",
      date: { $gte: from, $lt: to },
    }).select("date"),
    ExternalCalendarEvent.find({
      hotelId: hotel._id,
      source: BOOKING_COM_SOURCE,
      status: "active",
      startDate: { $lt: to },
      endDate: { $gt: from },
    }).select("startDate endDate"),
  ]);

  const blocked = new Set<string>();
  const blockRange = (start: Date, end: Date) => {
    for (let t = dayStart(start).getTime(); t < dayStart(end).getTime(); t += 86400000) {
      blocked.add(isoDay(new Date(t)));
    }
  };

  bookings.forEach((booking) => blockRange(new Date(booking.checkIn), new Date(booking.checkOut)));
  events.forEach((event) => blockRange(new Date(event.startDate), new Date(event.endDate)));
  closedDays.forEach((closed) => blocked.add(isoDay(dayStart(new Date(closed.date)))));

  // Prices stay under the Booking.com calendar unless price push is explicitly enabled.
  const price =
    hotel.bookingComApi?.pushPrices === true && hotel.pricePerNight && hotel.pricePerNight > 0
      ? hotel.pricePerNight
      : undefined;
  const days: BookingComAriDay[] = [];

  for (let i = 0; i < ARI_HORIZON_DAYS; i += 1) {
    const date = isoDay(new Date(from.getTime() + i * 86400000));
    days.push({ date, roomsToSell: blocked.has(date) ? 0 : 1, price });
  }

  return days;
};

export const pushBookingComAri = async (hotel: ApiHotel) => {
  const api = hotel.bookingComApi!;
  const days = await buildAriDays(hotel);

  await pushBookingComAvailability({
    propertyId: api.propertyId!,
    roomId: api.roomId!,
    days,
  });

  await updateApiStatus(hotel._id, { "bookingComApi.lastAriPushAt": new Date() });
  return days.length;
};

export const syncBookingComApiRoom = async (
  hotel: ApiHotel,
  options: { pull?: boolean; push?: boolean } = {}
): Promise<BookingComApiSyncResult> => {
  const base = {
    hotelId: String(hotel._id),
    hotelName: hotel.name,
    mode: getBookingComApiMode(),
    reservationsFetched: 0,
    reservationsActivated: 0,
    reservationsCancelled: 0,
    ariDaysPushed: 0,
  };

  if (!isApiReady(hotel)) {
    return { ...base, skipped: true, reason: "API disabled or property/room/rate mapping incomplete" };
  }

  try {
    if (options.pull !== false) {
      const pulled = await pullReservations(hotel);
      base.reservationsFetched = pulled.fetched;
      base.reservationsActivated = pulled.activated;
      base.reservationsCancelled = pulled.cancelled;
    }

    if (options.push !== false && hotel.bookingComApi?.pushAvailability !== false) {
      base.ariDaysPushed = await pushBookingComAri(hotel);
    }

    await updateApiStatus(hotel._id, {
      "bookingComApi.lastSyncStatus": "success",
      "bookingComApi.lastSyncError": "",
    });

    return { ...base, skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Booking.com API error";
    await updateApiStatus(hotel._id, {
      "bookingComApi.lastSyncStatus": "error",
      "bookingComApi.lastSyncError": message,
    });
    throw error;
  }
};

export const syncAllBookingComApiRooms = async () => {
  const hotels = (await Hotel.find({ "bookingComApi.enabled": true }).select(
    "_id name pricePerNight bookingComApi"
  )) as unknown as ApiHotel[];

  const results: BookingComApiSyncResult[] = [];

  for (const hotel of hotels) {
    try {
      results.push(await syncBookingComApiRoom(hotel));
    } catch (error) {
      results.push({
        hotelId: String(hotel._id),
        hotelName: hotel.name,
        mode: getBookingComApiMode(),
        reservationsFetched: 0,
        reservationsActivated: 0,
        reservationsCancelled: 0,
        ariDaysPushed: 0,
        skipped: false,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
};

const runScheduledApiSync = async () => {
  if (syncInProgress) {
    return;
  }

  syncInProgress = true;

  try {
    const results = await syncAllBookingComApiRooms();
    if (results.length > 0) {
      logInfo("Booking.com API sync cycle completed", {
        roomCount: results.length,
        fetched: results.reduce((sum, result) => sum + result.reservationsFetched, 0),
        failed: results.filter((result) => result.reason && !result.skipped).length,
      });
    }
  } catch (error) {
    logError("Booking.com API scheduled sync failed", error);
  } finally {
    syncInProgress = false;
  }
};

export const startBookingComApiScheduler = () => {
  if (schedulerHandle) {
    return;
  }

  const enabled = String(process.env.BOOKING_COM_API_SYNC_ENABLED || "true").toLowerCase() !== "false";

  if (!enabled) {
    logInfo("Booking.com API scheduler disabled by environment");
    return;
  }

  setTimeout(() => {
    void runScheduledApiSync();
  }, 30000);

  schedulerHandle = setInterval(() => {
    void runScheduledApiSync();
  }, API_SYNC_INTERVAL_MS);

  logInfo("Booking.com API scheduler started", {
    intervalMs: API_SYNC_INTERVAL_MS,
    mode: getBookingComApiMode(),
  });
};
