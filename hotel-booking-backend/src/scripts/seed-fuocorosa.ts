import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import Hotel from "../models/hotel";

const getFuocorosaImages = (): string[] => {
  const imagesDir = path.resolve(
    process.cwd(),
    "../hotel-booking-frontend/public/fuocorosa"
  );

  if (!fs.existsSync(imagesDir)) {
    throw new Error(`Images folder not found: ${imagesDir}`);
  }

  return fs
    .readdirSync(imagesDir)
    .filter((fileName) => /\.(png|jpe?g|webp)$/i.test(fileName))
    .sort((a, b) => a.localeCompare(b))
    .map((fileName) => `/fuocorosa/${fileName}`);
};

const seedFuocorosa = async () => {
  const connectionString = process.env.MONGODB_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error("MONGODB_CONNECTION_STRING is not set");
  }

  const imageUrls = getFuocorosaImages();

  if (imageUrls.length === 0) {
    throw new Error("No images found in /public/fuocorosa");
  }

  await mongoose.connect(connectionString);

  const roomDocument = {
    userId: "palazzopintobnb-owner",
    name: "Fuocorosa - Apartment",
    city: "Brindisi",
    country: "Italy",
    description:
      "In the comfort of a spacious and well-furnished apartment, everyone can find their ideal space to dedicate precious time to themselves. In our FUOCOROSA apartment, with its contemporary style and authentic furnishings, you will find all the comforts needed for a perfect vacation. FUOCOROSA is located entirely on the ground floor with no stairs, making it easily accessible for everyone. The apartment includes a fully equipped kitchen, perfect for preparing delicious meals independently. The cozy dining room and the living room with a comfortable sofa bed offer ideal spaces for relaxing and socializing, comfortably accommodating up to four people. The bedroom features a large double bed, ensuring a restful sleep. The private bathroom is equipped with a shower, soft towels, a hairdryer, and a courtesy kit, ensuring a total comfort experience. Our guests can take advantage of modern appliances such as the refrigerator, dishwasher, washing machine, and iron, making the stay even more convenient. A TV completes the list of comforts that this cozy apartment offers, ensuring moments of entertainment and relaxation.",
    type: ["Boutique", "Self Catering", "Family"],
    adultCount: 4,
    childCount: 2,
    facilities: [
      "Free WiFi",
      "Parking",
      "Family Rooms",
      "Non-Smoking Rooms",
    ],
    pricePerNight: 140,
    starRating: 4,
    imageUrls,
    lastUpdated: new Date(),
    contact: {
      phone: "+39 0831 1785476",
      email: "info@palazzopintobnb.com",
      website: "https://palazzopintobnb.com/en/",
    },
    policies: {
      checkInTime: "14:00",
      checkOutTime: "10:00",
      cancellationPolicy: "Please refer to current booking terms on official website.",
      petPolicy: "Not specified",
      smokingPolicy: "Non-smoking rooms",
    },
    amenities: {
      parking: true,
      wifi: true,
      pool: false,
      gym: false,
      spa: false,
      restaurant: false,
      bar: false,
      airportShuttle: false,
      businessCenter: false,
    },
    updatedAt: new Date(),
  };

  const result = await Hotel.findOneAndUpdate(
    { name: roomDocument.name, city: roomDocument.city, country: roomDocument.country },
    roomDocument,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(`Seed completed for room: ${result.name}`);
  console.log(`Images linked: ${result.imageUrls.length}`);
  console.log(`Price per night: EUR ${result.pricePerNight}`);
};

seedFuocorosa()
  .catch((error) => {
    console.error("Fuocorosa seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
