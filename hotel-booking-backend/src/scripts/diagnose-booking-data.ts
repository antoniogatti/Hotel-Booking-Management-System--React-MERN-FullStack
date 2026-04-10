import "dotenv/config";
import mongoose from "mongoose";
import Booking from "../models/booking";
import BookingDayStatus from "../models/booking-day-status";
import ExternalCalendarEvent from "../models/external-calendar-event";
import Hotel from "../models/hotel";

const run = async () => {
  const connectionString = process.env.MONGODB_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("MONGODB_CONNECTION_STRING is not set");
  }

  await mongoose.connect(connectionString);

  const target = await Hotel.findOne({
    $or: [{ slug: "aleatico" }, { name: /aleatico/i }],
  }).select("_id name slug");

  const [bookingCount, closedDayCount, importedCount] = await Promise.all([
    Booking.countDocuments({}),
    BookingDayStatus.countDocuments({}),
    ExternalCalendarEvent.countDocuments({}),
  ]);

  const roomCounts = target
    ? await Promise.all([
        Booking.countDocuments({ hotelId: String(target._id) }),
        BookingDayStatus.countDocuments({ hotelId: String(target._id) }),
        ExternalCalendarEvent.countDocuments({ hotelId: String(target._id) }),
      ])
    : null;

  console.log(
    JSON.stringify(
      {
        database: mongoose.connection.db?.databaseName,
        global: {
          bookings: bookingCount,
          closedDays: closedDayCount,
          importedEvents: importedCount,
        },
        room: target
          ? {
              id: String(target._id),
              name: target.name,
              slug: target.slug,
              bookings: roomCounts?.[0] || 0,
              closedDays: roomCounts?.[1] || 0,
              importedEvents: roomCounts?.[2] || 0,
            }
          : null,
      },
      null,
      2
    )
  );
};

run()
  .catch((error) => {
    console.error("Diagnosis failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });