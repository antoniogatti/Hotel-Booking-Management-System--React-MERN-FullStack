import express, { Request, Response } from "express";
import { body, param, validationResult } from "express-validator";
import crypto from "crypto";
import verifyToken from "../middleware/auth";
import requireRole from "../middleware/requireRole";
import Hotel from "../models/hotel";
import Booking from "../models/booking";
import BookingDayStatus from "../models/booking-day-status";
import {
  syncAllBookingComRooms,
  syncBookingComRoom,
} from "../lib/booking-com-ical";
import { recordAuditEvent } from "../lib/audit-log";
import { logError } from "../lib/logger";

const router = express.Router();

const escapeIcsText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

const formatUtcDateTime = (value: Date) =>
  `${value.getUTCFullYear()}${String(value.getUTCMonth() + 1).padStart(2, "0")}${String(
    value.getUTCDate()
  ).padStart(2, "0")}T${String(value.getUTCHours()).padStart(2, "0")}${String(
    value.getUTCMinutes()
  ).padStart(2, "0")}${String(value.getUTCSeconds()).padStart(2, "0")}Z`;

const formatDateOnly = (value: Date) =>
  `${value.getUTCFullYear()}${String(value.getUTCMonth() + 1).padStart(2, "0")}${String(
    value.getUTCDate()
  ).padStart(2, "0")}`;

