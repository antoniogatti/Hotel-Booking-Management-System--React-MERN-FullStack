import * as nodeIcal from "node-ical";
import Hotel from "../models/hotel";
import ExternalCalendarEvent from "../models/external-calendar-event";
import { logError, logInfo } from "./logger";

export const BOOKING_COM_SOURCE = "booking_com" as const;
export const BOOKING_COM_STATUS_LABEL = "Imported" as const;
export const BOOKING_COM_SYNC_INTERVAL_MS = 2 * 60 * 60 * 1000;

type SyncableHotel = {
  _id: string;
  name: string;
  slug?: string;
  bookingComIcal?: {
    importUrl?: string;
    syncEnabled?: boolean;
    lastSyncAt?: Date;
    lastSyncStatus?: string;
    lastSyncError?: string;
  };
};

type ParsedBookingComEvent = {
  externalUid: string;
  summary: string;
  startDate: Date;
  endDate: Date;
  dtStamp?: Date;
  rawEvent: string;
};

type SyncResult = {
  hotelId: string;
  hotelName: string;
  fetched: number;
  activated: number;
  deactivated: number;
  skipped: boolean;
  reason?: string;
};

let schedulerHandle: NodeJS.Timeout | null = null;
let syncInProgress = false;

// DATE-only iCal values represent calendar days, not instants in time.
// node-ical materializes them as Date objects, but normalizing with UTC getters
// can shift the stored day backward depending on timezone handling.
const toCalendarDayStart = (value: string | Date) => {
  const date = new Date(value);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
};

const serializeRawEvent = (event: any) => {
  const payload = {
    uid: event.uid,
    summary: event.summary,
    start: event.start,
    end: event.end,
    dtstamp: event.dtstamp,
  };

  return JSON.stringify(payload);
};

const parseBookingComEvents = (icalText: string): ParsedBookingComEvent[] => {
  const parsed = nodeIcal.sync.parseICS(icalText);
  const uniqueEvents = new Map<string, ParsedBookingComEvent>();

  Object.values(parsed).forEach((entry: any) => {
    if (
      !entry ||
      entry.type !== "VEVENT" ||
      !entry.uid ||
      !entry.start ||
      !entry.end
    ) {
      return;
    }

    uniqueEvents.set(String(entry.uid), {
      externalUid: String(entry.uid),
      summary: String(entry.summary || "Imported from Booking.com"),
      startDate: toCalendarDayStart(entry.start),
      endDate: toCalendarDayStart(entry.end),
      dtStamp: entry.dtstamp ? new Date(entry.dtstamp) : undefined,
      rawEvent: serializeRawEvent(entry),
    });
  });

  return Array.from(uniqueEvents.values()).sort(
    (left, right) => left.startDate.getTime() - right.startDate.getTime()
  );
};

const updateHotelSyncStatus = async (
  hotelId: string,
  status: "success" | "error" | "skipped",
  errorMessage?: string
) => {
  await Hotel.updateOne(
    { _id: hotelId },
    {
      $set: {
        "bookingComIcal.lastSyncAt": new Date(),
        "bookingComIcal.lastSyncStatus": status,
        "bookingComIcal.lastSyncError": errorMessage || "",
      },
    }
  );
};

export const isBookingComManagedRoom = (hotel?: {
  bookingComIcal?: { importUrl?: string; syncEnabled?: boolean };
}) => Boolean(hotel?.bookingComIcal?.syncEnabled && hotel?.bookingComIcal?.importUrl);

export const getImportedUnavailableHotelIds = async (params: {
  hotelIds: string[];
  checkIn: Date;
  checkOut: Date;
}) => {
  if (params.hotelIds.length === 0) {
    return [];
  }

  return ExternalCalendarEvent.distinct("hotelId", {
    hotelId: { $in: params.hotelIds },
    source: BOOKING_COM_SOURCE,
    status: "active",
    startDate: { $lt: params.checkOut },
    endDate: { $gt: params.checkIn },
  });
};

export const findOverlappingImportedEvent = async (params: {
  hotelId: string;
  checkIn: Date;
  checkOut: Date;
}) => {
  return ExternalCalendarEvent.findOne({
    hotelId: params.hotelId,
    source: BOOKING_COM_SOURCE,
    status: "active",
    startDate: { $lt: params.checkOut },
    endDate: { $gt: params.checkIn },
  }).sort({ startDate: 1, updatedAt: -1 });
};

export const getImportedCalendarEvents = async (params: {
  hotelId: string;
  start: Date;
  end: Date;
}) => {
  return ExternalCalendarEvent.find({
    hotelId: params.hotelId,
    source: BOOKING_COM_SOURCE,
    status: "active",
    startDate: { $lt: params.end },
    endDate: { $gt: params.start },
  }).sort({ startDate: 1, updatedAt: -1 });
};

