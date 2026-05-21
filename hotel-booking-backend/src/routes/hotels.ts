import express, { Request, Response } from "express";
import Hotel from "../models/hotel";
import Booking from "../models/booking";
import BookingDayStatus from "../models/booking-day-status";
import User from "../models/user";
import {
  findOverlappingImportedEvent,
  getImportedUnavailableHotelIds,
} from "../lib/booking-com-ical";
import { BookingType, HotelSearchResponse } from "../../../shared/types";
import { body, param, validationResult } from "express-validator";
import { randomBytes } from "crypto";
import verifyToken from "../middleware/auth";
import { sendBookingRequestEmails } from "../lib/contact-mail";
import { recordAuditEvent } from "../lib/audit-log";

const router = express.Router();
const DUPLICATE_BOOKING_WINDOW_MS = 30 * 60 * 1000;
const BOOKING_DATE_TIME_ZONE = process.env.BOOKING_DATE_TIME_ZONE || "Europe/Rome";

const buildReservationNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = randomBytes(3).toString("hex").toUpperCase();
  return `PP-${date}-${randomSuffix}`;
};

const generateUniqueReservationNumber = async () => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = buildReservationNumber();
    const existing = await Booking.exists({ reservationNumber: candidate });
    if (!existing) {
      return candidate;
    }
  }

  throw new Error("Unable to generate a unique reservation number");
};

const calculateNights = (checkIn: Date, checkOut: Date) => {
  const diff = checkOut.getTime() - checkIn.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const getMinimumNights = (hotel: { minimumNights?: number }) =>
  Math.max(1, Number(hotel.minimumNights) || 1);

type AvailabilityAssessment = {
  available: boolean;
  message?: string;
  reason?:
    | "invalid_dates"
    | "minimum_stay"
    | "guest_capacity"
    | "overlap"
    | "room_not_found";
  minimumNights?: number;
  conflict?: {
    bookingId: unknown;
    reservationNumber?: string;
    status?: string;
  };
};

const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed", "arrived", "completed"] as const;

const getDayStart = (date: Date) => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const buildUtcDateOnly = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day));

const normalizeBookingDate = (value: string | Date) => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return new Date(NaN);
    }

    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: BOOKING_DATE_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value);

    const year = Number(parts.find((part) => part.type === "year")?.value);
    const month = Number(parts.find((part) => part.type === "month")?.value);
    const day = Number(parts.find((part) => part.type === "day")?.value);

    if (!year || !month || !day) {
      return new Date(NaN);
    }

    return buildUtcDateOnly(year, month, day);
  }

  const raw = String(value || "").trim();
  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    return buildUtcDateOnly(Number(ymdMatch[1]), Number(ymdMatch[2]), Number(ymdMatch[3]));
  }

  return normalizeBookingDate(new Date(raw));
};

const getAvailableHotelsForStay = async <THotel extends { _id: unknown }>(params: {
  hotels: THotel[];
  checkIn?: string;
  checkOut?: string;
  minimumNights?: Array<{ _id: unknown; minimumNights?: number }>;
}) => {
  const { hotels, checkIn, checkOut } = params;

  if (!checkIn || !checkOut || hotels.length === 0) {
    return hotels;
  }

  const checkInDate = normalizeBookingDate(checkIn);
  const checkOutDate = normalizeBookingDate(checkOut);

  if (
    Number.isNaN(checkInDate.getTime()) ||
    Number.isNaN(checkOutDate.getTime()) ||
    checkOutDate <= checkInDate
  ) {
    return [];
  }

  const requestedNights = calculateNights(checkInDate, checkOutDate);
  const hotelsMeetingStayRules = hotels.filter((hotel) => {
    const minimumNights = getMinimumNights(hotel as { minimumNights?: number });
    return requestedNights >= minimumNights;
  });

  if (hotelsMeetingStayRules.length === 0) {
    return [];
  }

  const hotelIds = hotelsMeetingStayRules.map((hotel) => String(hotel._id));
  const stayStart = getDayStart(checkInDate);
  const stayEnd = getDayStart(checkOutDate);

  const [bookedHotelIds, closedHotelIds, importedHotelIds] = await Promise.all([
    Booking.distinct("hotelId", {
      hotelId: { $in: hotelIds },
      status: { $in: ACTIVE_BOOKING_STATUSES },
      checkIn: { $lt: checkOutDate },
      checkOut: { $gt: checkInDate },
    }),
    BookingDayStatus.distinct("hotelId", {
      hotelId: { $in: hotelIds },
      status: "closed",
      date: { $gte: stayStart, $lt: stayEnd },
    }),
    getImportedUnavailableHotelIds({
      hotelIds,
      checkIn: checkInDate,
      checkOut: checkOutDate,
    }),
  ]);

  const unavailableHotelIds = new Set<string>([
    ...bookedHotelIds.map(String),
    ...closedHotelIds.map(String),
    ...importedHotelIds.map(String),
  ]);

  return hotelsMeetingStayRules.filter(
    (hotel) => !unavailableHotelIds.has(String(hotel._id))
  );
};

