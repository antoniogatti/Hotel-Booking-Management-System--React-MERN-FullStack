require("dotenv").config();
const mongoose = require("mongoose");
const Hotel = require("../dist/hotel-booking-backend/src/models/hotel").default;

async function main() {
  await mongoose.connect(process.env.MONGODB_CONNECTION_STRING);

  const backendBaseUrl = (process.env.BACKEND_URL || "").replace(/\/$/, "");
  const hotels = await Hotel.find({
    "bookingComIcal.exportToken": { $exists: true, $ne: "" },
  })
    .select("name slug bookingComIcal")
    .lean();

  const rows = hotels.map((hotel) => ({
    name: hotel.name,
    slug: hotel.slug,
    exportEnabled: Boolean(hotel.bookingComIcal?.exportEnabled),
    exportUrl:
      backendBaseUrl && hotel.bookingComIcal?.exportToken
        ? `${backendBaseUrl}/api/integrations/booking-com/export/${hotel._id}/${hotel.bookingComIcal.exportToken}.ics`
        : "",
  }));

  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {}
  });