export const syncBookingComRoom = async (hotel: SyncableHotel): Promise<SyncResult> => {
  const importUrl = hotel.bookingComIcal?.importUrl?.trim();

  if (!hotel.bookingComIcal?.syncEnabled || !importUrl) {
    await updateHotelSyncStatus(hotel._id, "skipped");

    return {
      hotelId: hotel._id,
      hotelName: hotel.name,
      fetched: 0,
      activated: 0,
      deactivated: 0,
      skipped: true,
      reason: "Sync disabled or import URL missing",
    };
  }

  try {
    const response = await fetch(importUrl, {
      method: "GET",
      headers: {
        Accept: "text/calendar,text/plain;q=0.9,*/*;q=0.8",
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error(`Booking.com iCal fetch failed with status ${response.status}`);
    }

    const icalText = await response.text();
    const parsedEvents = parseBookingComEvents(icalText);
    const seenAt = new Date();
    let activated = 0;

    for (const event of parsedEvents) {
      await ExternalCalendarEvent.updateOne(
        {
          hotelId: hotel._id,
          source: BOOKING_COM_SOURCE,
          externalUid: event.externalUid,
        },
        {
          $set: {
            summary: event.summary,
            startDate: event.startDate,
            endDate: event.endDate,
            dtStamp: event.dtStamp,
            rawEvent: event.rawEvent,
            status: "active",
            lastSeenAt: seenAt,
          },
          $setOnInsert: {
            hotelId: hotel._id,
            source: BOOKING_COM_SOURCE,
            externalUid: event.externalUid,
          },
        },
        { upsert: true }
      );
      activated += 1;
    }

    const activeUids = parsedEvents.map((event) => event.externalUid);
    const deactivateFilter: any = {
      hotelId: hotel._id,
      source: BOOKING_COM_SOURCE,
      status: "active",
    };

    if (activeUids.length > 0) {
      deactivateFilter.externalUid = { $nin: activeUids };
    }

    const deactivationResult = await ExternalCalendarEvent.updateMany(deactivateFilter, {
      $set: {
        status: "inactive",
      },
    });

    await updateHotelSyncStatus(hotel._id, "success");

    return {
      hotelId: hotel._id,
      hotelName: hotel.name,
      fetched: parsedEvents.length,
      activated,
      deactivated: deactivationResult.modifiedCount || 0,
      skipped: false,
    };
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Unknown Booking.com sync error";
    await updateHotelSyncStatus(hotel._id, "error", message);
    throw error;
  }
};

export const syncAllBookingComRooms = async () => {
  const hotels = (await Hotel.find({
    "bookingComIcal.syncEnabled": true,
    "bookingComIcal.importUrl": { $exists: true, $ne: "" },
  }).select("_id name slug bookingComIcal")) as unknown as SyncableHotel[];

  const results: SyncResult[] = [];

  for (const hotel of hotels) {
    try {
      const result = await syncBookingComRoom(hotel);
      results.push(result);
    } catch (error: any) {
      results.push({
        hotelId: hotel._id,
        hotelName: hotel.name,
        fetched: 0,
        activated: 0,
        deactivated: 0,
        skipped: false,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
};

const runScheduledSync = async () => {
  if (syncInProgress) {
    return;
  }

  syncInProgress = true;

  try {
    const results = await syncAllBookingComRooms();
    if (results.length > 0) {
      logInfo("Booking.com sync cycle completed", {
        roomCount: results.length,
        activated: results.reduce((sum, result) => sum + result.activated, 0),
        deactivated: results.reduce((sum, result) => sum + result.deactivated, 0),
        fetched: results.reduce((sum, result) => sum + result.fetched, 0),
      });
    }
  } catch (error) {
    logError("Booking.com scheduled sync failed", error);
  } finally {
    syncInProgress = false;
  }
};

export const startBookingComSyncScheduler = () => {
  if (schedulerHandle) {
    return;
  }

  const enabled = String(process.env.BOOKING_COM_SYNC_ENABLED || "true").toLowerCase() !== "false";

  if (!enabled) {
    logInfo("Booking.com scheduler disabled by environment");
    return;
  }

  const runOnStartup =
    String(process.env.BOOKING_COM_SYNC_RUN_ON_STARTUP || "true").toLowerCase() !== "false";

  if (runOnStartup) {
    setTimeout(() => {
      void runScheduledSync();
    }, 15000);
  }

  schedulerHandle = setInterval(() => {
    void runScheduledSync();
  }, BOOKING_COM_SYNC_INTERVAL_MS);

  logInfo("Booking.com scheduler started", {
    intervalMs: BOOKING_COM_SYNC_INTERVAL_MS,
  });
};