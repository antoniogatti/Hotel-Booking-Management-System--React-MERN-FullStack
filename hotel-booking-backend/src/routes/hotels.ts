import express, { Request, Response } from "express";
import Hotel from "../models/hotel";
import Booking from "../models/booking";
import User from "../models/user";
import { BookingType, HotelSearchResponse } from "../../../shared/types";
import { body, param, validationResult } from "express-validator";
import { randomBytes } from "crypto";
import Stripe from "stripe";
import verifyToken from "../middleware/auth";
import { sendBookingRequestEmails } from "../lib/contact-mail";

const stripe = new Stripe(process.env.STRIPE_API_KEY as string);

const router = express.Router();
const DUPLICATE_BOOKING_WINDOW_MS = 30 * 60 * 1000;

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

const findOverlappingBooking = async (params: {
  hotelId: string;
  checkIn: Date;
  checkOut: Date;
}) => {
  return Booking.findOne({
    hotelId: params.hotelId,
    status: { $in: ["pending", "confirmed", "arrived", "completed"] },
    checkIn: { $lt: params.checkOut },
    checkOut: { $gt: params.checkIn },
  }).select("_id reservationNumber status checkIn checkOut");
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
    }

    const pageSize = 5;
    const pageNumber = parseInt(
      req.query.page ? req.query.page.toString() : "1"
    );
    const skip = (pageNumber - 1) * pageSize;

    const hotels = await Hotel.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(pageSize);

    const total = await Hotel.countDocuments(query);

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

      const checkIn = new Date(req.body.checkIn);
      const checkOut = new Date(req.body.checkOut);
      const normalizedEmail = String(req.body.email).trim().toLowerCase();

      if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
        return res.status(400).json({ message: "Invalid booking dates" });
      }

      if (checkOut < checkIn) {
        return res.status(400).json({ message: "Check-out date cannot be earlier than check-in date" });
      }

      if (req.body.adultCount > hotel.adultCount || req.body.childCount > hotel.childCount) {
        return res.status(400).json({
          message: "Guest count exceeds the room capacity",
        });
      }

      const overlappingBooking = await findOverlappingBooking({
        hotelId,
        checkIn,
        checkOut,
      });

      if (overlappingBooking) {
        return res.status(409).json({
          message:
            "This room is not available for the selected dates because there is already a booking/request in the same period.",
          bookingId: overlappingBooking._id,
          reservationNumber: overlappingBooking.reservationNumber,
          conflictStatus: overlappingBooking.status,
        });
      }

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

      const nights = calculateNights(checkIn, checkOut);
      const totalCost = hotel.pricePerNight * nights;
      const reservationNumber = await generateUniqueReservationNumber();

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
        paymentStatus: "pending",
      };

      const newBooking = new Booking(bookingRequest);
      await newBooking.save();

      let emailsSent = true;
      let warning: string | undefined;

      try {
        await sendBookingRequestEmails({
          reservationNumber,
          hotelName: hotel.name,
          roomName: req.body.roomName,
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
  "/:hotelId/bookings/payment-intent",
  verifyToken,
  async (req: Request, res: Response) => {
    const { numberOfNights } = req.body;
    const hotelId = req.params.hotelId;

    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
      return res.status(400).json({ message: "Hotel not found" });
    }

    const totalCost = hotel.pricePerNight * numberOfNights;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCost * 100,
      currency: "gbp",
      metadata: {
        hotelId,
        userId: req.userId,
      },
    });

    if (!paymentIntent.client_secret) {
      return res.status(500).json({ message: "Error creating payment intent" });
    }

    const response = {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret.toString(),
      totalCost,
    };

    res.send(response);
  }
);

router.post(
  "/:hotelId/bookings",
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const paymentIntentId = req.body.paymentIntentId;

      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId as string
      );

      if (!paymentIntent) {
        return res.status(400).json({ message: "payment intent not found" });
      }

      if (
        paymentIntent.metadata.hotelId !== req.params.hotelId ||
        paymentIntent.metadata.userId !== req.userId
      ) {
        return res.status(400).json({ message: "payment intent mismatch" });
      }

      if (paymentIntent.status !== "succeeded") {
        return res.status(400).json({
          message: `payment intent not succeeded. Status: ${paymentIntent.status}`,
        });
      }

      const checkIn = new Date(req.body.checkIn);
      const checkOut = new Date(req.body.checkOut);

      if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
        return res.status(400).json({ message: "Invalid booking dates" });
      }

      if (checkOut <= checkIn) {
        return res.status(400).json({ message: "Check-out must be after check-in" });
      }

      const overlappingBooking = await findOverlappingBooking({
        hotelId: req.params.hotelId,
        checkIn,
        checkOut,
      });

      if (overlappingBooking) {
        return res.status(409).json({
          message:
            "This room is not available for the selected dates because there is already a booking/request in the same period.",
          bookingId: overlappingBooking._id,
          reservationNumber: overlappingBooking.reservationNumber,
          conflictStatus: overlappingBooking.status,
        });
      }

      const reservationNumber = await generateUniqueReservationNumber();

      const newBooking: BookingType = {
        ...req.body,
        reservationNumber,
        userId: req.userId,
        hotelId: req.params.hotelId,
        createdAt: new Date(), // Add booking creation timestamp
        status: "confirmed", // Set initial status
        paymentStatus: "paid", // Set payment status since payment succeeded
      };

      // Create booking in separate collection
      const booking = new Booking(newBooking);
      await booking.save();

      // Update hotel analytics
      await Hotel.findByIdAndUpdate(req.params.hotelId, {
        $inc: {
          totalBookings: 1,
          totalRevenue: newBooking.totalCost,
        },
      });

      // Update user analytics
      await User.findByIdAndUpdate(req.userId, {
        $inc: {
          totalBookings: 1,
          totalSpent: newBooking.totalCost,
        },
      });

      res.status(200).send();
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "something went wrong" });
    }
  }
);

const constructSearchQuery = (queryParams: any) => {
  let constructedQuery: any = {};

  if (queryParams.destination && queryParams.destination.trim() !== "") {
    const destination = queryParams.destination.trim();

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