const buildEvent = (lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");

const getBackendBaseUrl = (req: Request) => {
  const configuredBase = process.env.BACKEND_URL?.trim();
  if (configuredBase) {
    return configuredBase.replace(/\/$/, "");
  }

  return `${req.protocol}://${req.get("host")}`.replace(/\/$/, "");
};

const buildExportFeedUrl = (req: Request, hotelId: string, exportToken?: string) => {
  if (!exportToken) {
    return "";
  }

  return `${getBackendBaseUrl(req)}/api/integrations/booking-com/export/${hotelId}/${exportToken}.ics`;
};

router.get("/export/:hotelId/:token.ics", async (req: Request, res: Response) => {
  try {
    const hotel = await Hotel.findById(req.params.hotelId).select(
      "_id name city country bookingComIcal"
    );

    if (!hotel) {
      return res.status(404).send("Calendar not found");
    }

    if (!hotel.bookingComIcal?.exportEnabled || !hotel.bookingComIcal?.exportToken) {
      return res.status(404).send("Calendar not enabled");
    }

    if (req.params.token !== hotel.bookingComIcal.exportToken) {
      return res.status(404).send("Calendar not found");
    }

    const now = new Date();
    const bookings = await Booking.find({
      hotelId: hotel._id,
      status: { $in: ["pending", "confirmed", "arrived", "completed"] },
    })
      .sort({ checkIn: 1, createdAt: -1 })
      .select("_id reservationNumber firstName lastName checkIn checkOut updatedAt status");

    const closedDays = await BookingDayStatus.find({
      hotelId: hotel._id,
      status: "closed",
    })
      .sort({ date: 1 })
      .select("_id date note updatedAt");

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Palazzo Pinto//Booking Sync//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeIcsText(`${hotel.name} Availability`)}`,
      `X-WR-CALDESC:${escapeIcsText(
        `Local availability export for ${hotel.name}. Imported Booking.com events are excluded.`
      )}`,
    ];

    bookings.forEach((booking) => {
      const summary =
        booking.status === "pending"
          ? `${hotel.name} - Pending request`
          : `${hotel.name} - Reserved`;

      lines.push(
        buildEvent([
          `UID:local-booking-${booking._id}@palazzopinto`,
          `DTSTAMP:${formatUtcDateTime(now)}`,
          `DTSTART;VALUE=DATE:${formatDateOnly(new Date(booking.checkIn))}`,
          `DTEND;VALUE=DATE:${formatDateOnly(new Date(booking.checkOut))}`,
          `SUMMARY:${escapeIcsText(summary)}`,
          `DESCRIPTION:${escapeIcsText(
            `Reservation ${booking.reservationNumber || booking._id} exported from local PMS.`
          )}`,
          "STATUS:CONFIRMED",
          "TRANSP:OPAQUE",
          `LAST-MODIFIED:${formatUtcDateTime(new Date(booking.updatedAt || booking.checkIn))}`,
        ])
      );
    });

    closedDays.forEach((closedDay) => {
      const start = new Date(closedDay.date);
      const end = new Date(start.getTime() + 86400000);

      lines.push(
        buildEvent([
          `UID:local-closure-${closedDay._id}@palazzopinto`,
          `DTSTAMP:${formatUtcDateTime(now)}`,
          `DTSTART;VALUE=DATE:${formatDateOnly(start)}`,
          `DTEND;VALUE=DATE:${formatDateOnly(end)}`,
          "SUMMARY:CLOSED - Not available",
          `DESCRIPTION:${escapeIcsText(closedDay.note || "Manually closed in local PMS.")}`,
          "STATUS:CONFIRMED",
          "TRANSP:OPAQUE",
          `LAST-MODIFIED:${formatUtcDateTime(new Date(closedDay.updatedAt || closedDay.date))}`,
        ])
      );
    });

    lines.push("END:VCALENDAR");

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="${hotel._id}.ics"`);
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.status(200).send(lines.join("\r\n"));
  } catch (error) {
    logError("Unable to generate Booking.com export feed", error, {
      route: "booking-com-sync.export",
      hotelId: req.params.hotelId,
    });
    return res.status(500).send("Unable to generate calendar feed");
  }
});

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

router.put(
  "/rooms/:hotelId/config",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  [
    param("hotelId").notEmpty().withMessage("Hotel ID is required"),
    body("importUrl").optional({ nullable: true }).isString(),
    body("exportEnabled").optional().isBoolean().withMessage("exportEnabled must be a boolean"),
    body("syncEnabled").isBoolean().withMessage("syncEnabled must be a boolean"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const accessCheck = await getAccessibleHotel(req.params.hotelId, req);
      if (accessCheck.error) {
        return res.status(accessCheck.error.status).json({ message: accessCheck.error.message });
      }

      const importUrl = typeof req.body.importUrl === "string" ? req.body.importUrl.trim() : "";
      const exportEnabled = Boolean(req.body.exportEnabled);
      const existingExportToken = accessCheck.hotel?.bookingComIcal?.exportToken || "";
      const exportToken =
        exportEnabled && !existingExportToken
          ? crypto.randomBytes(24).toString("hex")
          : existingExportToken;

      const hotel = await Hotel.findByIdAndUpdate(
        req.params.hotelId,
        {
          $set: {
            "bookingComIcal.importUrl": importUrl,
            "bookingComIcal.syncEnabled": Boolean(req.body.syncEnabled),
            "bookingComIcal.exportEnabled": exportEnabled,
            "bookingComIcal.exportToken": exportToken,
            "bookingComIcal.lastSyncError": "",
          },
        },
        { new: true }
      ).select("_id name slug bookingComIcal");

      await recordAuditEvent({
        action: "integration.booking-com.config-updated",
        entityType: "integration",
        entityId: String(hotel?._id || req.params.hotelId),
        hotelId: String(req.params.hotelId),
        actorId: req.userId,
        actorRole: req.userRole,
        req,
        metadata: {
          syncEnabled: Boolean(req.body.syncEnabled),
          exportEnabled,
          hasImportUrl: Boolean(importUrl),
        },
      });

      return res.status(200).json({
        hotel,
        exportFeedUrl: buildExportFeedUrl(req, String(hotel?._id || req.params.hotelId), hotel?.bookingComIcal?.exportToken),
      });
    } catch (error) {
      logError("Unable to save Booking.com sync configuration", error, {
        route: "booking-com-sync.config",
        hotelId: req.params.hotelId,
      });
      return res.status(500).json({ message: "Unable to save Booking.com sync configuration" });
    }
  }
);

router.post(
  "/rooms/:hotelId/export-token/regenerate",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  [param("hotelId").notEmpty().withMessage("Hotel ID is required")],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const accessCheck = await getAccessibleHotel(req.params.hotelId, req);
      if (accessCheck.error) {
        return res.status(accessCheck.error.status).json({ message: accessCheck.error.message });
      }

      const exportToken = crypto.randomBytes(24).toString("hex");

      const hotel = await Hotel.findByIdAndUpdate(
        req.params.hotelId,
        {
          $set: {
            "bookingComIcal.exportEnabled": true,
            "bookingComIcal.exportToken": exportToken,
          },
        },
        { new: true }
      ).select("_id name slug bookingComIcal");

      await recordAuditEvent({
        action: "integration.booking-com.export-token-regenerated",
        entityType: "integration",
        entityId: String(hotel?._id || req.params.hotelId),
        hotelId: String(req.params.hotelId),
        actorId: req.userId,
        actorRole: req.userRole,
        req,
        metadata: {
          exportEnabled: true,
        },
      });

      return res.status(200).json({
        hotel,
        exportFeedUrl: buildExportFeedUrl(req, String(hotel?._id || req.params.hotelId), exportToken),
      });
    } catch (error) {
      logError("Unable to regenerate Booking.com export token", error, {
        route: "booking-com-sync.regenerate-export-token",
        hotelId: req.params.hotelId,
      });
      return res.status(500).json({ message: "Unable to regenerate Booking.com export token" });
    }
  }
);

router.post(
  "/sync",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  [body("hotelId").optional().isString().withMessage("Hotel ID must be a string")],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const hotelId = typeof req.body.hotelId === "string" ? req.body.hotelId : "";

      if (hotelId) {
        const accessCheck = await getAccessibleHotel(hotelId, req);
        if (accessCheck.error) {
          return res.status(accessCheck.error.status).json({ message: accessCheck.error.message });
        }

        const result = await syncBookingComRoom(accessCheck.hotel as any);
        return res.status(200).json({ results: [result] });
      }

      if (req.userRole !== "admin") {
        return res.status(400).json({ message: "hotelId is required for hotel owners" });
      }

      const results = await syncAllBookingComRooms();
      return res.status(200).json({ results });
    } catch (error: any) {
      logError("Booking.com sync request failed", error, {
        route: "booking-com-sync.sync",
        hotelId: typeof req.body.hotelId === "string" ? req.body.hotelId : undefined,
      });
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Unable to sync Booking.com calendars",
      });
    }
  }
);

export default router;