const findOverlappingBooking = async (params: {
  hotelId: string;
  checkIn: Date;
  checkOut: Date;
}) => {
  const booking = await Booking.findOne({
    hotelId: params.hotelId,
    status: { $in: ["pending", "confirmed", "arrived", "completed"] },
    checkIn: { $lt: params.checkOut },
    checkOut: { $gt: params.checkIn },
  }).select("_id reservationNumber status checkIn checkOut");

  if (booking) {
    return booking;
  }

  const importedEvent = await findOverlappingImportedEvent(params);

  if (!importedEvent) {
    return null;
  }

  return {
    _id: importedEvent._id,
    reservationNumber: importedEvent.externalUid,
    status: "imported",
    checkIn: importedEvent.startDate,
    checkOut: importedEvent.endDate,
  };
};

const assessHotelAvailability = async (params: {
  hotel: {
    _id: unknown;
    adultCount: number;
    childCount: number;
    minimumNights?: number;
  };
  checkIn: Date;
  checkOut: Date;
  adultCount: number;
  childCount: number;
}): Promise<AvailabilityAssessment> => {
  const { hotel, checkIn, checkOut, adultCount, childCount } = params;

  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
    return {
      available: false,
      reason: "invalid_dates",
      message: "Please select a valid check-in and check-out range.",
    };
  }

  const nights = calculateNights(checkIn, checkOut);
  const minimumNights = getMinimumNights(hotel);

  if (nights < minimumNights) {
    return {
      available: false,
      reason: "minimum_stay",
      minimumNights,
      message: `Minimum stay for this room is ${minimumNights} night${minimumNights === 1 ? "" : "s"}.`,
    };
  }

  if (adultCount > hotel.adultCount || childCount > hotel.childCount) {
    return {
      available: false,
      reason: "guest_capacity",
      message: "Guest count exceeds the room capacity.",
    };
  }

  const overlappingBooking = await findOverlappingBooking({
    hotelId: String(hotel._id),
    checkIn,
    checkOut,
  });

  if (overlappingBooking) {
    return {
      available: false,
      reason: "overlap",
      message:
        "This room is not available for the selected dates because there is already a booking or blocked period in the same range.",
      conflict: {
        bookingId: overlappingBooking._id,
        reservationNumber: overlappingBooking.reservationNumber,
        status: overlappingBooking.status,
      },
    };
  }

  return {
    available: true,
    minimumNights,
  };
};

router.get("/search", async (req: Request, res: Response) => {
  try {
    const query = constructSearchQuery(req.query);

    let sortOptions = {};
    switch (req.query.sortOption) {
      case "starRating":
        sortOptions = { starRating: -1 };
        break;
      case "pricePerNightAsc":
        sortOptions = { pricePerNight: 1 };
        break;
      case "pricePerNightDesc":
        sortOptions = { pricePerNight: -1 };
        break;
      default:
        sortOptions = { pricePerNight: 1 };
        break;
    }

    const pageSize = 5;
    const pageNumber = parseInt(
      req.query.page ? req.query.page.toString() : "1"
    );
    const skip = (pageNumber - 1) * pageSize;

    const matchedHotels = await Hotel.find(query)
      .sort(sortOptions)
      .lean();

    const availableHotels = await getAvailableHotelsForStay({
      hotels: matchedHotels,
      checkIn: req.query.checkIn?.toString(),
      checkOut: req.query.checkOut?.toString(),
    });

    const total = availableHotels.length;
    const hotels = availableHotels.slice(skip, skip + pageSize);

    const response: HotelSearchResponse = {
      data: hotels,
      pagination: {
        total,
        page: pageNumber,
        pages: Math.ceil(total / pageSize),
      },
    };

    res.json(response);
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const hotels = await Hotel.find().sort("-lastUpdated");
    res.json(hotels);
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: "Error fetching hotels" });
  }
});

