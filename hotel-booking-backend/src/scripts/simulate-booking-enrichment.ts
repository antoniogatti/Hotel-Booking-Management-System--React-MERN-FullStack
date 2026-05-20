import "dotenv/config";
import mongoose from "mongoose";
import ExternalCalendarEvent from "../models/external-calendar-event";

const timeZone = process.env.BOOKING_ENRICHMENT_TIME_ZONE || "Europe/Rome";

const toParts = (date: Date, tz: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
};

const toDateKey = (parts: { year: number; month: number; day: number }) =>
  `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day
  ).padStart(2, "0")}`;

const addDays = (dateKey: string, days: number) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const getDateKeyInTimeZone = (date: Date, tz: string) => toDateKey(toParts(date, tz));

const run = async () => {
  const connectionString = process.env.MONGODB_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("MONGODB_CONNECTION_STRING is required");
  }

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const simulatedRunDate = getDateKeyInTimeZone(tomorrow, timeZone);
  const targetWindow = [
    simulatedRunDate,
    addDays(simulatedRunDate, 1),
    addDays(simulatedRunDate, 2),
  ];
  const targetWindowSet = new Set(targetWindow);

  await mongoose.connect(connectionString);

  try {
    const candidates = await ExternalCalendarEvent.find({
      source: "booking_com",
      status: "active",
    })
      .or([
        { firstName: { $exists: false } },
        { firstName: "" },
        { lastName: { $exists: false } },
        { lastName: "" },
      ])
      .select(
        "_id hotelId externalUid summary startDate endDate firstName lastName oneNoteSync.lastSyncedAt excelSync.lastSyncedAt"
      )
      .sort({ startDate: 1 });

    const scoped = candidates.filter((entry) =>
      targetWindowSet.has(getDateKeyInTimeZone(new Date(entry.startDate), timeZone))
    );

    const preview = scoped.map((entry) => ({
      id: String(entry._id),
      hotelId: String(entry.hotelId),
      externalUid: entry.externalUid,
      summary: entry.summary,
      startDate: new Date(entry.startDate).toISOString().slice(0, 10),
      endDate: new Date(entry.endDate).toISOString().slice(0, 10),
      firstName: String(entry.firstName || ""),
      lastName: String(entry.lastName || ""),
      oneNoteLastSyncedAt: entry.oneNoteSync?.lastSyncedAt
        ? new Date(entry.oneNoteSync.lastSyncedAt).toISOString()
        : null,
      excelLastSyncedAt: entry.excelSync?.lastSyncedAt
        ? new Date(entry.excelSync.lastSyncedAt).toISOString()
        : null,
    }));

    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          noUpdatesPerformed: true,
          timeZone,
          simulatedRunDate,
          targetWindow,
          totalMissingNameCandidates: candidates.length,
          eligibleTomorrowWindow: scoped.length,
          candidates: preview,
        },
        null,
        2
      )
    );
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error("simulate-booking-enrichment failed", error);
  process.exit(1);
});
