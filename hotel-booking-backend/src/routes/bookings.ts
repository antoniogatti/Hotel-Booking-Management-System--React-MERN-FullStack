import express, { Request, Response } from "express";
import multer from "multer";
import Booking from "../models/booking";
import Hotel from "../models/hotel";
import User from "../models/user";
import verifyToken from "../middleware/auth";
import requireRole from "../middleware/requireRole";
import BookingDayStatus from "../models/booking-day-status";
import ExternalCalendarEvent from "../models/external-calendar-event";
import {
  BOOKING_COM_SOURCE,
  BOOKING_COM_STATUS_LABEL,
  findOverlappingImportedEvent,
  getImportedCalendarEvents,
  isBookingComManagedRoom,
} from "../lib/booking-com-ical";
import {
  sendBookingDecisionEmails,
  sendCheckInNotificationEmail,
} from "../lib/contact-mail";
import { getValidMicrosoftGraphAccessToken } from "../lib/microsoft-graph-auth";
import { syncBookingFromExcel } from "../lib/excel-booking-sync";
import { syncBookingFromOneNote } from "../lib/onenote-booking-sync";
import { body, param, query, validationResult } from "express-validator";
import { recordAuditEvent } from "../lib/audit-log";
import { logError } from "../lib/logger";

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

const ROOM_DISPLAY_ORDER = ["malvasia", "verdeca", "aleatico", "fuocorosa"] as const;

const getManagedRoomOrderKey = (hotel: { slug?: string; name?: string }) => {
  const slug = String(hotel.slug || "").trim().toLowerCase();
  if (slug) {
    const slugIndex = ROOM_DISPLAY_ORDER.indexOf(slug as (typeof ROOM_DISPLAY_ORDER)[number]);
    if (slugIndex >= 0) {
      return slugIndex;
    }
  }

  const normalizedName = String(hotel.name || "").trim().toLowerCase();
  const nameIndex = ROOM_DISPLAY_ORDER.findIndex((roomSlug) => normalizedName.includes(roomSlug));
  return nameIndex >= 0 ? nameIndex : ROOM_DISPLAY_ORDER.length;
};

const sortManagedHotels = <THotel extends { slug?: string; name?: string }>(hotels: THotel[]) =>
  [...hotels].sort((left, right) => {
    const orderDifference = getManagedRoomOrderKey(left) - getManagedRoomOrderKey(right);
    if (orderDifference !== 0) {
      return orderDifference;
    }

    return String(left.name || "").localeCompare(String(right.name || ""), "en", {
      sensitivity: "base",
    });
  });

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
  const hotel = await Hotel.findById(hotelId).select(
    "_id userId name city country bookingComIcal slug"
  );

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
  if (status === "imported") return BOOKING_COM_STATUS_LABEL;
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

const hasBreakfastService = (hotelName?: string) => {
  const normalizedName = String(hotelName || "").toLowerCase();
  return normalizedName.includes("malvasia") || normalizedName.includes("verdeca");
};

const parseBreakfastInfo = (body: Request["body"], guestCount: number) => {
  const savouryCount = Math.max(0, Number(body.breakfastSavouryCount ?? 0) || 0);
  const sweetCount = Math.max(0, Number(body.breakfastSweetCount ?? 0) || 0);
  const totalCount = savouryCount + sweetCount;
  const time = String(body.breakfastTime || "").trim();

  if (totalCount > guestCount) {
    return {
      error: `Breakfast total cannot exceed ${guestCount} guest${guestCount === 1 ? "" : "s"}.`,
    };
  }

  if (totalCount > 0 && !time) {
    return {
      error: "Breakfast time is required when breakfast is requested.",
    };
  }

  return {
    value:
      totalCount > 0 || time
        ? {
            time,
            savouryCount,
            sweetCount,
          }
        : undefined,
  };
};

const getOverlappingNightCount = (params: {
  start: string | Date;
  end: string | Date;
  rangeStart: Date;
  rangeEnd: Date;
}) => {
  const stayStart = new Date(params.start);
  const stayEnd = new Date(params.end);
  const overlapStart = new Date(Math.max(stayStart.getTime(), params.rangeStart.getTime()));
  const overlapEnd = new Date(Math.min(stayEnd.getTime(), params.rangeEnd.getTime()));

  if (overlapEnd.getTime() <= overlapStart.getTime()) {
    return 0;
  }

  return Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / 86400000);
};

const toImportedEventResponse = (event: any, hotel?: any) => ({
  _id: String(event._id),
  reservationNumber: event.externalUid,
  isImported: true,
  hotelName: hotel?.name || "",
  firstName: event.firstName || "",
  lastName: event.lastName || "",
  email: event.email || "",
  phone: event.phone || "",
  city: event.city || hotel?.city || "",
  country: event.country || hotel?.country || "",
  adultCount: Number(event.adultCount || 0),
  childCount: Number(event.childCount || 0),
  nationality: event.nationality || "",
  checkIn: event.startDate,
  checkOut: event.endDate,
  totalCost: Number(event.totalCost || 0),
  specialRequests: event.specialRequests || "",
  checkInInfo: event.checkInInfo,
  excelSync: event.excelSync,
  oneNoteSync: event.oneNoteSync,
  status: "imported",
  source: BOOKING_COM_SOURCE,
  sourceLabel: "Booking.com",
  summary: event.summary,
  externalUid: event.externalUid,
  dtStamp: event.dtStamp,
  createdAt: event.createdAt,
  updatedAt: event.updatedAt,
});

const applyExcelSyncToRecord = (params: {
  record: any;
  matchedRow: {
    rowNumber: number;
    guestName: string;
    room: string;
    date: string;
    country: string;
    city: string;
    pax?: number;
    totalPrice?: number;
    unitPrice?: number;
    netPrice?: number;
    paymentVia: string;
    invoiceNumber: string;
    identifier: string;
    raw: Record<string, string | number | null>;
  };
  syncWorkbook: {
    itemId?: string;
    sheetName?: string;
  };
  guestName: {
    firstName: string;
    lastName: string;
  };
  existingCheckInInfo?: any;
  fallback: {
    phone?: string;
    email?: string;
    nationality?: string;
    arrivalTime?: string;
  };
}) => {
  const { record, matchedRow, syncWorkbook, guestName, existingCheckInInfo, fallback } = params;
  const previousTotalCost = Number(record.totalCost || 0);

  if (guestName.firstName) {
    record.firstName = guestName.firstName;
  }
  if (guestName.lastName) {
    record.lastName = guestName.lastName;
  }
  if (matchedRow.city) {
    record.city = matchedRow.city;
  }
  if (matchedRow.country) {
    record.country = matchedRow.country;
    record.nationality = matchedRow.country;
  }
  if (typeof matchedRow.pax === "number" && matchedRow.pax > 0) {
    record.adultCount = matchedRow.pax;
    record.childCount = 0;
  }
  if (typeof matchedRow.totalPrice === "number" && matchedRow.totalPrice > 0) {
    record.totalCost = matchedRow.totalPrice;
  }

  record.checkInInfo = {
    arrivalTime: existingCheckInInfo?.arrivalTime || fallback.arrivalTime || "",
    phone: existingCheckInInfo?.phone || fallback.phone || "",
    email: existingCheckInInfo?.email || fallback.email || "",
    nationality: existingCheckInInfo?.nationality || fallback.nationality || matchedRow.country || "",
    bookingChannel: existingCheckInInfo?.bookingChannel || "",
    paymentDetails: matchedRow.paymentVia || existingCheckInInfo?.paymentDetails || "",
    specialNotes: existingCheckInInfo?.specialNotes || "",
    breakfast: existingCheckInInfo?.breakfast,
    documents: existingCheckInInfo?.documents || [],
    cityTax: existingCheckInInfo?.cityTax || 0,
    checkedInAt: existingCheckInInfo?.checkedInAt,
  };

  record.excelSync = {
    lastSyncedAt: new Date(),
    sheetName: syncWorkbook.sheetName,
    workbookItemId: syncWorkbook.itemId,
    matchedRowNumber: matchedRow.rowNumber,
    matchedRoom: matchedRow.room,
    matchedDate: new Date(`${matchedRow.date}T00:00:00.000Z`),
    guestName: matchedRow.guestName,
    invoiceNumber: matchedRow.invoiceNumber,
    identifier: matchedRow.identifier,
    paymentVia: matchedRow.paymentVia,
    pax: matchedRow.pax,
    totalPrice: matchedRow.totalPrice,
    unitPrice: matchedRow.unitPrice,
    netPrice: matchedRow.netPrice,
    city: matchedRow.city,
    country: matchedRow.country,
    raw: matchedRow.raw,
  };

  const priceChanged =
    typeof matchedRow.totalPrice === "number" &&
    matchedRow.totalPrice > 0 &&
    previousTotalCost > 0 &&
    Number(previousTotalCost.toFixed(2)) !== Number(matchedRow.totalPrice.toFixed(2));

  return {
    priceChanged,
    previousTotalCost,
  };
};

const applyOneNoteSyncToRecord = (params: {
  record: any;
  matchedPage: {
    pageId: string;
    title?: string;
    sectionName?: string;
    parsed: {
      room?: string;
      guestName?: string;
      arrivalNote?: string;
      adults?: number;
      children?: number;
      nationality?: string;
      phone?: string;
      whatsapp?: string;
      nights?: number;
      checkOutNote?: string;
      bookingSource?: string;
      paymentNote?: string;
      amountDueEUR?: number;
      notes?: string;
      rawLines: string[];
    };
  };
  guestName: {
    firstName: string;
    lastName: string;
  };
  fallback: {
    phone?: string;
    email?: string;
    nationality?: string;
  };
}) => {
  const { record, matchedPage, guestName, fallback } = params;
  const parsed = matchedPage.parsed;

  if (guestName.firstName) {
    record.firstName = guestName.firstName;
  }
  if (guestName.lastName) {
    record.lastName = guestName.lastName;
  }
  if (parsed.phone) {
    record.phone = parsed.phone;
  }
  if (parsed.nationality) {
    record.nationality = parsed.nationality;
  }
  if (typeof parsed.adults === "number") {
    record.adultCount = parsed.adults;
  }
  if (typeof parsed.children === "number") {
    record.childCount = parsed.children;
  }

  record.checkInInfo = {
    ...(record.checkInInfo || {}),
    arrivalTime: parsed.arrivalNote || record.checkInInfo?.arrivalTime || "",
    phone: parsed.phone || record.checkInInfo?.phone || fallback.phone || "",
    email: record.checkInInfo?.email || fallback.email || "",
    nationality: parsed.nationality || record.checkInInfo?.nationality || fallback.nationality || "",
    bookingChannel: parsed.bookingSource || record.checkInInfo?.bookingChannel || "",
    paymentDetails: parsed.paymentNote || record.checkInInfo?.paymentDetails || "",
    specialNotes: record.checkInInfo?.specialNotes || "",
    breakfast: record.checkInInfo?.breakfast,
    documents: record.checkInInfo?.documents || [],
    cityTax: record.checkInInfo?.cityTax || 0,
    checkedInAt: record.checkInInfo?.checkedInAt,
  };

  record.oneNoteSync = {
    lastSyncedAt: new Date(),
    matchedPageId: matchedPage.pageId,
    matchedPageTitle: matchedPage.title,
    matchedSectionName: matchedPage.sectionName,
    room: parsed.room,
    guestName: parsed.guestName,
    arrivalNote: parsed.arrivalNote,
    nationality: parsed.nationality,
    phone: parsed.phone,
    whatsapp: parsed.whatsapp,
    nights: parsed.nights,
    checkOutNote: parsed.checkOutNote,
    bookingSource: parsed.bookingSource,
    paymentNote: parsed.paymentNote,
    amountDueEUR: parsed.amountDueEUR,
    notes: parsed.notes,
    rawLines: parsed.rawLines,
  };
};

