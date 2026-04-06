import "dotenv/config";
import mongoose from "mongoose";
import Hotel from "../models/hotel";
import { syncAllBookingComRooms, syncBookingComRoom } from "../lib/booking-com-ical";

const run = async () => {
  const connectionString = process.env.MONGODB_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("MONGODB_CONNECTION_STRING is not set");
  }

  await mongoose.connect(connectionString);

  const targetSlug = process.argv[2]?.trim().toLowerCase();

  if (targetSlug) {
    const hotel = await Hotel.findOne({ slug: targetSlug }).select("_id name slug bookingComIcal");

    if (!hotel) {
      throw new Error(`No hotel found for slug: ${targetSlug}`);
    }

    const result = await syncBookingComRoom(hotel as any);
    console.log("[SYNC]", result);
    return;
  }

  const results = await syncAllBookingComRooms();
  console.log("[SYNC]", results);
};

run()
  .catch((error) => {
    console.error("Booking.com sync failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });