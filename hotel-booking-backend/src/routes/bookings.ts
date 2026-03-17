import express, { Request, Response } from "express";
import multer from "multer";
import Booking from "../models/booking";
import Hotel from "../models/hotel";
import User from "../models/user";
import verifyToken from "../middleware/auth";
import requireRole from "../middleware/requireRole";
import BookingDayStatus from "../models/booking-day-status";
import {
  sendBookingDecisionEmails,
  sendCheckInNotificationEmail,
} from "../lib/contact-mail";
import { body, param, query, validationResult } from "express-validator";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
});

const toUtcStartOfDay = (value: string | Date) => {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const formatDayKey = (date: Date) => date.toISOString().slice(0, 10);

const parseMonthRange = (month: string) => {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new Error("Invalid month format");
  }

  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));
  return { start, end };
};

const getAccessibleHotel = async (hotelId: string, req: Request) => {
  const hotel = await Hotel.findById(hotelId).select("_id userId name city country");

  if (!hotel) {
    return { error: { status: 404, message: "Hotel not found" } };
  }

  if (req.userRole !== "admin" && hotel.userId !== req.userId) {
    return { error: { status: 403, message: "Access denied" } };
  }

  return { hotel };
};

const toBookingCalendarStatus = (status: string | undefined) => {
  if (status === "pending") return "Requested";
  if (status === "confirmed" || status === "arrived" || status === "completed") return "Booked";
  if (status === "cancelled" || status === "refunded") return "Available";
  return "Available";
};

const toDecisionStatus = (decision: "confirm" | "reject") =>
  decision === "confirm" ? "confirmed" : "cancelled";

const uploadDocuments = async (documentFiles: any[]) => {
  const uploadPromises = documentFiles.map(async (document) => {
    const b64 = Buffer.from(document.buffer as Uint8Array).toString("base64");
    const dataURI = `data:${document.mimetype};base64,${b64}`;
    return dataURI;
  });

  return Promise.all(uploadPromises);
};

const calculateCityTax = (booking: {
  checkIn: Date;
  checkOut: Date;
  adultCount: number;
  childCount: number;
}) => {
  const checkIn = new Date(booking.checkIn);
  const checkOut = new Date(booking.checkOut);
  const ms = checkOut.getTime() - checkIn.getTime();
  const nights = Math.max(1, Math.ceil(ms / 86400000));
  const taxableDays = Math.min(nights, 7);
  const guests = Math.max(1, booking.adultCount + booking.childCount);
  return Number((taxableDays * guests * 2.5).toFixed(2));
};

// List rooms available for bookings management (admin: all, owner: own rooms)
router.get(
  "/rooms",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  async (req: Request, res: Response) => {
    try {
      const hotelQuery = req.userRole === "admin" ? {} : { userId: req.userId };

      const hotels = await Hotel.find(hotelQuery)
        .sort({ name: 1 })
        .select("_id name city country userId");

      res.status(200).json(
        hotels.map((hotel) => ({
          _id: hotel._id,
          name: hotel.name,
          city: hotel.city,
          country: hotel.country,
        }))
      );
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Unable to fetch rooms" });
    }
  }
);