// List rooms available for bookings management (admin: all, owner: own rooms)
router.get(
  "/rooms",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  async (req: Request, res: Response) => {
    try {
      const hotelQuery = req.userRole === "admin" ? {} : { userId: req.userId };

      const hotels = sortManagedHotels(
        await Hotel.find(hotelQuery).select("_id name city country userId bookingComIcal slug")
      );

      res.status(200).json(
        hotels.map((hotel) => ({
          _id: hotel._id,
          name: hotel.name,
          city: hotel.city,
          country: hotel.country,
          bookingComIcal: hotel.bookingComIcal,
        }))
      );
    } catch (error) {
      logError("Unable to fetch booking rooms", error, {
        route: "bookings.rooms",
        actorId: req.userId,
        actorRole: req.userRole,
      });
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

      const importedEvents = await getImportedCalendarEvents({
        hotelId,
        start,
        end,
      });

      const dayMap = new Map<
        string,
        {
          date: string;
          status: "Available" | "Requested" | "Booked" | "Imported" | "Closed";
          requestedCount: number;
          bookedCount: number;
          importedCount: number;
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
          importedCount: 0,
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

      importedEvents.forEach((event) => {
        const effectiveStart = event.startDate < start ? start : toUtcStartOfDay(event.startDate);
        const effectiveEnd = event.endDate > end ? end : toUtcStartOfDay(event.endDate);

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

          target.importedCount += 1;
          if (target.status === "Available") {
            target.status = "Imported";
          }
        }
      });

      const bookingRows = bookings.map((booking) => ({
        _id: booking._id,
        reservationNumber: booking.reservationNumber,
        isImported: false,
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
        source: "local",
      }));

      const importedRows = importedEvents.map((event) => ({
        _id: String(event._id),
        reservationNumber: event.externalUid,
        isImported: true,
        firstName: event.firstName || "",
        lastName: event.lastName || "",
        email: event.email || "",
        phone: event.phone || undefined,
        checkIn: event.startDate,
        checkOut: event.endDate,
        status: BOOKING_COM_STATUS_LABEL,
        totalCost: Number(event.totalCost || 0),
        adultCount: Number(event.adultCount || 0),
        childCount: Number(event.childCount || 0),
        createdAt: event.createdAt,
        source: BOOKING_COM_SOURCE,
        sourceLabel: "Booking.com",
        summary: event.summary,
        externalUid: event.externalUid,
        dtStamp: event.dtStamp,
        nationality: event.nationality || undefined,
        specialRequests: event.specialRequests || undefined,
        checkedInAt: event.checkInInfo?.checkedInAt,
      }));

      res.status(200).json({
        room: accessCheck.hotel,
        month,
        days: Array.from(dayMap.values()),
        bookings: [...bookingRows, ...importedRows].sort(
          (left, right) => new Date(left.checkIn).getTime() - new Date(right.checkIn).getTime()
        ),
      });
    } catch (error) {
      logError("Unable to fetch booking room calendar", error, {
        route: "bookings.calendar",
        hotelId: req.params.hotelId,
      });
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

      await recordAuditEvent({
        action: status === "closed" ? "booking.day-status.closed" : "booking.day-status.reopened",
        entityType: "booking_day_status",
        entityId: `${hotelId}:${date.toISOString().slice(0, 10)}`,
        hotelId,
        actorId: req.userId,
        actorRole: req.userRole,
        req,
        metadata: {
          date: date.toISOString(),
          note,
          status,
        },
      });

      return res.status(200).json({ message: "Day status updated successfully" });
    } catch (error) {
      logError("Unable to update booking day status", error, {
        route: "bookings.day-status",
        hotelId: req.params.hotelId,
      });
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

        const overlappingImportedEvent = await findOverlappingImportedEvent({
          hotelId: booking.hotelId,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
        });

        if (overlappingImportedEvent) {
          return res.status(409).json({
            message:
              "This request cannot be confirmed because Booking.com has already blocked overlapping dates for this room.",
            bookingId: overlappingImportedEvent._id,
            reservationNumber: overlappingImportedEvent.externalUid,
            conflictStatus: "imported",
          });
        }
      }

      const nextStatus = toDecisionStatus(action);
      booking.status = nextStatus;

      if (action === "reject") {
        booking.cancellationReason = req.body.reason || "Rejected by backoffice";
      }

      await booking.save();

      await recordAuditEvent({
        action: action === "confirm" ? "booking.confirmed" : "booking.rejected",
        entityType: "booking",
        entityId: String(booking._id),
        hotelId: String(booking.hotelId),
        actorId: req.userId,
        actorRole: req.userRole,
        req,
        metadata: {
          reservationNumber: booking.reservationNumber,
          reason: req.body.reason || undefined,
          status: booking.status,
        },
      });

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
        logError("Booking decision email delivery failed", emailError, {
          route: "bookings.decision",
          bookingId: String(booking._id),
        });
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
      logError("Unable to process booking decision", error, {
        route: "bookings.decision",
        bookingId: req.params.id,
      });
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
    logError("Unable to fetch bookings", error, {
      route: "bookings.list",
      actorId: req.userId,
      actorRole: req.userRole,
    });
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
      logError("Unable to fetch hotel bookings", error, {
        route: "bookings.hotel",
        hotelId: req.params.hotelId,
      });
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
      const importedEvent = await ExternalCalendarEvent.findById(req.params.id);
      if (!importedEvent) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const accessCheck = await getAccessibleHotel(importedEvent.hotelId, req);
      if (accessCheck.error) {
        return res.status(accessCheck.error.status).json({ message: accessCheck.error.message });
      }

      return res.status(200).json(toImportedEventResponse(importedEvent, accessCheck.hotel));
    }

    const hotel = await Hotel.findById(booking.hotelId);
    if (!hotel) {
      return res.status(404).json({ message: "Hotel not found" });
    }

    if (req.userRole !== "admin" && hotel.userId !== req.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const bookingObject = booking.toObject();
    res.status(200).json({
      ...bookingObject,
      hotelName: hotel.name,
    });
  } catch (error) {
    logError("Unable to fetch booking", error, {
      route: "bookings.detail",
      bookingId: req.params.id,
    });
    res.status(500).json({ message: "Unable to fetch booking" });
  }
});

