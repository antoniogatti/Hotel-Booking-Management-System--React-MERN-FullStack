import "dotenv/config";
import mongoose from "mongoose";
import Hotel from "../models/hotel";

const feeds: Record<string, string> = {
  malvasia: "https://ical.booking.com/v1/export?t=0fe0dac0-745d-4c41-a084-2b26cd2ae962",
  verdeca: "https://ical.booking.com/v1/export?t=a2ed7a8f-bd57-45af-afdd-14e5b7104d30",
  aleatico: "https://ical.booking.com/v1/export?t=566e7e72-2ad2-4598-b945-4c26b89ff918",
  fuocorosa: "https://ical.booking.com/v1/export?t=c3c77495-4f6c-44e3-a87b-f177a7bcaec7",
};

const run = async () => {
  const connectionString = process.env.MONGODB_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("MONGODB_CONNECTION_STRING is not set");
  }

  await mongoose.connect(connectionString);

  for (const [slug, url] of Object.entries(feeds)) {
    await Hotel.updateOne(
      { slug },
      {
        $set: {
          "bookingComIcal.importUrl": url,
          "bookingComIcal.syncEnabled": true,
          "bookingComIcal.lastSyncStatus": "configured",
          "bookingComIcal.lastSyncError": "",
        },
      }
    );
  }

  const hotels = await Hotel.find({ slug: { $in: Object.keys(feeds) } })
    .select("name slug bookingComIcal")
    .sort({ slug: 1 })
    .lean();

  console.log(JSON.stringify(hotels, null, 2));
};

run()
  .catch((error) => {
    console.error("Configure Booking.com feeds failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });