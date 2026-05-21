import ExternalCalendarEvent from "../models/external-calendar-event";
import Hotel from "../models/hotel";
import SchedulerRunLog from "../models/scheduler-run-log";
import User from "../models/user";
import { getValidMicrosoftGraphAccessToken } from "./microsoft-graph-auth";
import { syncBookingFromExcel } from "./excel-booking-sync";
import { syncBookingFromOneNote } from "./onenote-booking-sync";
import { applyOneNoteSyncToRecord } from "./onenote-booking-apply";
import { logError, logInfo, logWarn } from "./logger";

const AUTO_SYNC_TIME_ZONE = process.env.BOOKING_ENRICHMENT_TIME_ZONE || "Europe/Rome";
const AUTO_SYNC_ENABLED =
  String(process.env.BOOKING_ENRICHMENT_SYNC_ENABLED || "true").toLowerCase() !== "false";
const AUTO_SYNC_HOURS = [12, 18];
const AUTO_SYNC_MINUTE = 0;
const AUTO_SYNC_MAX_BOOKINGS = Math.max(
  1,
  Number(process.env.BOOKING_ENRICHMENT_MAX_BOOKINGS || 50)
);
const AUTO_SYNC_LOG_RETENTION_DAYS = Math.max(
  1,
  Number(process.env.BOOKING_ENRICHMENT_LOG_RETENTION_DAYS || 30)
);
const AUTO_SYNC_INTERVAL_MS = 60 * 1000;

let schedulerHandle: NodeJS.Timeout | null = null;
let syncInProgress = false;
let lastRunSlotKey = "";

export type BookingEnrichmentRunSummary = {
  slotKey: string;
  timeZone: string;
  processed: number;
  syncedOneNote: number;
  syncedExcel: number;
  enrichedNames: number;
  errors: number;
  status: "completed" | "skipped" | "failed";
  reason?: string;
  errorCode?: string;
  errorMessage?: string;
  errorDetails?: Array<{
    code: string;
    message: string;
    externalEventId?: string;
    hotelId?: string;
  }>;
};

type TimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const toParts = (date: Date, timeZone: string): TimeParts => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
};

const toDateKey = (parts: Pick<TimeParts, "year" | "month" | "day">) =>
  `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day
  ).padStart(2, "0")}`;

const addDaysToKey = (key: string, days: number) => {
  const [yearText, monthText, dayText] = key.split("-");
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const getDateKeyInTimeZone = (date: Date, timeZone: string) => {
  const parts = toParts(date, timeZone);
  return toDateKey(parts);
};

const extractErrorDetails = (error: unknown) => {
  if (error instanceof Error) {
    const maybeCode = (error as { code?: unknown }).code;
    const code = typeof maybeCode === "string" && maybeCode.trim() ? maybeCode.trim() : error.name;
    return {
      code,
      message: error.message || "Unknown error",
    };
  }

  if (typeof error === "string") {
    return {
      code: "Error",
      message: error,
    };
  }

  return {
    code: "UnknownError",
    message: "Unknown scheduler failure",
  };
};

const shouldRunNow = (now: Date) => {
  const parts = toParts(now, AUTO_SYNC_TIME_ZONE);
  if (!AUTO_SYNC_HOURS.includes(parts.hour) || parts.minute !== AUTO_SYNC_MINUTE) {
    return { run: false, slotKey: "" };
  }

  const slotKey = `${toDateKey(parts)}-${String(parts.hour).padStart(2, "0")}:${String(
    parts.minute
  ).padStart(2, "0")}`;

  if (slotKey === lastRunSlotKey) {
    return { run: false, slotKey };
  }

  return { run: true, slotKey };
};

const hasMissingGuestNames = (entry: { firstName?: string; lastName?: string }) => {
  const firstName = String(entry.firstName || "").trim();
  const lastName = String(entry.lastName || "").trim();
  return !firstName || !lastName;
};

const getAutomationUser = async () => {
  const preferredEmail = String(process.env.BOOKING_ENRICHMENT_SYNC_USER_EMAIL || "")
    .trim()
    .toLowerCase();

  if (preferredEmail) {
    const user = await User.findOne({
      email: preferredEmail,
      "microsoftGraphAuth.accessTokenCiphertext": { $exists: true, $ne: "" },
    });

    if (user) {
      return user;
    }
  }

  return User.findOne({
    role: { $in: ["admin", "hotel_owner"] },
    "microsoftGraphAuth.accessTokenCiphertext": { $exists: true, $ne: "" },
  }).sort({ updatedAt: -1 });
};

const applyExcelSyncToImportedEvent = (params: {
  record: any;
  matchedRow: {
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
  syncWorkbook: {
    driveId?: string;
    itemId?: string;
    sheetName?: string;
  };
  guestName: {
    firstName: string;
    lastName: string;
  };
}) => {
  const { record, matchedRow, syncWorkbook, guestName } = params;

  if (!record.firstName && guestName.firstName) {
    record.firstName = guestName.firstName;
  }

  if (!record.lastName && guestName.lastName) {
    record.lastName = guestName.lastName;
  }

  if (matchedRow.city) {
    record.city = matchedRow.city;
  }

  if (matchedRow.country) {
    record.country = matchedRow.country;
    record.nationality = record.nationality || matchedRow.country;
  }

  if (typeof matchedRow.pax === "number" && matchedRow.pax > 0) {
    record.adultCount = matchedRow.pax;
  }

  if (typeof matchedRow.totalPrice === "number" && matchedRow.totalPrice > 0) {
    record.totalCost = matchedRow.totalPrice;
  }

  record.excelSync = {
    lastSyncedAt: new Date(),
    workbookItemId: syncWorkbook.itemId,
    sheetName: syncWorkbook.sheetName,
    matchedRowNumber: matchedRow.rowNumber,
    matchedRoom: matchedRow.room,
    matchedDate: new Date(`${matchedRow.date}T00:00:00.000Z`),
    guestName: matchedRow.guestName,
    invoiceNumber: matchedRow.invoiceNumber,
    identifier: matchedRow.identifier,
    paymentVia: matchedRow.paymentVia,
    pax: matchedRow.pax,
    totalPrice: matchedRow.totalPrice,
    unitPrice: matchedRow.unitPrice,
    netPrice: matchedRow.netPrice,
    city: matchedRow.city,
    country: matchedRow.country,
    raw: matchedRow.raw,
  };
};

const runScheduledSync = async (slotKey: string): Promise<BookingEnrichmentRunSummary> => {
  const startedAt = new Date();

  const cleanupOldRunLogs = async () => {
    try {
      const cutoff = new Date(startedAt);
      cutoff.setUTCDate(cutoff.getUTCDate() - AUTO_SYNC_LOG_RETENTION_DAYS);

      const cleanupResult = await SchedulerRunLog.deleteMany({
        schedulerName: "booking_enrichment",
        startedAt: { $lt: cutoff },
      });

      if ((cleanupResult.deletedCount || 0) > 0) {
        logInfo("Booking enrichment scheduler log retention cleanup completed", {
          retentionDays: AUTO_SYNC_LOG_RETENTION_DAYS,
          deletedCount: cleanupResult.deletedCount,
          cutoff: cutoff.toISOString(),
        });
      }
    } catch (cleanupError) {
      logWarn("Booking enrichment scheduler log retention cleanup failed", {
        slotKey,
        retentionDays: AUTO_SYNC_LOG_RETENTION_DAYS,
        error: cleanupError instanceof Error ? cleanupError.message : "unknown cleanup error",
      });
    }
  };

  const persistRunLog = async (summary: BookingEnrichmentRunSummary) => {
    try {
      const finishedAt = new Date();
      await SchedulerRunLog.create({
        schedulerName: "booking_enrichment",
        slotKey: summary.slotKey,
        runDateKey: getDateKeyInTimeZone(startedAt, AUTO_SYNC_TIME_ZONE),
        timeZone: summary.timeZone,
        status:
          summary.status === "completed"
            ? "success"
            : summary.status === "failed"
              ? "failed"
              : "skipped",
        startedAt,
        finishedAt,
        durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
        processed: summary.processed,
        syncedOneNote: summary.syncedOneNote,
        syncedExcel: summary.syncedExcel,
        enrichedNames: summary.enrichedNames,
        errorCount: summary.errors,
        errorDetails: (summary.errorDetails || []).slice(0, 10).map((detail) => ({
          code: detail.code,
          message: detail.message,
          externalEventId: detail.externalEventId || "",
          hotelId: detail.hotelId || "",
        })),
        reason: summary.reason || "",
        errorCode: summary.errorCode || "",
        errorMessage: summary.errorMessage || "",
      });
    } catch (persistError) {
      logError("Unable to persist booking enrichment scheduler run log", persistError, {
        slotKey: summary.slotKey,
      });
    }
  };

  const completeAndPersist = async (summary: BookingEnrichmentRunSummary) => {
    await persistRunLog(summary);
    return summary;
  };

  await cleanupOldRunLogs();

  if (syncInProgress) {
    return completeAndPersist({
      slotKey,
      timeZone: AUTO_SYNC_TIME_ZONE,
      processed: 0,
      syncedOneNote: 0,
      syncedExcel: 0,
      enrichedNames: 0,
      errors: 0,
      status: "skipped",
      reason: "sync already in progress",
    });
  }

  syncInProgress = true;

  try {
    const now = new Date();
    const todayKey = getDateKeyInTimeZone(now, AUTO_SYNC_TIME_ZONE);
    const allowedDateKeys = new Set([todayKey, addDaysToKey(todayKey, 1), addDaysToKey(todayKey, 2)]);

    const automationUser = await getAutomationUser();
    if (!automationUser) {
      logWarn("Booking enrichment scheduler skipped: no Microsoft-connected admin/hotel owner");
      return completeAndPersist({
        slotKey,
        timeZone: AUTO_SYNC_TIME_ZONE,
        processed: 0,
        syncedOneNote: 0,
        syncedExcel: 0,
        enrichedNames: 0,
        errors: 0,
        status: "skipped",
        reason: "no Microsoft-connected admin/hotel owner",
      });
    }

    const graphAccessToken = await getValidMicrosoftGraphAccessToken(automationUser);
    if (!graphAccessToken) {
      logWarn("Booking enrichment scheduler skipped: Microsoft Graph token unavailable", {
        userId: String(automationUser._id),
      });
      return completeAndPersist({
        slotKey,
        timeZone: AUTO_SYNC_TIME_ZONE,
        processed: 0,
        syncedOneNote: 0,
        syncedExcel: 0,
        enrichedNames: 0,
        errors: 0,
        status: "skipped",
        reason: "Microsoft Graph token unavailable",
      });
    }

    const candidates = await ExternalCalendarEvent.find({
      source: "booking_com",
      status: "active",
      $or: [
        { firstName: { $exists: false } },
        { firstName: "" },
        { lastName: { $exists: false } },
        { lastName: "" },
      ],
    })
      .sort({ startDate: 1 })
      .limit(AUTO_SYNC_MAX_BOOKINGS);

    const scopedCandidates = candidates.filter((entry) => {
      const dateKey = getDateKeyInTimeZone(new Date(entry.startDate), AUTO_SYNC_TIME_ZONE);
      return allowedDateKeys.has(dateKey);
    });

    if (scopedCandidates.length === 0) {
      logInfo("Booking enrichment scheduler: no eligible bookings", {
        slotKey,
        timeZone: AUTO_SYNC_TIME_ZONE,
      });
      return completeAndPersist({
        slotKey,
        timeZone: AUTO_SYNC_TIME_ZONE,
        processed: 0,
        syncedOneNote: 0,
        syncedExcel: 0,
        enrichedNames: 0,
        errors: 0,
        status: "completed",
      });
    }

    const hotelIds = Array.from(new Set(scopedCandidates.map((entry) => String(entry.hotelId))));
    const hotels = await Hotel.find({ _id: { $in: hotelIds } }).select("_id name slug");
    const hotelMap = new Map(hotels.map((hotel) => [String(hotel._id), hotel]));

    let processed = 0;
    let syncedOneNote = 0;
    let syncedExcel = 0;
    let enrichedNames = 0;
    let errors = 0;
    const errorDetails: Array<{
      code: string;
      message: string;
      externalEventId?: string;
      hotelId?: string;
    }> = [];

    for (const entry of scopedCandidates) {
      processed += 1;

      try {
        const hotel = hotelMap.get(String(entry.hotelId));
        if (!hotel) {
          continue;
        }

        let changed = false;
        const missingBefore = hasMissingGuestNames(entry);

        const oneNoteResult = await syncBookingFromOneNote({
          accessToken: graphAccessToken,
          booking: {
            firstName: entry.firstName || "",
            lastName: entry.lastName || "",
            phone: entry.phone || "",
            adultCount: entry.adultCount,
            childCount: entry.childCount,
            checkIn: entry.startDate,
            checkOut: entry.endDate,
          },
          hotel: {
            name: hotel.name,
            slug: hotel.slug,
          },
        });

        if (oneNoteResult.matched) {
          applyOneNoteSyncToRecord({
            record: entry,
            matchedPage: oneNoteResult.page,
            guestName: oneNoteResult.guestName,
            fallback: {
              phone: entry.phone,
              email: entry.email,
              nationality: entry.nationality,
            },
          });
          changed = true;
          syncedOneNote += 1;
        }

        const excelResult = await syncBookingFromExcel({
          accessToken: graphAccessToken,
          booking: {
            firstName: entry.firstName || "",
            lastName: entry.lastName || "",
            checkIn: new Date(entry.startDate),
          },
          hotel: {
            name: hotel.name,
            slug: hotel.slug,
          },
        });

        if (excelResult.matched) {
          applyExcelSyncToImportedEvent({
            record: entry,
            matchedRow: excelResult.row,
            syncWorkbook: excelResult.workbook,
            guestName: excelResult.guestName,
          });
          changed = true;
          syncedExcel += 1;
        }

        if (changed) {
          const missingAfter = hasMissingGuestNames(entry);
          if (missingBefore && !missingAfter) {
            enrichedNames += 1;
          }

          await entry.save();
        }
      } catch (error) {
        errors += 1;
        const details = extractErrorDetails(error);
        errorDetails.push({
          code: details.code,
          message: details.message,
          externalEventId: String(entry._id),
          hotelId: String(entry.hotelId),
        });
        logError("Booking enrichment sync failed for imported event", error, {
          externalEventId: String(entry._id),
          hotelId: String(entry.hotelId),
          slotKey,
        });
      }
    }

    logInfo("Booking enrichment scheduler completed", {
      slotKey,
      timeZone: AUTO_SYNC_TIME_ZONE,
      processed,
      syncedOneNote,
      syncedExcel,
      enrichedNames,
      errors,
    });

    return completeAndPersist({
      slotKey,
      timeZone: AUTO_SYNC_TIME_ZONE,
      processed,
      syncedOneNote,
      syncedExcel,
      enrichedNames,
      errors,
      status: errors > 0 ? "failed" : "completed",
      errorDetails,
    });
  } catch (error) {
    const details = extractErrorDetails(error);

    logError("Booking enrichment scheduler run failed", error, {
      slotKey,
      timeZone: AUTO_SYNC_TIME_ZONE,
      errorCode: details.code,
    });

    return completeAndPersist({
      slotKey,
      timeZone: AUTO_SYNC_TIME_ZONE,
      processed: 0,
      syncedOneNote: 0,
      syncedExcel: 0,
      enrichedNames: 0,
      errors: 1,
      status: "failed",
      reason: details.message,
      errorCode: details.code,
      errorMessage: details.message,
      errorDetails: [
        {
          code: details.code,
          message: details.message,
        },
      ],
    });
  } finally {
    syncInProgress = false;
  }
};

const tickScheduler = () => {
  const now = new Date();
  const decision = shouldRunNow(now);

  if (!decision.run) {
    return;
  }

  lastRunSlotKey = decision.slotKey;
  void runScheduledSync(decision.slotKey);
};

export const startBookingEnrichmentScheduler = () => {
  if (schedulerHandle) {
    return;
  }

  if (!AUTO_SYNC_ENABLED) {
    logInfo("Booking enrichment scheduler disabled by environment");
    return;
  }

  schedulerHandle = setInterval(tickScheduler, AUTO_SYNC_INTERVAL_MS);

  logInfo("Booking enrichment scheduler started", {
    timeZone: AUTO_SYNC_TIME_ZONE,
    schedule: ["12:00", "18:00"],
    targetWindow: "today to +2 days",
    targetFilter: "booking.com imports missing firstName/lastName",
    maxBookingsPerRun: AUTO_SYNC_MAX_BOOKINGS,
  });
};

export const runBookingEnrichmentSyncNow = async () => {
  const now = new Date();
  const slotKey = `manual-${now.toISOString()}`;
  return runScheduledSync(slotKey);
};