// Get a monthly room calendar with day status and booking table rows
router.get(
  "/calendar/:hotelId",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  [
    param("hotelId").notEmpty().withMessage("Hotel ID is required"),
    query("month")
      .optional()
      .matches(/^\d{4}-\d{2}$/)
      .withMessage("Month must use YYYY-MM format"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const month = String(req.query.month || new Date().toISOString().slice(0, 7));
      const { start, end } = parseMonthRange(month);
      const hotelId = req.params.hotelId;

      const accessCheck = await getAccessibleHotel(hotelId, req);
      if (accessCheck.error) {
        return res.status(accessCheck.error.status).json({ message: accessCheck.error.message });
      }

      const bookings = await Booking.find({
        hotelId,
        status: { $in: ["pending", "confirmed", "arrived", "completed"] },
        checkIn: { $lt: end },
        checkOut: { $gt: start },
      })
        .sort({ checkIn: 1, createdAt: -1 })
        .select(
          "_id reservationNumber firstName lastName email phone checkIn checkOut status totalCost adultCount childCount createdAt"
        );

      const closedDates = await BookingDayStatus.find({
        hotelId,
        status: "closed",
        date: { $gte: start, $lt: end },
      }).select("date note");

      const dayMap = new Map<
        string,
        {
          date: string;
          status: "Available" | "Requested" | "Booked" | "Closed";
          requestedCount: number;
          bookedCount: number;
          closed: boolean;
          closedReason?: string;
        }
      >();

      for (let cursor = new Date(start); cursor < end; cursor = new Date(cursor.getTime() + 86400000)) {
        const key = formatDayKey(cursor);
        dayMap.set(key, {
          date: key,
          status: "Available",
          requestedCount: 0,
          bookedCount: 0,
          closed: false,
          closedReason: undefined,
        });
      }

      closedDates.forEach((day) => {
        const key = formatDayKey(toUtcStartOfDay(day.date));
        const target = dayMap.get(key);
        if (target) {
          target.closed = true;
          target.status = "Closed";
          target.closedReason = day.note || "";
        }
      });

      bookings.forEach((booking) => {
        const checkIn = toUtcStartOfDay(booking.checkIn);
        const checkOut = toUtcStartOfDay(booking.checkOut);
        const effectiveStart = checkIn < start ? start : checkIn;
        const effectiveEnd = checkOut > end ? end : checkOut;

        for (
          let cursor = new Date(effectiveStart);
          cursor < effectiveEnd;
          cursor = new Date(cursor.getTime() + 86400000)
        ) {
          const key = formatDayKey(cursor);
          const target = dayMap.get(key);
          if (!target || target.closed) {
            continue;
          }

          if (booking.status === "pending") {
            target.requestedCount += 1;
            if (target.status !== "Booked") {
              target.status = "Requested";
            }
          } else {
            target.bookedCount += 1;
            target.status = "Booked";
          }
        }
      });

      const bookingRows = bookings.map((booking) => ({
        _id: booking._id,
        reservationNumber: booking.reservationNumber,
        firstName: booking.firstName,
        lastName: booking.lastName,
        email: booking.email,
        phone: booking.phone,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        status: toBookingCalendarStatus(booking.status),
        totalCost: booking.totalCost,
        adultCount: booking.adultCount,
        childCount: booking.childCount,
        createdAt: booking.createdAt,
      }));

      res.status(200).json({
        room: accessCheck.hotel,
        month,
        days: Array.from(dayMap.values()),
        bookings: bookingRows,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Unable to fetch room calendar" });
    }
  }
);

// Update a single day availability status (closed or available)
router.post(
  "/calendar/:hotelId/day-status",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  [
    param("hotelId").notEmpty().withMessage("Hotel ID is required"),
    body("date").isISO8601().withMessage("Date is invalid"),
    body("status")
      .isIn(["closed", "available"])
      .withMessage("Status must be closed or available"),
    body("note").optional().isString().isLength({ max: 300 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const hotelId = req.params.hotelId;
      const accessCheck = await getAccessibleHotel(hotelId, req);
      if (accessCheck.error) {
        return res.status(accessCheck.error.status).json({ message: accessCheck.error.message });
      }

      const status = req.body.status as "closed" | "available";
      const date = toUtcStartOfDay(req.body.date);
      const note = typeof req.body.note === "string" ? req.body.note.trim() : "";

      if (status === "closed" && !note) {
        return res.status(400).json({ message: "A comment is required when closing a day." });
      }

      if (status === "closed") {
        await BookingDayStatus.findOneAndUpdate(
          { hotelId, date },
          {
            hotelId,
            date,
            status: "closed",
            note,
            createdBy: req.userId,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } else {
        await BookingDayStatus.deleteOne({ hotelId, date });
      }

      return res.status(200).json({ message: "Day status updated successfully" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Unable to update day status" });
    }
  }
);

// Confirm or reject requested bookings and notify user/admin
router.post(
  "/:id/decision",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  [
    param("id").notEmpty().withMessage("Booking ID is required"),
    body("action")
      .isIn(["confirm", "reject"])
      .withMessage("Action must be confirm or reject"),
    body("reason").optional().isString().isLength({ max: 400 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const booking = await Booking.findById(req.params.id);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const accessCheck = await getAccessibleHotel(booking.hotelId, req);
      if (accessCheck.error) {
        return res.status(accessCheck.error.status).json({ message: accessCheck.error.message });
      }

      if (booking.status !== "pending") {
        return res.status(409).json({
          message: "Only requested bookings can be confirmed or rejected.",
        });
      }

      const action = req.body.action as "confirm" | "reject";

      if (action === "confirm") {
        const overlappingConfirmedBooking = await Booking.findOne({
          _id: { $ne: booking._id },
          hotelId: booking.hotelId,
          status: { $in: ["confirmed", "arrived", "completed"] },
          checkIn: { $lt: booking.checkOut },
          checkOut: { $gt: booking.checkIn },
        }).select("_id reservationNumber status checkIn checkOut");

        if (overlappingConfirmedBooking) {
          return res.status(409).json({
            message:
              "This request cannot be confirmed because the room is already booked for overlapping dates.",
            bookingId: overlappingConfirmedBooking._id,
            reservationNumber: overlappingConfirmedBooking.reservationNumber,
            conflictStatus: overlappingConfirmedBooking.status,
          });
        }
      }

      const nextStatus = toDecisionStatus(action);
      booking.status = nextStatus;

      if (action === "reject") {
        booking.cancellationReason = req.body.reason || "Rejected by backoffice";
      }

      await booking.save();

      let notificationsSent = true;
      let warning: string | undefined;

      try {
        await sendBookingDecisionEmails({
          reservationNumber: booking.reservationNumber || "N/A",
          hotelName: accessCheck.hotel?.name || "Room",
          roomName: accessCheck.hotel?.name || "Room",
          firstName: booking.firstName,
          lastName: booking.lastName,
          email: booking.email,
          checkIn: booking.checkIn.toISOString(),
          checkOut: booking.checkOut.toISOString(),
          decision: action === "confirm" ? "confirmed" : "rejected",
          reason: req.body.reason,
        });
      } catch (emailError) {
        notificationsSent = false;
        warning = "Booking decision saved, but notifications could not be sent immediately.";
        console.log("Booking decision email delivery failed", emailError);
      }

      return res.status(200).json({
        message:
          action === "confirm"
            ? "Booking request confirmed"
            : "Booking request rejected",
        booking,
        notificationsSent,
        warning,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Unable to process booking decision" });
    }
  }
);

// Get all bookings (admin only)
router.get("/", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .populate("hotelId", "name city country");

    res.status(200).json(bookings);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Unable to fetch bookings" });
  }
});

// Get bookings by hotel ID (for hotel owners)
router.get(
  "/hotel/:hotelId",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  async (req: Request, res: Response) => {
    try {
      const { hotelId } = req.params;

      // Verify the hotel belongs to the authenticated user
      const hotel = await Hotel.findById(hotelId);
      if (!hotel) {
        return res.status(404).json({ message: "Hotel not found" });
      }

      if (req.userRole !== "admin" && hotel.userId !== req.userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const bookings = await Booking.find({ hotelId })
        .sort({ createdAt: -1 })
        .populate("userId", "firstName lastName email");

      res.status(200).json(bookings);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Unable to fetch hotel bookings" });
    }
  }
);

// Get booking by ID
router.get("/:id", verifyToken, requireRole("hotel_owner", "admin"), async (req: Request, res: Response) => {
  try {
    const booking = await Booking.findById(req.params.id).populate(
      "hotelId",
      "name city country imageUrls"
    );

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const hotel = await Hotel.findById(booking.hotelId);
    if (!hotel) {
      return res.status(404).json({ message: "Hotel not found" });
    }

    if (req.userRole !== "admin" && hotel.userId !== req.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.status(200).json(booking);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Unable to fetch booking" });
  }
});

// Update booking status
router.patch(
  "/:id/status",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  [
    body("status")
      .isIn(["pending", "confirmed", "arrived", "cancelled", "completed", "refunded"])
      .withMessage("Invalid status"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { status, cancellationReason } = req.body;

      const existingBooking = await Booking.findById(req.params.id);
      if (!existingBooking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const hotel = await Hotel.findById(existingBooking.hotelId);
      if (!hotel) {
        return res.status(404).json({ message: "Hotel not found" });
      }

      if (req.userRole !== "admin" && hotel.userId !== req.userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updateData: any = { status };
      if (status === "cancelled" && cancellationReason) {
        updateData.cancellationReason = cancellationReason;
      }
      if (status === "refunded") {
        updateData.refundAmount = req.body.refundAmount || 0;
      }

      const booking = await Booking.findByIdAndUpdate(req.params.id, updateData, {
        new: true,
      });

      res.status(200).json(booking);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Unable to update booking" });
    }
  }
);

// Update payment status
router.patch(
  "/:id/payment",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  [
    body("paymentStatus")
      .isIn(["pending", "paid", "failed", "refunded"])
      .withMessage("Invalid payment status"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { paymentStatus, paymentMethod } = req.body;

      const existingBooking = await Booking.findById(req.params.id);
      if (!existingBooking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const hotel = await Hotel.findById(existingBooking.hotelId);
      if (!hotel) {
        return res.status(404).json({ message: "Hotel not found" });
      }

      if (req.userRole !== "admin" && hotel.userId !== req.userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updateData: any = { paymentStatus };
      if (paymentMethod) {
        updateData.paymentMethod = paymentMethod;
      }

      const booking = await Booking.findByIdAndUpdate(req.params.id, updateData, {
        new: true,
      });

      res.status(200).json(booking);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Unable to update payment status" });
    }
  }
);

// Delete booking (admin only)
router.delete("/:id", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Update hotel analytics
    await Hotel.findByIdAndUpdate(booking.hotelId, {
      $inc: {
        totalBookings: -1,
        totalRevenue: -(booking.totalCost || 0),
      },
    });

    // Update user analytics
    await User.findByIdAndUpdate(booking.userId, {
      $inc: {
        totalBookings: -1,
        totalSpent: -(booking.totalCost || 0),
      },
    });

    res.status(200).json({ message: "Booking deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Unable to delete booking" });
  }
});

// Submit check-in information with guest documents
router.post(
  "/:id/check-in",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  upload.array("documents", 12),
  [
    param("id").notEmpty().withMessage("Booking ID is required"),
    body("arrivalTime").notEmpty().withMessage("Arrival time is required"),
    body("phone").trim().notEmpty().withMessage("Phone number is required"),
    body("email").trim().isEmail().withMessage("Valid email is required"),
    body("nationality").notEmpty().withMessage("Nationality is required"),
    body("bookingChannel").notEmpty().withMessage("Booking channel is required"),
    body("paymentDetails").notEmpty().withMessage("Payment details are required"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const booking = await Booking.findById(req.params.id);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const accessCheck = await getAccessibleHotel(booking.hotelId, req);
      if (accessCheck.error) {
        return res.status(accessCheck.error.status).json({ message: accessCheck.error.message });
      }

      if (!["confirmed", "arrived"].includes(booking.status)) {
        return res.status(409).json({
          message: "Only confirmed or arrived bookings can be updated via check-in.",
        });
      }

      const uploadedFiles = ((req as any).files as any[]) || [];
      let documentUrls: string[] = [];

      if (uploadedFiles.length > 0) {
        documentUrls = await uploadDocuments(uploadedFiles);
      }

      const cityTax = calculateCityTax({
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        adultCount: booking.adultCount,
        childCount: booking.childCount,
      });

      const existingDocumentsRaw = (req.body.existingDocuments || []) as string | string[];
      const existingDocuments = Array.isArray(existingDocumentsRaw)
        ? existingDocumentsRaw.filter(Boolean)
        : existingDocumentsRaw
          ? [existingDocumentsRaw]
          : [];
      const mergedDocuments = [...existingDocuments, ...documentUrls];

      // Store check-in information
      const checkInInfo = {
        arrivalTime: req.body.arrivalTime,
        phone: req.body.phone || booking.phone,
        email: req.body.email || booking.email,
        nationality: req.body.nationality,
        bookingChannel: req.body.bookingChannel,
        paymentDetails: req.body.paymentDetails,
        specialNotes: req.body.specialNotes || "",
        documents: mergedDocuments,
        cityTax,
        checkedInAt: new Date(),
      };

      // Update booking with check-in information
      booking.checkInInfo = checkInInfo;
      booking.status = "arrived";

      await booking.save();

      let notificationsSent = true;
      let warning: string | undefined;

      try {
        await sendCheckInNotificationEmail({
          reservationNumber: booking.reservationNumber || "N/A",
          hotelName: accessCheck.hotel?.name || "Room",
          roomName: accessCheck.hotel?.name || "Room",
          firstName: booking.firstName,
          lastName: booking.lastName,
          email: req.body.email || booking.email,
          phone: req.body.phone || booking.phone,
          checkIn: booking.checkIn.toISOString(),
          checkOut: booking.checkOut.toISOString(),
          arrivalTime: req.body.arrivalTime,
          nationality: req.body.nationality,
          bookingChannel: req.body.bookingChannel,
          paymentDetails: req.body.paymentDetails,
          cityTax,
          documentCount: mergedDocuments.length,
          specialNotes: req.body.specialNotes,
        });
      } catch (emailError) {
        notificationsSent = false;
        warning = "Check-in saved, but admin notification email could not be sent.";
        console.log("Check-in notification email failed", emailError);
      }

      return res.status(200).json({
        message: "Check-in submitted successfully",
        booking,
        notificationsSent,
        warning,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Unable to submit check-in" });
    }
  }
);

// Get booking dashboard summary with optional filters (year, month, hotelId)
router.get(
  "/dashboard/summary",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  [
    query("year")
      .optional()
      .isInt({ min: 2000, max: 2100 })
      .withMessage("Year must be between 2000 and 2100"),
    query("month")
      .optional()
      .isInt({ min: 1, max: 12 })
      .withMessage("Month must be between 1 and 12"),
    query("hotelId").optional().isString().withMessage("Hotel ID must be a string"),
    query("status")
      .optional()
      .isIn(["pending", "confirmed", "arrived", "completed", "cancelled", "refunded"])
      .withMessage("Invalid status filter"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
      const month = req.query.month ? Number(req.query.month) : null;
      const hotelId = req.query.hotelId ? String(req.query.hotelId) : null;
      const statusFilter = req.query.status ? String(req.query.status) : null;

      // Build hotel query based on user role
      let hotelQuery: any = req.userRole === "admin" ? {} : { userId: req.userId };

      // If hotelId is specified, verify access and filter
      if (hotelId) {
        const accessCheck = await getAccessibleHotel(hotelId, req);
        if (accessCheck.error) {
          return res.status(accessCheck.error.status).json({ message: accessCheck.error.message });
        }
        hotelQuery = { _id: hotelId };
      }

      // Get all accessible hotels
      const hotels = await Hotel.find(hotelQuery).select("_id name city country");

      // Build date range
      let dateStart, dateEnd;
      if (month) {
        dateStart = new Date(Date.UTC(year, month - 1, 1));
        dateEnd = new Date(Date.UTC(year, month, 1));
      } else {
        dateStart = new Date(Date.UTC(year, 0, 1));
        dateEnd = new Date(Date.UTC(year + 1, 0, 1));
      }

      // Get statistics for each hotel
      const hotelIds = hotels.map((h) => h._id.toString());
      const bookings = await Booking.find({
        hotelId: { $in: hotelIds },
        $or: [
          { checkIn: { $gte: dateStart, $lt: dateEnd } },
          {
            checkOut: { $gt: dateStart, $lte: dateEnd },
            checkIn: { $lt: dateEnd },
          },
        ],
      }).select(
        "hotelId status checkIn checkOut reservationNumber firstName lastName email phone nationality adultCount childCount createdAt"
      );

      // Calculate available nights for occupancy
      const totalDays = Math.ceil(
        (dateEnd.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      const availableNights = totalDays * hotelIds.length;

      // Calculate booked nights (excluding cancelled/refunded)
      const bookedNights = bookings
        .filter((b) => {
          const status = b.status || "pending";
          return status !== "cancelled" && status !== "refunded";
        })
        .reduce((sum, b) => {
          const checkIn = new Date(b.checkIn);
          const checkOut = new Date(b.checkOut);
          const nights = Math.ceil(
            (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
          );
          return sum + nights;
        }, 0);

      const occupancyPercentage =
        availableNights > 0 ? Math.round((bookedNights / availableNights) * 100) : 0;

      // Build results grouped by hotel
      const results = hotels.map((hotel) => {
        const hotelBookings = bookings.filter((b) =>
          b.hotelId.toString() === hotel._id.toString()
        );

        const statusCounts = {
          pending: 0,
          confirmed: 0,
          arrived: 0,
          completed: 0,
          cancelled: 0,
          refunded: 0,
        };

        hotelBookings.forEach((booking) => {
          const status = booking.status || "pending";
          if (status in statusCounts) {
            statusCounts[status as keyof typeof statusCounts]++;
          }
        });

        const totalBookings = hotelBookings.length;

        return {
          hotelId: hotel._id,
          hotelName: hotel.name,
          city: hotel.city,
          country: hotel.country,
          totalBookings,
          statusCounts,
        };
      });

      // Calculate totals
      const totals = {
        pending: results.reduce((sum, h) => sum + h.statusCounts.pending, 0),
        confirmed: results.reduce((sum, h) => sum + h.statusCounts.confirmed, 0),
        arrived: results.reduce((sum, h) => sum + h.statusCounts.arrived, 0),
        completed: results.reduce((sum, h) => sum + h.statusCounts.completed, 0),
        cancelled: results.reduce((sum, h) => sum + h.statusCounts.cancelled, 0),
        refunded: results.reduce((sum, h) => sum + h.statusCounts.refunded, 0),
        total: results.reduce((sum, h) => sum + h.totalBookings, 0),
      };

      // Get top nationalities
      const nationalityStats = bookings
        .filter((b) => b.nationality) // Only count bookings with nationality data
        .reduce(
          (acc, b) => {
            const nat = b.nationality || "Unknown";
            acc[nat] = (acc[nat] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

      const topNationalities = Object.entries(nationalityStats)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([nationality, count]) => ({ nationality, count }));

      // Filter bookings by status if requested
      let detailedBookings = bookings.map((b) => ({
        _id: b._id.toString(),
        hotelId: b.hotelId.toString(),
        reservationNumber: b.reservationNumber || "N/A",
        firstName: b.firstName,
        lastName: b.lastName,
        email: b.email,
        phone: b.phone,
        nationality: b.nationality || "Unknown",
        status: b.status || "pending",
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        guests: (b.adultCount || 0) + (b.childCount || 0),
        createdAt: b.createdAt,
      }));

      if (statusFilter) {
        detailedBookings = detailedBookings.filter((b) => b.status === statusFilter);
      }

      res.status(200).json({
        year,
        month,
        hotelId,
        dateRange: {
          start: dateStart.toISOString(),
          end: dateEnd.toISOString(),
        },
        hotels: results,
        totals,
        occupancy: {
          bookedNights,
          availableNights,
          percentage: occupancyPercentage,
        },
        topNationalities,
        bookings: detailedBookings.slice(0, 100), // Limit to 100 for API response
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Unable to fetch booking dashboard summary" });
    }
  }
);

export default router;