router.post(
  "/:id/sync-excel",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  async (req: Request, res: Response) => {
    try {
      let booking = await Booking.findById(req.params.id);
      let importedEvent: any = null;

      if (!booking) {
        importedEvent = await ExternalCalendarEvent.findById(req.params.id);
      }

      if (!booking && !importedEvent) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const targetHotelId = String(booking ? booking.hotelId : importedEvent.hotelId);
      const accessCheck = await getAccessibleHotel(targetHotelId, req);
      if (accessCheck.error) {
        return res.status(accessCheck.error.status).json({ message: accessCheck.error.message });
      }

      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(401).json({ message: "unauthorized" });
      }

      let graphAccessToken: string | null = null;
      try {
        graphAccessToken = await getValidMicrosoftGraphAccessToken(user);
      } catch (tokenError) {
        logError("Unable to refresh Microsoft Graph token", tokenError, {
          route: "bookings.sync-excel",
          bookingId: req.params.id,
          actorId: req.userId,
        });
        return res.status(401).json({
          message: "Microsoft Graph access expired. Sign in with Microsoft again to continue Excel sync.",
        });
      }

      if (!graphAccessToken) {
        return res.status(409).json({
          message: "Microsoft Graph access is not connected for this account. Sign in with Microsoft again and grant Files.Read access.",
        });
      }

      const syncResult = await syncBookingFromExcel({
        accessToken: graphAccessToken,
        booking: booking
          ? booking
          : {
              firstName: importedEvent.firstName || "",
              lastName: importedEvent.lastName || "",
              checkIn: importedEvent.startDate,
            },
        hotel: {
          name: accessCheck.hotel?.name,
          slug: accessCheck.hotel?.slug,
        },
      });

      if (!syncResult.matched) {
        return res.status(409).json(syncResult);
      }

      const matchedRow = syncResult.row;
      const targetRecord = booking || importedEvent;
      const applyResult = applyExcelSyncToRecord({
        record: targetRecord,
        matchedRow,
        syncWorkbook: syncResult.workbook,
        guestName: syncResult.guestName,
        existingCheckInInfo: targetRecord.checkInInfo,
        fallback: {
          phone: targetRecord.phone,
          email: targetRecord.email,
          nationality: targetRecord.nationality,
          arrivalTime: booking?.arrivalTime,
        },
      });

      await targetRecord.save();

      await recordAuditEvent({
        action: "booking.excel-sync.completed",
        entityType: booking ? "booking" : "external_booking",
        entityId: String(targetRecord._id),
        hotelId: String(targetHotelId),
        actorId: req.userId,
        actorRole: req.userRole,
        req,
        metadata: {
          reservationNumber: booking?.reservationNumber || importedEvent?.externalUid,
          matchedRowNumber: matchedRow.rowNumber,
          matchedRoom: matchedRow.room,
          matchedDate: matchedRow.date,
          priceChanged: applyResult.priceChanged,
          previousTotalCost: applyResult.previousTotalCost,
          newTotalCost: matchedRow.totalPrice,
        },
      });

      return res.status(200).json({
        message: "Excel booking data synced successfully",
        booking: booking ? booking : toImportedEventResponse(importedEvent, accessCheck.hotel),
        matchedRow: {
          rowNumber: matchedRow.rowNumber,
          guestName: matchedRow.guestName,
          room: matchedRow.room,
          date: matchedRow.date,
          paymentVia: matchedRow.paymentVia,
          totalPrice: matchedRow.totalPrice,
        },
        warning: applyResult.priceChanged
          ? `Excel total price replaced the stored value (${applyResult.previousTotalCost} -> ${matchedRow.totalPrice}).`
          : undefined,
      });
    } catch (error) {
      logError("Unable to sync booking from Excel", error, {
        route: "bookings.sync-excel",
        bookingId: req.params.id,
        actorId: req.userId,
      });
      return res.status(500).json({ message: "Unable to sync booking from Excel" });
    }
  }
);

router.post(
  "/:id/sync-onenote",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  async (req: Request, res: Response) => {
    try {
      let booking = await Booking.findById(req.params.id);
      let importedEvent: any = null;

      if (!booking) {
        importedEvent = await ExternalCalendarEvent.findById(req.params.id);
      }

      if (!booking && !importedEvent) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const targetHotelId = String(booking ? booking.hotelId : importedEvent.hotelId);
      const accessCheck = await getAccessibleHotel(targetHotelId, req);
      if (accessCheck.error) {
        return res.status(accessCheck.error.status).json({ message: accessCheck.error.message });
      }

      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(401).json({ message: "unauthorized" });
      }

      let graphAccessToken: string | null = null;
      try {
        graphAccessToken = await getValidMicrosoftGraphAccessToken(user);
      } catch (tokenError) {
        logError("Unable to refresh Microsoft Graph token", tokenError, {
          route: "bookings.sync-onenote",
          bookingId: req.params.id,
          actorId: req.userId,
        });
        return res.status(401).json({
          message: "Microsoft Graph access expired. Sign in with Microsoft again to continue OneNote sync.",
        });
      }

      if (!graphAccessToken) {
        return res.status(409).json({
          message: "Microsoft Graph access is not connected for this account. Sign in with Microsoft again and grant Notes.Read access.",
        });
      }

      const targetRecord = booking || importedEvent;
      const syncResult = await syncBookingFromOneNote({
        accessToken: graphAccessToken,
        booking: {
          firstName: targetRecord.firstName || "",
          lastName: targetRecord.lastName || "",
          phone: targetRecord.phone || "",
          adultCount: targetRecord.adultCount,
          childCount: targetRecord.childCount,
          checkIn: booking ? booking.checkIn : importedEvent.startDate,
          checkOut: booking ? booking.checkOut : importedEvent.endDate,
        },
        hotel: {
          name: accessCheck.hotel?.name,
          slug: accessCheck.hotel?.slug,
        },
      });

      if (!syncResult.matched) {
        return res.status(409).json(syncResult);
      }

      applyOneNoteSyncToRecord({
        record: targetRecord,
        matchedPage: syncResult.page,
        guestName: syncResult.guestName,
        fallback: {
          phone: targetRecord.phone,
          email: targetRecord.email,
          nationality: targetRecord.nationality,
        },
      });

      await targetRecord.save();

      await recordAuditEvent({
        action: "booking.onenote-sync.completed",
        entityType: booking ? "booking" : "external_booking",
        entityId: String(targetRecord._id),
        hotelId: String(targetHotelId),
        actorId: req.userId,
        actorRole: req.userRole,
        req,
        metadata: {
          reservationNumber: booking?.reservationNumber || importedEvent?.externalUid,
          matchedPageId: syncResult.page.pageId,
          matchedPageTitle: syncResult.page.title,
          matchedSectionName: syncResult.page.sectionName,
          bookingSource: syncResult.page.parsed.bookingSource,
        },
      });

      return res.status(200).json({
        message: "OneNote booking data synced successfully",
        booking: booking ? booking : toImportedEventResponse(importedEvent, accessCheck.hotel),
        matchedPage: {
          pageId: syncResult.page.pageId,
          title: syncResult.page.title,
          sectionName: syncResult.page.sectionName,
        },
      });
    } catch (error) {
      logError("Unable to sync booking from OneNote", error, {
        route: "bookings.sync-onenote",
        bookingId: req.params.id,
        actorId: req.userId,
      });
      return res.status(500).json({ message: "Unable to sync booking from OneNote" });
    }
  }
);

