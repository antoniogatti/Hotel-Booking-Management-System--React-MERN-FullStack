import "dotenv/config";
import mongoose from "mongoose";
import ExternalCalendarEvent from "../models/external-calendar-event";
import Hotel from "../models/hotel";

const run = async () => {
  const connectionString = process.env.MONGODB_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("MONGODB_CONNECTION_STRING is not set");
  }

  await mongoose.connect(connectionString);

  const deletedImportedEvents = await ExternalCalendarEvent.deleteMany({
    source: "booking_com",
  });

  const updatedHotels = await Hotel.updateMany(
    { "bookingComIcal.syncEnabled": true },
    {
      $set: {
        "bookingComIcal.lastSyncStatus": "configured",
        "bookingComIcal.lastSyncError": "",
      },
      $unset: {
        "bookingComIcal.lastSyncAt": "",
      },
    }
  );

  console.log("[RESET_BOOKING_COM_IMPORTS] Deleted imported events:", deletedImportedEvents.deletedCount || 0);
  console.log("[RESET_BOOKING_COM_IMPORTS] Updated synced rooms:", updatedHotels.modifiedCount || 0);
};

run()
  .catch((error) => {
    console.error("Reset Booking.com imports failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });