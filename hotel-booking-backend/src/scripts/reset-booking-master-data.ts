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

  const [deletedBookings, deletedClosedDays, deletedImportedEvents] = await Promise.all([
    Booking.deleteMany({}),
    BookingDayStatus.deleteMany({}),
    ExternalCalendarEvent.deleteMany({}),
  ]);

  await Hotel.updateMany(
    {},
    {
      $set: {
        totalBookings: 0,
        totalRevenue: 0,
        occupancyRate: 0,
      },
    }
  );

  console.log("[RESET] Deleted bookings:", deletedBookings.deletedCount || 0);
  console.log("[RESET] Deleted closed days:", deletedClosedDays.deletedCount || 0);
  console.log("[RESET] Deleted imported Booking.com events:", deletedImportedEvents.deletedCount || 0);
};

run()
  .catch((error) => {
    console.error("Reset failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });