import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { roomCatalog } from "../../../shared/roomCatalog";
import Booking from "../models/booking";
import BookingDayStatus from "../models/booking-day-status";
import Hotel from "../models/hotel";

const PALAZZO_SITE_URL = "https://palazzopinto-web-2603151048.azurewebsites.net/";

const PALAZZO_BASE = {
  userId: "palazzopintobnb-owner",
  city: "Brindisi",
  country: "Italy",
  contact: {
    phone: "+39 0831 1785476",
    email: "info@palazzopintobnb.com",
    website: PALAZZO_SITE_URL,
  },
  policies: {
    checkInTime: "14:00",
    checkOutTime: "10:00",
    cancellationPolicy: "Free cancellation up to 7 days before arrival. Bookings made within 7 days of check-in are non-refundable.",
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

const rooms = Object.values(roomCatalog);

const getImages = (folder: string, preferredImages: string[]): string[] => {
  const imagesDir = path.resolve(
    process.cwd(),
    `../hotel-booking-frontend/public/${folder}`
  );

  if (!fs.existsSync(imagesDir)) {
    return [];
  }

  const availableImages = fs
    .readdirSync(imagesDir)
    .filter((fileName) => /\.(png|jpe?g|webp)$/i.test(fileName))
    .sort((a, b) => a.localeCompare(b))
    .map((fileName) => `/${folder}/${fileName}`);

  const preferredSet = new Set(preferredImages);
  const orderedPreferredImages = preferredImages.filter((image) =>
    availableImages.includes(image)
  );
  const remainingImages = availableImages.filter(
    (image) => !preferredSet.has(image)
  );

  return [...orderedPreferredImages, ...remainingImages];
};

const pickCanonicalRoom = async (
  candidates: Array<InstanceType<typeof Hotel>>,
  targetSlug: string
) => {
  if (candidates.length === 1) {
    return candidates[0];
  }

  const sluggedCandidate = candidates.find(
    (candidate) => candidate.slug === targetSlug
  );

  if (sluggedCandidate) {
    return sluggedCandidate;
  }

  const candidatesWithBookingCounts = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      bookingsCount: await Booking.countDocuments({ hotelId: String(candidate._id) }),
    }))
  );

  candidatesWithBookingCounts.sort((left, right) => {
    if (right.bookingsCount !== left.bookingsCount) {
      return right.bookingsCount - left.bookingsCount;
    }

    if (Boolean(right.candidate.slug) !== Boolean(left.candidate.slug)) {
      return Number(Boolean(right.candidate.slug)) - Number(Boolean(left.candidate.slug));
    }

    return (
      new Date(left.candidate.createdAt ?? 0).getTime() -
      new Date(right.candidate.createdAt ?? 0).getTime()
    );
  });

  return candidatesWithBookingCounts[0].candidate;
};

const mergeDuplicateRooms = async (
  canonicalRoomId: string,
  duplicateRoomIds: string[]
) => {
  if (duplicateRoomIds.length === 0) {
    return;
  }

  await Booking.updateMany(
    { hotelId: { $in: duplicateRoomIds } },
    { $set: { hotelId: canonicalRoomId } }
  );

  await BookingDayStatus.updateMany(
    { hotelId: { $in: duplicateRoomIds } },
    { $set: { hotelId: canonicalRoomId } }
  );

  await Hotel.deleteMany({ _id: { $in: duplicateRoomIds } });
};

const run = async () => {
  const connectionString = process.env.MONGODB_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("MONGODB_CONNECTION_STRING is not set");
  }

  await mongoose.connect(connectionString);

  for (const room of rooms) {
    const images = getImages(room.folder, room.images);

    const existingMatches = await Hotel.find({
      city: PALAZZO_BASE.city,
      country: PALAZZO_BASE.country,
      $or: [{ slug: room.slug }, { name: room.hotelName }],
    });

    const existing =
      existingMatches.length > 0
        ? await pickCanonicalRoom(existingMatches, room.slug)
        : null;

    if (!existing && images.length === 0) {
      console.log(
        `[SKIP] ${room.hotelName} - add images in hotel-booking-frontend/public/${room.folder}`
      );
      continue;
    }

    const imageUrls = images.length > 0 ? images : existing?.imageUrls || [];

    const payload = {
      ...PALAZZO_BASE,
      slug: room.slug,
      originalUrl: room.originalUrl,
      minimumNights: room.minimumNights,
      name: room.hotelName,
      description: room.description,
      type: room.type,
      adultCount: room.maxAdults,
      childCount: room.maxChildren,
      facilities: room.facilities,
      pricePerNight: room.pricePerNight,
      imageUrls,
      lastUpdated: new Date(),
      updatedAt: new Date(),
    };

    let saved;

    if (existing) {
      Object.assign(existing, payload);
      saved = await existing.save();

      const duplicateRoomIds = existingMatches
        .filter((candidate) => String(candidate._id) !== String(saved._id))
        .map((candidate) => String(candidate._id));

      await mergeDuplicateRooms(String(saved._id), duplicateRoomIds);
    } else {
      saved = await Hotel.create(payload);
    }

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