router.get(
  "/:id",
  [param("id").notEmpty().withMessage("Hotel ID is required")],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const id = req.params.id.toString();

    try {
      const hotel = await Hotel.findById(id);
      res.json(hotel);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Error fetching hotel" });
    }
  }
);

router.get(
  "/:hotelId/availability",
  [
    param("hotelId").notEmpty().withMessage("Hotel ID is required"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const hotel = await Hotel.findById(req.params.hotelId).select(
        "_id name adultCount childCount minimumNights"
      );

      if (!hotel) {
        return res.status(404).json({
          available: false,
          reason: "room_not_found",
          message: "Room not found",
        });
      }

      const checkIn = normalizeBookingDate(String(req.query.checkIn || ""));
      const checkOut = normalizeBookingDate(String(req.query.checkOut || ""));
      const adultCount = Math.max(1, Number(req.query.adultCount) || 1);
      const childCount = Math.max(0, Number(req.query.childCount) || 0);

      const availability = await assessHotelAvailability({
        hotel,
        checkIn,
        checkOut,
        adultCount,
        childCount,
      });

      return res.json(availability);
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        available: false,
        message: "Unable to check room availability",
      });
    }
  }
);

router.post(
  "/:hotelId/booking-request",
  [
    param("hotelId").notEmpty().withMessage("Hotel ID is required"),
    body("firstName").trim().notEmpty().withMessage("First name is required"),
    body("lastName").trim().notEmpty().withMessage("Last name is required"),
    body("email").isEmail().withMessage("A valid email is required"),
    body("phone").trim().notEmpty().withMessage("Phone is required"),
    body("city").trim().notEmpty().withMessage("City is required"),
    body("country").trim().notEmpty().withMessage("Country is required"),
    body("nationality").trim().notEmpty().withMessage("Nationality is required"),
    body("adultCount").isInt({ min: 1 }).withMessage("Adult count is required"),
    body("childCount").isInt({ min: 0 }).withMessage("Child count must be 0 or greater"),
    body("checkIn").isISO8601().withMessage("Check-in date is invalid"),
    body("checkOut").isISO8601().withMessage("Check-out date is invalid"),
    body("totalCost").isNumeric().withMessage("Total cost is required"),
    body("nights").isInt({ min: 1 }).withMessage("Nights is required"),
    body("hotelName").trim().notEmpty().withMessage("Hotel name is required"),
    body("roomName").trim().notEmpty().withMessage("Room name is required"),
    body("arrivalTime")
      .isIn(["Morning", "Afternoon", "Evening", "Night"])
      .withMessage("Arrival time is invalid"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const hotelId = req.params.hotelId;
      const hotel = await Hotel.findById(hotelId);

      if (!hotel) {
        return res.status(404).json({ message: "Hotel not found" });
      }

      const checkIn = normalizeBookingDate(String(req.body.checkIn || ""));
      const checkOut = normalizeBookingDate(String(req.body.checkOut || ""));
      const normalizedEmail = String(req.body.email).trim().toLowerCase();

      if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
        return res.status(400).json({ message: "Invalid booking dates" });
      }

      if (checkOut < checkIn) {
        return res.status(400).json({ message: "Check-out date cannot be earlier than check-in date" });
      }

      const availability = await assessHotelAvailability({
        hotel,
        checkIn,
        checkOut,
        adultCount: Number(req.body.adultCount),
        childCount: Number(req.body.childCount),
      });

      if (!availability.available) {
        const statusCode = availability.reason === "overlap" ? 409 : 400;
        return res.status(statusCode).json({
          message: availability.message,
          bookingId: availability.conflict?.bookingId,
          reservationNumber: availability.conflict?.reservationNumber,
          conflictStatus: availability.conflict?.status,
        });
      }

      const nights = calculateNights(checkIn, checkOut);

      const duplicateThreshold = new Date(Date.now() - DUPLICATE_BOOKING_WINDOW_MS);
      const existingRecentBooking = await Booking.findOne({
        hotelId,
        email: normalizedEmail,
        checkIn,
        checkOut,
        createdAt: { $gte: duplicateThreshold },
        status: { $in: ["pending", "confirmed"] },
      }).sort({ createdAt: -1 });

      if (existingRecentBooking) {
        return res.status(409).json({
          message: "A booking request for the same guest and stay dates was already submitted recently.",
          bookingId: existingRecentBooking._id,
          reservationNumber: existingRecentBooking.reservationNumber,
        });
      }

      const totalCost = hotel.pricePerNight * nights;
      const reservationNumber = await generateUniqueReservationNumber();
      const canonicalRoomName =
        String(hotel.name || "").trim() || String(req.body.roomName || "").trim() || "Room";

      const bookingRequest = {
        reservationNumber,
        userId: "guest-request",
        hotelId,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: normalizedEmail,
        phone: req.body.phone,
        city: req.body.city,
        country: req.body.country,
        arrivalTime: req.body.arrivalTime,
        nationality: req.body.nationality,
        adultCount: Number(req.body.adultCount),
        childCount: Number(req.body.childCount),
        checkIn,
        checkOut,
        totalCost,
        specialRequests: req.body.specialRequests || "",
        status: "pending",
      };

      const newBooking = new Booking(bookingRequest);
      await newBooking.save();

      await recordAuditEvent({
        action: "booking.requested",
        entityType: "booking",
        entityId: String(newBooking._id),
        hotelId: String(hotelId),
        actorId: newBooking.userId,
        actorEmail: normalizedEmail,
        req,
        metadata: {
          reservationNumber,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          totalCost,
          status: newBooking.status,
        },
      });

      let emailsSent = true;
      let warning: string | undefined;

      try {
        await sendBookingRequestEmails({
          bookingId: String(newBooking._id),
          reservationNumber,
          hotelName: hotel.name,
          roomName: canonicalRoomName,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: normalizedEmail,
          phone: req.body.phone,
          city: req.body.city,
          country: req.body.country,
          nationality: req.body.nationality,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          adultCount: Number(req.body.adultCount),
          childCount: Number(req.body.childCount),
          nights,
          totalCost,
          arrivalTime: req.body.arrivalTime,
          specialRequests: req.body.specialRequests,
          coupon: req.body.coupon,
        });
      } catch (emailError) {
        emailsSent = false;
        warning = "Booking saved, but confirmation emails could not be sent immediately.";
        console.log("Booking request email delivery failed", emailError);
      }

      return res.status(200).json({
        message: emailsSent
          ? "Booking request submitted successfully"
          : "Booking request saved with email delivery pending",
        bookingId: newBooking._id,
        reservationNumber,
        emailsSent,
        warning,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Unable to submit booking request" });
    }
  }
);

router.post(
  "/:hotelId/bookings",
  verifyToken,
  async (req: Request, res: Response) => {
    return res.status(410).json({
      message: "Direct paid bookings have been removed. Use the booking request flow instead.",
    });
  }
);

const escapeRegexLiteral = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const constructSearchQuery = (queryParams: any) => {
  let constructedQuery: any = {};

  if (queryParams.destination && queryParams.destination.trim() !== "") {
    const destination = escapeRegexLiteral(queryParams.destination.trim().slice(0, 100));

    constructedQuery.$or = [
      { city: { $regex: destination, $options: "i" } },
      { country: { $regex: destination, $options: "i" } },
    ];
  }

  if (queryParams.adultCount) {
    constructedQuery.adultCount = {
      $gte: parseInt(queryParams.adultCount),
    };
  }

  if (queryParams.childCount) {
    constructedQuery.childCount = {
      $gte: parseInt(queryParams.childCount),
    };
  }

  if (queryParams.facilities) {
    constructedQuery.facilities = {
      $all: Array.isArray(queryParams.facilities)
        ? queryParams.facilities
        : [queryParams.facilities],
    };
  }

  if (queryParams.types) {
    constructedQuery.type = {
      $in: Array.isArray(queryParams.types)
        ? queryParams.types
        : [queryParams.types],
    };
  }

  if (queryParams.stars) {
    const starRatings = Array.isArray(queryParams.stars)
      ? queryParams.stars.map((star: string) => parseInt(star))
      : parseInt(queryParams.stars);

    constructedQuery.starRating = { $in: starRatings };
  }

  if (queryParams.maxPrice) {
    constructedQuery.pricePerNight = {
      $lte: parseInt(queryParams.maxPrice).toString(),
    };
  }

  return constructedQuery;
};

export default router;
