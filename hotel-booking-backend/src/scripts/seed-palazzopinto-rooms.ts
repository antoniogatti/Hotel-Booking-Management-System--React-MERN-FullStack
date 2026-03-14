import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import Hotel from "../models/hotel";

type RoomSeed = {
  name: string;
  folder: string;
  description: string;
  pricePerNight: number;
  adultCount: number;
  childCount: number;
  type: string[];
  facilities: string[];
};

const PALAZZO_BASE = {
  userId: "palazzopintobnb-owner",
  city: "Brindisi",
  country: "Italy",
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
  starRating: 4,
} as const;

const rooms: RoomSeed[] = [
  {
    name: "Malvasia - Double Room",
    folder: "malvasia",
    description:
      "In the comfort of a spacious queen-size bed and a private balcony, MALVASIA offers all essentials for a couple getaway or business trip.",
    pricePerNight: 100,
    adultCount: 2,
    childCount: 0,
    type: ["Boutique", "Romantic"],
    facilities: ["Free WiFi", "Non-Smoking Rooms"],
  },
  {
    name: "Verdeca - Double Room",
    folder: "verdeca",
    description:
      "VERDECA is a refined double room with queen-size bed and private balcony, designed for a calm and comfortable stay.",
    pricePerNight: 110,
    adultCount: 2,
    childCount: 0,
    type: ["Boutique", "Romantic"],
    facilities: ["Free WiFi", "Non-Smoking Rooms"],
  },
  {
    name: "Aleatico - King Studio with sofa bed",
    folder: "aleatico",
    description:
      "ALEATICO apartment features equipped kitchen, dining area, living room with sofa bed, private bathroom, and modern appliances for independent stays.",
    pricePerNight: 130,
    adultCount: 4,
    childCount: 0,
    type: ["Boutique", "Self Catering", "Family"],
    facilities: ["Free WiFi", "Family Rooms", "Non-Smoking Rooms"],
  },
  {
    name: "Fuocorosa - Apartment",
    folder: "fuocorosa",
    description:
      "In the comfort of a spacious and well-furnished apartment, everyone can find their ideal space to dedicate precious time to themselves. In our FUOCOROSA apartment, with its contemporary style and authentic furnishings, you will find all the comforts needed for a perfect vacation. FUOCOROSA is located entirely on the ground floor with no stairs, making it easily accessible for everyone. The apartment includes a fully equipped kitchen, perfect for preparing delicious meals independently. The cozy dining room and the living room with a comfortable sofa bed offer ideal spaces for relaxing and socializing, comfortably accommodating up to four people. The bedroom features a large double bed, ensuring a restful sleep. The private bathroom is equipped with a shower, soft towels, a hairdryer, and a courtesy kit, ensuring a total comfort experience. Our guests can take advantage of modern appliances such as the refrigerator, dishwasher, washing machine, and iron, making the stay even more convenient. A TV completes the list of comforts that this cozy apartment offers, ensuring moments of entertainment and relaxation.",
    pricePerNight: 140,
    adultCount: 4,
    childCount: 0,
    type: ["Boutique", "Self Catering", "Family"],
    facilities: ["Free WiFi", "Parking", "Family Rooms", "Non-Smoking Rooms"],
  },
];

const getImages = (folder: string): string[] => {
  const imagesDir = path.resolve(
    process.cwd(),
    `../hotel-booking-frontend/public/${folder}`
  );

  if (!fs.existsSync(imagesDir)) {
    return [];
  }

  return fs
    .readdirSync(imagesDir)
    .filter((fileName) => /\.(png|jpe?g|webp)$/i.test(fileName))
    .sort((a, b) => a.localeCompare(b))
    .map((fileName) => `/${folder}/${fileName}`);
};

const run = async () => {
  const connectionString = process.env.MONGODB_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("MONGODB_CONNECTION_STRING is not set");
  }

  await mongoose.connect(connectionString);

  for (const room of rooms) {
    const images = getImages(room.folder);

    const existing = await Hotel.findOne({
      name: room.name,
      city: PALAZZO_BASE.city,
      country: PALAZZO_BASE.country,
    });

    if (!existing && images.length === 0) {
      console.log(
        `[SKIP] ${room.name} - add images in hotel-booking-frontend/public/${room.folder}`
      );
      continue;
    }

    const imageUrls = images.length > 0 ? images : existing?.imageUrls || [];

    const payload = {
      ...PALAZZO_BASE,
      name: room.name,
      description: room.description,
      type: room.type,
      adultCount: room.adultCount,
      childCount: room.childCount,
      facilities: room.facilities,
      pricePerNight: room.pricePerNight,
      imageUrls,
      lastUpdated: new Date(),
      updatedAt: new Date(),
    };

    const saved = await Hotel.findOneAndUpdate(
      {
        name: room.name,
        city: PALAZZO_BASE.city,
        country: PALAZZO_BASE.country,
      },
      payload,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(
      `[OK] ${saved.name} | EUR ${saved.pricePerNight} | images=${saved.imageUrls.length}`
    );
  }
};

run()
  .catch((error) => {
    console.error("Room seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