router.put(
  "/:id",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  async (req: Request, res: Response) => {
    try {
      const firstName = String(req.body.firstName || "").trim();
      const lastName = String(req.body.lastName || "").trim();
      const email = String(req.body.email || "").trim();
      const phone = String(req.body.phone || "").trim();
      const nationality = String(req.body.nationality || "").trim();
      const specialRequests = String(req.body.specialRequests || "").trim();
      const adultCount = Math.max(0, Number(req.body.adultCount ?? 0));
      const childCount = Math.max(0, Number(req.body.childCount ?? 0));

      if (!firstName || !lastName) {
        return res.status(400).json({ message: "First name and last name are required." });
      }

      if (adultCount + childCount < 1) {
        return res.status(400).json({ message: "At least one guest is required." });
      }

      const booking = await Booking.findById(req.params.id);

      if (booking) {
        const accessCheck = await getAccessibleHotel(booking.hotelId, req);
        if (accessCheck.error) {
          return res.status(accessCheck.error.status).json({ message: accessCheck.error.message });
        }

        if (!email) {
          return res.status(400).json({ message: "Email is required for direct bookings." });
        }

        booking.firstName = firstName;
        booking.lastName = lastName;
        booking.email = email;
        booking.phone = phone;
        booking.nationality = nationality;
        booking.specialRequests = specialRequests;
        booking.adultCount = adultCount;
        booking.childCount = childCount;

        if (booking.checkInInfo) {
          booking.checkInInfo.phone = phone;
          booking.checkInInfo.email = email;
          booking.checkInInfo.nationality = nationality;
        }

        await booking.save();

        await recordAuditEvent({
          action: "booking.updated",
          entityType: "booking",
          entityId: String(booking._id),
          hotelId: String(booking.hotelId),
          actorId: req.userId,
          actorRole: req.userRole,
          req,
          metadata: {
            reservationNumber: booking.reservationNumber,
            fields: [
              "firstName",
              "lastName",
              "email",
              "phone",
              "nationality",
              "specialRequests",
              "adultCount",
              "childCount",
            ],
          },
        });

        return res.status(200).json(booking);
      }

      const importedEvent = await ExternalCalendarEvent.findById(req.params.id);
      if (!importedEvent) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const accessCheck = await getAccessibleHotel(importedEvent.hotelId, req);
      if (accessCheck.error) {
        return res.status(accessCheck.error.status).json({ message: accessCheck.error.message });
      }

      importedEvent.firstName = firstName;
      importedEvent.lastName = lastName;
      importedEvent.email = email;
      importedEvent.phone = phone;
      importedEvent.nationality = nationality;
      importedEvent.specialRequests = specialRequests;
      importedEvent.adultCount = adultCount;
      importedEvent.childCount = childCount;

      if (importedEvent.checkInInfo) {
        importedEvent.checkInInfo.phone = phone;
        importedEvent.checkInInfo.email = email;
        importedEvent.checkInInfo.nationality = nationality;
      }

      await importedEvent.save();

      await recordAuditEvent({
        action: "booking.updated",
        entityType: "external_booking",
        entityId: String(importedEvent._id),
        hotelId: String(importedEvent.hotelId),
        actorId: req.userId,
        actorRole: req.userRole,
        req,
        metadata: {
          reservationNumber: importedEvent.externalUid,
          source: "booking_com",
          fields: [
            "firstName",
            "lastName",
            "email",
            "phone",
            "nationality",
            "specialRequests",
            "adultCount",
            "childCount",
          ],
        },
      });

      return res.status(200).json(toImportedEventResponse(importedEvent, accessCheck.hotel));
    } catch (error) {
      logError("Unable to update booking details", error, {
        route: "bookings.update-details",
        bookingId: req.params.id,
        actorId: req.userId,
      });
      return res.status(500).json({ message: "Unable to update booking details" });
    }
  }
);

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
      logError("Unable to update booking", error, {
        route: "bookings.status",
        bookingId: req.params.id,
      });
      res.status(500).json({ message: "Unable to update booking" });
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

    await recordAuditEvent({
      action: "booking.deleted",
      entityType: "booking",
      entityId: String(booking._id),
      hotelId: String(booking.hotelId),
      actorId: req.userId,
      actorRole: req.userRole,
      req,
      metadata: {
        reservationNumber: booking.reservationNumber,
        status: booking.status,
        totalCost: booking.totalCost,
      },
    });

    res.status(200).json({ message: "Booking deleted successfully" });
  } catch (error) {
    logError("Unable to delete booking", error, {
      route: "bookings.delete",
      bookingId: req.params.id,
    });
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
    body("email")
      .optional({ values: "falsy" })
      .trim()
      .isEmail()
      .withMessage("Email must be valid when provided"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const booking = await Booking.findById(req.params.id);
      if (!booking) {
        const importedEvent = await ExternalCalendarEvent.findById(req.params.id);
        if (!importedEvent) {
          return res.status(404).json({ message: "Booking not found" });
        }

        const accessCheck = await getAccessibleHotel(importedEvent.hotelId, req);
        if (accessCheck.error) {
          return res.status(accessCheck.error.status).json({ message: accessCheck.error.message });
        }

        const firstName = String(req.body.firstName || importedEvent.firstName || "").trim();
        const lastName = String(req.body.lastName || importedEvent.lastName || "").trim();
        const email = String(req.body.email || importedEvent.email || "").trim();
        const phone = String(req.body.phone || importedEvent.phone || "").trim();
        const nationality = String(req.body.nationality || importedEvent.nationality || "").trim();
        const bookingChannel = String(req.body.bookingChannel || "Booking.com").trim();
        const paymentDetails = String(req.body.paymentDetails || "").trim();
        const adultCount = Math.max(0, Number(req.body.adultCount ?? importedEvent.adultCount ?? 0));
        const childCount = Math.max(0, Number(req.body.childCount ?? importedEvent.childCount ?? 0));
        const totalCost = Math.max(0, Number(req.body.totalCost ?? importedEvent.totalCost ?? 0));
        const specialRequests = String(req.body.specialRequests || importedEvent.specialRequests || "").trim();
        const guestCount = adultCount + childCount;
        const breakfastInfo = hasBreakfastService(accessCheck.hotel?.name)
          ? parseBreakfastInfo(req.body, guestCount)
          : { value: undefined as undefined };

        if (!firstName || !lastName) {
          return res.status(400).json({ message: "Guest first name and last name are required for imported bookings." });
        }

        if (guestCount < 1) {
          return res.status(400).json({ message: "At least one guest is required for imported bookings." });
        }

        if (breakfastInfo.error) {
          return res.status(400).json({ message: breakfastInfo.error });
        }

        const uploadedFiles = ((req as any).files as any[]) || [];
        let documentUrls: string[] = [];

        if (uploadedFiles.length > 0) {
          documentUrls = await uploadDocuments(uploadedFiles);
        }

        const existingDocumentsRaw = (req.body.existingDocuments || []) as string | string[];
        const existingDocuments = Array.isArray(existingDocumentsRaw)
          ? existingDocumentsRaw.filter(Boolean)
          : existingDocumentsRaw
            ? [existingDocumentsRaw]
            : [];
        const mergedDocuments = [...existingDocuments, ...documentUrls];

        const cityTax = calculateCityTax({
          checkIn: importedEvent.startDate,
          checkOut: importedEvent.endDate,
          adultCount,
          childCount,
        });

        importedEvent.firstName = firstName;
        importedEvent.lastName = lastName;
        importedEvent.email = email;
        importedEvent.phone = phone;
        importedEvent.adultCount = adultCount;
        importedEvent.childCount = childCount;
        importedEvent.totalCost = totalCost;
        importedEvent.nationality = nationality;
        importedEvent.specialRequests = specialRequests;
        importedEvent.checkInInfo = {
          arrivalTime: req.body.arrivalTime,
          phone,
          email,
          nationality,
          bookingChannel,
          paymentDetails,
          specialNotes: req.body.specialNotes || "",
          breakfast: breakfastInfo.value,
          documents: mergedDocuments,
          cityTax,
          checkedInAt: new Date(),
        };

        await importedEvent.save();

        await recordAuditEvent({
          action: "booking.check-in.submitted",
          entityType: "external_booking",
          entityId: String(importedEvent._id),
          hotelId: String(importedEvent.hotelId),
          actorId: req.userId,
          actorRole: req.userRole,
          req,
          metadata: {
            reservationNumber: importedEvent.externalUid,
            source: "booking_com",
            documentCount: mergedDocuments.length,
            checkedInAt: importedEvent.checkInInfo?.checkedInAt,
          },
        });

        return res.status(200).json({
          message: "Imported booking details and check-in submitted successfully",
          booking: toImportedEventResponse(importedEvent, accessCheck.hotel),
          notificationsSent: true,
        });
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
      const guestCount = Math.max(0, booking.adultCount + booking.childCount);
      const breakfastInfo = hasBreakfastService(accessCheck.hotel?.name)
        ? parseBreakfastInfo(req.body, guestCount)
        : { value: undefined as undefined };

      if (breakfastInfo.error) {
        return res.status(400).json({ message: breakfastInfo.error });
      }

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
        breakfast: breakfastInfo.value,
        documents: mergedDocuments,
        cityTax,
        checkedInAt: new Date(),
      };

      // Update booking with check-in information
      booking.checkInInfo = checkInInfo;
      booking.status = "arrived";

      await booking.save();

      await recordAuditEvent({
        action: "booking.check-in.submitted",
        entityType: "booking",
        entityId: String(booking._id),
        hotelId: String(booking.hotelId),
        actorId: req.userId,
        actorRole: req.userRole,
        req,
        metadata: {
          reservationNumber: booking.reservationNumber,
          documentCount: mergedDocuments.length,
          checkedInAt: booking.checkInInfo?.checkedInAt,
          status: booking.status,
        },
      });

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
          breakfast: breakfastInfo.value,
        });
      } catch (emailError) {
        notificationsSent = false;
        warning = "Check-in saved, but admin notification email could not be sent.";
        logError("Check-in notification email failed", emailError, {
          route: "bookings.check-in",
          bookingId: String(booking._id),
        });
      }

      return res.status(200).json({
        message: "Check-in submitted successfully",
        booking,
        notificationsSent,
        warning,
      });
    } catch (error) {
      logError("Unable to submit check-in", error, {
        route: "bookings.check-in",
        bookingId: req.params.id,
      });
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
      .isIn(["pending", "confirmed", "arrived", "completed", "cancelled", "refunded", "imported"])
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
      const hotelNameById = new Map(
        hotels.map((hotel) => [String(hotel._id), hotel.name])
      );

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
      const importedEvents = await ExternalCalendarEvent.find({
        hotelId: { $in: hotelIds },
        status: "active",
        $or: [
          { startDate: { $gte: dateStart, $lt: dateEnd } },
          {
            endDate: { $gt: dateStart, $lte: dateEnd },
            startDate: { $lt: dateEnd },
          },
        ],
      }).select(
        "hotelId externalUid firstName lastName email phone nationality startDate endDate adultCount childCount createdAt"
      );

      const dashboardBookings = [
        ...bookings.map((booking) => ({
          _id: String(booking._id),
          hotelId: String(booking.hotelId),
          hotelName: hotelNameById.get(String(booking.hotelId)) || "Unknown room",
          reservationNumber: booking.reservationNumber || "N/A",
          firstName: booking.firstName,
          lastName: booking.lastName,
          email: booking.email,
          phone: booking.phone,
          nationality: booking.nationality || "Unknown",
          status: booking.status || "pending",
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          guests: (booking.adultCount || 0) + (booking.childCount || 0),
          createdAt: booking.createdAt,
        })),
        ...importedEvents.map((event) => ({
          _id: String(event._id),
          hotelId: String(event.hotelId),
          hotelName: hotelNameById.get(String(event.hotelId)) || "Unknown room",
          reservationNumber: event.externalUid || "N/A",
          firstName: event.firstName || "",
          lastName: event.lastName || "",
          email: event.email || "",
          phone: event.phone || "",
          nationality: event.nationality || "Unknown",
          status: "imported",
          checkIn: event.startDate,
          checkOut: event.endDate,
          guests: (event.adultCount || 0) + (event.childCount || 0),
          createdAt: event.createdAt,
        })),
      ];

      // Calculate available nights for occupancy
      const totalDays = Math.ceil(
        (dateEnd.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      const grossNights = totalDays * hotelIds.length;

      const closedNightEntries = await BookingDayStatus.find({
        hotelId: { $in: hotelIds },
        status: "closed",
        date: { $gte: dateStart, $lt: dateEnd },
      }).select("hotelId date");
      const closedNights = closedNightEntries.length;
      const sellableNights = Math.max(grossNights - closedNights, 0);

      // Calculate booked nights (excluding cancelled/refunded)
      const bookedNights = dashboardBookings
        .filter((b) => {
          const status = b.status || "pending";
          return status !== "cancelled" && status !== "refunded";
        })
        .reduce((sum, b) => {
          const nights = getOverlappingNightCount({
            start: b.checkIn,
            end: b.checkOut,
            rangeStart: dateStart,
            rangeEnd: dateEnd,
          });
          return sum + nights;
        }, 0);

      const remainingNights = Math.max(sellableNights - bookedNights, 0);
      const occupancyPercentage =
        sellableNights > 0
          ? Math.min(Math.round((bookedNights / sellableNights) * 100), 100)
          : 0;
      const vacancyPercentage =
        sellableNights > 0
          ? Math.min(Math.round((remainingNights / sellableNights) * 100), 100)
          : 0;

      // Build results grouped by hotel
      const results = hotels.map((hotel) => {
        const hotelBookings = dashboardBookings.filter((b) =>
          b.hotelId.toString() === hotel._id.toString()
        );
        const hotelClosedNights = closedNightEntries.filter(
          (entry) => String(entry.hotelId) === hotel._id.toString()
        ).length;
        const hotelGrossNights = totalDays;
        const hotelSellableNights = Math.max(hotelGrossNights - hotelClosedNights, 0);
        const hotelBookedNights = hotelBookings
          .filter((booking) => {
            const status = booking.status || "pending";
            return status !== "cancelled" && status !== "refunded";
          })
          .reduce((sum, booking) => {
            const nights = getOverlappingNightCount({
              start: booking.checkIn,
              end: booking.checkOut,
              rangeStart: dateStart,
              rangeEnd: dateEnd,
            });
            return sum + nights;
          }, 0);
        const hotelRemainingNights = Math.max(hotelSellableNights - hotelBookedNights, 0);
        const hotelOccupancyPercentage =
          hotelSellableNights > 0
            ? Math.min(Math.round((hotelBookedNights / hotelSellableNights) * 100), 100)
            : 0;

        const statusCounts = {
          pending: 0,
          confirmed: 0,
          arrived: 0,
          completed: 0,
          cancelled: 0,
          refunded: 0,
          imported: 0,
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
          occupancy: {
            grossNights: hotelGrossNights,
            closedNights: hotelClosedNights,
            sellableNights: hotelSellableNights,
            bookedNights: hotelBookedNights,
            remainingNights: hotelRemainingNights,
            percentage: hotelOccupancyPercentage,
          },
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
        imported: results.reduce((sum, h) => sum + h.statusCounts.imported, 0),
        total: results.reduce((sum, h) => sum + h.totalBookings, 0),
      };

      // Get top nationalities
      const nationalityStats = dashboardBookings
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
      let detailedBookings = dashboardBookings;

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
          grossNights,
          closedNights,
          sellableNights,
          bookedNights,
          availableNights: remainingNights,
          remainingNights,
          percentage: occupancyPercentage,
          vacancyPercentage,
        },
        topNationalities,
        bookings: detailedBookings.slice(0, 100), // Limit to 100 for API response
      });
    } catch (error) {
      logError("Unable to fetch booking dashboard summary", error, {
        route: "bookings.dashboard-summary",
        hotelId: req.query.hotelId,
      });
      res.status(500).json({ message: "Unable to fetch booking dashboard summary" });
    }
  }
);

router.get(
  "/dashboard/upcoming-check-ins",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  [
    query("days")
      .optional()
      .isInt({ min: 1, max: 180 })
      .withMessage("Days must be between 1 and 180"),
    query("horizon")
      .optional()
      .isIn(["upcoming", "past"])
      .withMessage("Horizon must be either upcoming or past"),
    query("hotelId").optional().isString().withMessage("Hotel ID must be a string"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const days = req.query.days ? Number(req.query.days) : 7;
      const horizon = req.query.horizon === "past" ? "past" : "upcoming";
      const hotelId = req.query.hotelId ? String(req.query.hotelId) : "";
      let hotelQuery: Record<string, unknown> = req.userRole === "admin" ? {} : { userId: req.userId };

      if (hotelId) {
        const accessCheck = await getAccessibleHotel(hotelId, req);
        if (accessCheck.error) {
          return res.status(accessCheck.error.status).json({ message: accessCheck.error.message });
        }

        hotelQuery = { _id: hotelId };
      }

      const hotels = sortManagedHotels(
        await Hotel.find(hotelQuery).select("_id name city country bookingComIcal slug")
      );

      const hotelIds = hotels.map((hotel) => String(hotel._id));
      const hotelMap = new Map(
        hotels.map((hotel) => [String(hotel._id), hotel])
      );

      const today = toUtcStartOfDay(new Date());
      const tomorrow = new Date(today.getTime() + 86400000);
      const windowEnd = new Date(today.getTime() + days * 86400000);
      const isPastStayStart = (value: string | Date) => toUtcStartOfDay(value).getTime() < today.getTime();

      const [
        localUpcoming,
        importedUpcoming,
        localInHouse,
        importedInHouse,
        localCheckedInTodayCount,
        importedCheckedInTodayCount,
      ] =
        await Promise.all([
          Booking.find({
            hotelId: { $in: hotelIds },
            ...(horizon === "past"
              ? {
                  status: { $nin: ["cancelled", "refunded"] },
                  checkIn: { $lt: today },
                }
              : {
                  status: { $in: ["pending", "confirmed", "arrived"] },
                  checkIn: { $gte: today, $lt: windowEnd },
                }),
          })
            .sort(horizon === "past" ? { checkIn: -1, createdAt: -1 } : { checkIn: 1, createdAt: 1 })
            .select(
              "_id hotelId reservationNumber firstName lastName email phone nationality status checkIn checkOut arrivalTime checkInInfo"
            ),
          ExternalCalendarEvent.find({
            hotelId: { $in: hotelIds },
            source: BOOKING_COM_SOURCE,
            status: "active",
            ...(horizon === "past"
              ? { startDate: { $lt: today } }
              : { startDate: { $gte: today, $lt: windowEnd } }),
          })
            .sort(horizon === "past" ? { startDate: -1, createdAt: -1 } : { startDate: 1, createdAt: 1 })
            .select(
              "_id hotelId externalUid firstName lastName email phone nationality startDate endDate source summary checkInInfo"
            ),
          Booking.find({
            hotelId: { $in: hotelIds },
            checkIn: { $lte: today },
            checkOut: { $gt: today },
            $or: [
              { "checkInInfo.checkedInAt": { $exists: true } },
              { status: { $in: ["arrived", "completed"] } },
              { checkIn: { $lt: today } },
            ],
          })
            .sort({ checkIn: 1, createdAt: 1 })
            .select(
              "_id hotelId reservationNumber firstName lastName email phone nationality status checkIn checkOut arrivalTime checkInInfo"
            ),
          ExternalCalendarEvent.find({
            hotelId: { $in: hotelIds },
            source: BOOKING_COM_SOURCE,
            status: "active",
            startDate: { $lte: today },
            endDate: { $gt: today },
            $or: [
              { "checkInInfo.checkedInAt": { $exists: true } },
              { startDate: { $lt: today } },
            ],
          })
            .sort({ startDate: 1, createdAt: 1 })
            .select(
              "_id hotelId externalUid firstName lastName email phone nationality startDate endDate source summary checkInInfo"
            ),
          Booking.countDocuments({
            hotelId: { $in: hotelIds },
            "checkInInfo.checkedInAt": { $gte: today, $lt: tomorrow },
          }),
          ExternalCalendarEvent.countDocuments({
            hotelId: { $in: hotelIds },
            source: BOOKING_COM_SOURCE,
            status: "active",
            "checkInInfo.checkedInAt": { $gte: today, $lt: tomorrow },
          }),
        ]);

      const toLocalRow = (booking: any) => {
          const hotel = hotelMap.get(String(booking.hotelId));
          const arrivalTime = booking.checkInInfo?.arrivalTime || booking.arrivalTime || "";
          const checkedInAt = booking.checkInInfo?.checkedInAt;
          return {
            _id: String(booking._id),
            hotelId: String(booking.hotelId),
            hotelName: hotel?.name || "Room",
            hotelCity: hotel?.city || "",
            hotelCountry: hotel?.country || "",
            reservationNumber: booking.reservationNumber || "N/A",
            firstName: booking.firstName,
            lastName: booking.lastName,
            email: booking.email || "",
            phone: booking.phone || "",
            nationality: booking.nationality || "",
            status: booking.status || "pending",
            source: "local",
            sourceLabel: "Direct",
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            arrivalTime,
            checkedInAt,
            isCheckedIn:
              Boolean(checkedInAt) ||
              booking.status === "arrived" ||
              booking.status === "completed" ||
              isPastStayStart(booking.checkIn),
            isImported: false,
          };
        };

      const toImportedRow = (event: any) => {
          const hotel = hotelMap.get(String(event.hotelId));
          const arrivalTime = event.checkInInfo?.arrivalTime || "";
          const checkedInAt = event.checkInInfo?.checkedInAt;
          return {
            _id: String(event._id),
            hotelId: String(event.hotelId),
            hotelName: hotel?.name || "Room",
            hotelCity: hotel?.city || "",
            hotelCountry: hotel?.country || "",
            reservationNumber: event.externalUid || "Booking.com",
            firstName: event.firstName || "",
            lastName: event.lastName || "",
            email: event.email || "",
            phone: event.phone || "",
            nationality: event.nationality || "",
            status: "imported",
            source: BOOKING_COM_SOURCE,
            sourceLabel: "Booking.com",
            checkIn: event.startDate,
            checkOut: event.endDate,
            arrivalTime,
            checkedInAt,
            isCheckedIn: Boolean(checkedInAt) || isPastStayStart(event.startDate),
            isImported: true,
          };
        };

      const upcomingRows = [...localUpcoming.map(toLocalRow), ...importedUpcoming.map(toImportedRow)];
      const inHouseRows = [...localInHouse.map(toLocalRow), ...importedInHouse.map(toImportedRow)];

      const rowMap = new Map<string, (typeof upcomingRows)[number]>();
      [...upcomingRows, ...inHouseRows].forEach((row) => {
        rowMap.set(row._id, row);
      });

      const rows = [...rowMap.values()].sort(
        (left, right) =>
          horizon === "past"
            ? new Date(right.checkIn).getTime() - new Date(left.checkIn).getTime()
            : new Date(left.checkIn).getTime() - new Date(right.checkIn).getTime()
      );

      const arrivalsToday = upcomingRows.filter((row) => {
        const checkIn = toUtcStartOfDay(row.checkIn);
        return checkIn.getTime() === today.getTime();
      }).length;

      const roomsWithSync = hotels.filter((hotel) => Boolean(hotel.bookingComIcal?.syncEnabled));
      const lastSuccessfulSync = roomsWithSync
        .filter((hotel) => hotel.bookingComIcal?.lastSyncAt)
        .map((hotel) => new Date(hotel.bookingComIcal?.lastSyncAt as Date))
        .sort((left, right) => right.getTime() - left.getTime())[0];

      const syncIssues = roomsWithSync.filter(
        (hotel) => hotel.bookingComIcal?.lastSyncStatus && hotel.bookingComIcal.lastSyncStatus !== "success"
      ).length;

      return res.status(200).json({
        range: {
          start: (horizon === "past" ? new Date(0) : today).toISOString(),
          end: (horizon === "past" ? today : windowEnd).toISOString(),
          days,
        },
        summary: {
          arrivalsToday,
          upcomingArrivals: upcomingRows.length,
          inHouseToday: inHouseRows.length,
          checkedInToday: localCheckedInTodayCount + importedCheckedInTodayCount,
          sync: {
            totalRooms: hotels.length,
            enabledRooms: roomsWithSync.length,
            issueRooms: syncIssues,
            lastSuccessfulSyncAt: lastSuccessfulSync ? lastSuccessfulSync.toISOString() : null,
          },
        },
        rows,
      });
    } catch (error) {
      logError("Unable to fetch upcoming check-ins", error, {
        route: "bookings.upcoming-check-ins",
        hotelId: req.query.hotelId,
      });
      return res.status(500).json({ message: "Unable to fetch upcoming check-ins" });
    }
  }
);

export default router;
