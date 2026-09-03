import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/user";
import Hotel from "../models/hotel";
import ExternalCalendarEvent from "../models/external-calendar-event";
import Booking from "../models/booking";

const router = express.Router();

const isProduction = process.env.NODE_ENV === "production";

const normalizeCredential = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/^['\"]|['\"]$/g, "");
};

const getSessionCookieOptions = () => ({ httpOnly: true });

// Simple discovery
router.get("/", (req: Request, res: Response) => {
  const tools = ["health", "rooms.search", "bookings.verify", "availability.check", "bookings.upcomingCheckIns"];

  res.json({ service: "mcp", tools });
});

// Exchange client_id + client_secret + tenant -> Bearer JWT
router.post("/auth", async (req: Request, res: Response) => {
  const SOFIA_CLIENT_ID = process.env.SOFIA_CLIENT_ID;
  const SOFIA_CLIENT_SECRET = process.env.SOFIA_CLIENT_SECRET;
  const SOFIA_EMAIL = process.env.SOFIA_EMAIL || "sofia@palazzopintobnb.com";

  const expectedClientId = normalizeCredential(SOFIA_CLIENT_ID);
  const expectedClientSecret = normalizeCredential(SOFIA_CLIENT_SECRET);

  if (!expectedClientId || !expectedClientSecret) {
    return res.status(503).json({ message: "Service auth not configured" });
  }

  const { client_id, client_secret, tenant } = req.body || {};
  const incomingClientId = normalizeCredential(client_id);
  const incomingClientSecret = normalizeCredential(client_secret);

  if (!client_id || !client_secret) {
    return res.status(401).json({ message: "Missing credentials" });
  }

  try {
    const idOk =
      incomingClientId.length === expectedClientId.length &&
      crypto.timingSafeEqual(Buffer.from(incomingClientId), Buffer.from(expectedClientId));
    const secretOk =
      incomingClientSecret.length === expectedClientSecret.length &&
      crypto.timingSafeEqual(Buffer.from(incomingClientSecret), Buffer.from(expectedClientSecret));

    if (!idOk || !secretOk) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Ensure service user exists
    let user = await User.findOne({ email: SOFIA_EMAIL });
    if (!user) {
      user = new User({
        email: SOFIA_EMAIL,
        firstName: "Sofia",
        lastName: "Hermes",
        password: crypto.randomBytes(32).toString("hex"),
        emailVerified: true,
        role: "admin",
      });
      await user.save();
    }

    const token = jwt.sign(
      { userId: user.id, role: "admin", tenant: tenant || process.env.MS_ENTRA_TENANT_ID || "" },
      process.env.JWT_SECRET_KEY as string,
      { expiresIn: "12h" }
    );

    return res.status(200).json({ token, expiresIn: 43200 });
  } catch (err) {
    return res.status(500).json({ message: "Service auth failed" });
  }
});

// Middleware to verify MCP bearer token
const verifyMcpToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = String(req.headers.authorization || "");
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "unauthorized" });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY as string) as any;
    if (!decoded || decoded.role !== "admin") {
      return res.status(403).json({ message: "forbidden" });
    }

    // attach minimal info
    (req as any).mcp = { userId: decoded.userId, tenant: decoded.tenant };
    return next();
  } catch (err) {
    return res.status(401).json({ message: "unauthorized" });
  }
};

const escapeRegexLiteral = (value: string) => value.replace(/[.*+?^${}()|[\\]\\]/g, "\\\\$&");

const constructSearchQuery = (queryParams: any) => {
  const constructedQuery: any = {};

  if (queryParams.destination && String(queryParams.destination).trim() !== "") {
    const destination = escapeRegexLiteral(String(queryParams.destination).trim().slice(0, 100));
    constructedQuery.$or = [
      { city: { $regex: destination, $options: "i" } },
      { country: { $regex: destination, $options: "i" } },
    ];
  }

  if (queryParams.adultCount) {
    constructedQuery.adultCount = { $gte: parseInt(queryParams.adultCount) };
  }

  if (queryParams.childCount) {
    constructedQuery.childCount = { $gte: parseInt(queryParams.childCount) };
  }

  if (queryParams.facilities) {
    const parts = String(queryParams.facilities).split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      constructedQuery.facilities = { $all: parts };
    }
  }

  if (queryParams.maxPrice) {
    constructedQuery.pricePerNight = { $lte: Number(queryParams.maxPrice) };
  }

  if (queryParams.types) {
    const types = String(queryParams.types).split(",").map((s) => s.trim()).filter(Boolean);
    if (types.length > 0) {
      constructedQuery.type = { $in: types };
    }
  }

  if (queryParams.stars) {
    constructedQuery.starRating = Number(queryParams.stars);
  }

  return constructedQuery;
};

const PUBLIC_SEARCH_ROOM_FIELDS = [
  "_id",
  "userId",
  "slug",
  "originalUrl",
  "minimumNights",
  "name",
  "city",
  "country",
  "description",
  "type",
  "adultCount",
  "childCount",
  "facilities",
  "pricePerNight",
  "imageUrls",
  "lastUpdated",
  "location",
  "contact",
  "policies",
  "amenities",
  "isActive",
  "isFeatured",
  "createdAt",
  "updatedAt",
].join(" ");

// Execute a named tool (minimal safe set)
router.post("/execute", verifyMcpToken, async (req: Request, res: Response) => {
  const { tool, params } = req.body || {};

  if (!tool) {
    return res.status(400).json({ message: "tool is required" });
  }

  try {
    switch (tool) {
      case "health":
        return res.json({ status: "ok", version: process.env.npm_package_version || "unknown", uptime: process.uptime() });

      case "rooms.search": {
        const query = constructSearchQuery(params || {});
        const page = Math.max(1, Number(params?.page) || 1);
        const pageSize = Math.max(1, Math.min(50, Number(params?.pageSize) || 10));
        const skip = (page - 1) * pageSize;

        const matched = await Hotel.find(query).select(PUBLIC_SEARCH_ROOM_FIELDS).sort({ pricePerNight: 1 }).lean();
        const total = matched.length;
        const pages = Math.ceil(total / pageSize) || 1;
        const data = matched.slice(skip, skip + pageSize);

        return res.json({ data, pagination: { total, page, pages } });
      }

      case "availability.check": {
        // availability search
        const { checkIn, checkOut, adultCount, childCount } = params || {};
        const activeStatuses = ["pending", "confirmed", "arrived", "completed"];
        if (!checkIn || !checkOut) {
          return res.status(400).json({ message: "checkIn and checkOut are required for availability queries" });
        }

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime()) || checkInDate >= checkOutDate) {
          return res.status(400).json({ message: "invalid checkIn/checkOut dates" });
        }

        const adults = Number(adultCount) || 1;
        const children = Number(childCount) || 0;

        // Build hotel query (single-hotel assumption)
        const hotelQuery: any = { isActive: true };
        hotelQuery.adultCount = { $gte: adults };
        hotelQuery.childCount = { $gte: children };

        const candidates = await Hotel.find(hotelQuery).select(PUBLIC_SEARCH_ROOM_FIELDS).lean();

        const available: any[] = [];
        const unavailable: any[] = [];

        for (const h of candidates) {
          const overlap = await Booking.findOne({
            hotelId: h._id,
            status: { $in: activeStatuses },
            checkIn: { $lt: checkOutDate },
            checkOut: { $gt: checkInDate },
          }).select("_id reservationNumber status checkIn checkOut").lean();

          if (overlap) {
            unavailable.push({ hotel: h, conflict: overlap });
          } else {
            available.push(h);
          }
        }

        return res.json({
          available,
          unavailable,
          requested: { checkIn: checkInDate, checkOut: checkOutDate, adults, children },
          totalAvailable: available.length,
        });
      }

      case "bookings.upcomingCheckIns": {
        // Return upcoming (or past) check-ins merged between local bookings and imported events
        const days = Math.max(1, Number(params?.days) || 1);
        const horizon = params?.horizon === "past" ? "past" : "upcoming";
        const hotelId = params?.hotelId ? String(params.hotelId) : null;

        const toUtcStartOfDay = (value: string | Date) => {
          const date = new Date(value);
          return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        };

        const today = toUtcStartOfDay(new Date());
        const windowEnd = new Date(today.getTime() + days * 86400000);

        // Collect hotels to consider
        const hotelQuery: any = {};
        if (hotelId) hotelQuery._id = hotelId;
        const hotels = await Hotel.find(hotelQuery).select("_id name city country");
        const hotelIds = hotels.map((h) => String(h._id));
        const hotelMap = new Map(hotels.map((h) => [String(h._id), h]));

        // Local bookings
        const localFilter: any = { hotelId: { $in: hotelIds } };
        if (horizon === "past") {
          localFilter.status = { $nin: ["cancelled", "refunded"] };
          localFilter.checkIn = { $lt: today };
        } else {
          localFilter.status = { $in: ["pending", "confirmed", "arrived"] };
          localFilter.checkIn = { $gte: today, $lt: windowEnd };
        }

        const localUpcoming = await Booking.find(localFilter)
          // Avoid multi-field server-side sorts on Cosmos/Mongo API; sort by single field only
          .sort(horizon === "past" ? { checkIn: -1 } : { checkIn: 1 })
          .select("_id hotelId reservationNumber firstName lastName email phone nationality status checkIn checkOut arrivalTime checkInInfo");

        // Imported events (Booking.com) - active only
        const importedFilter: any = { hotelId: { $in: hotelIds }, status: "active" };
        if (horizon === "past") {
          importedFilter.startDate = { $lt: today };
        } else {
          importedFilter.startDate = { $gte: today, $lt: windowEnd };
        }

        const importedUpcoming = await ExternalCalendarEvent.find(importedFilter)
          // Avoid multi-field server-side sorts on Cosmos/Mongo API; sort by single field only
          .sort(horizon === "past" ? { startDate: -1 } : { startDate: 1 })
          .select("_id hotelId externalUid firstName lastName email phone nationality startDate endDate source summary checkInInfo totalCost adultCount childCount");

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
            isCheckedIn: Boolean(checkedInAt) || booking.status === "arrived" || (new Date(booking.checkIn)).getTime() < today.getTime(),
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
            source: event.source || "booking_com",
            sourceLabel: "Booking.com",
            checkIn: event.startDate,
            checkOut: event.endDate,
            arrivalTime,
            checkedInAt,
            isCheckedIn: Boolean(checkedInAt) || (new Date(event.startDate)).getTime() < today.getTime(),
            isImported: true,
            totalCost: Number(event.totalCost || 0),
            adultCount: Number(event.adultCount || 0),
            childCount: Number(event.childCount || 0),
          };
        };

        const rows = [...localUpcoming.map(toLocalRow), ...importedUpcoming.map(toImportedRow)];
        rows.sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime());

        return res.json({ rows, days, horizon });
      }

      case "bookings.verify": {
        // Booking lookup / verification only
        const { bookingRef, bookingId, checkAvailability, includePayments } = params || {};

        if (!bookingRef && !bookingId) {
          return res.status(400).json({ message: "bookingRef or bookingId is required" });
        }

        const query: any = {};
        if (bookingId) query._id = bookingId;
        if (bookingRef) query.reservationNumber = bookingRef;

        const booking = await Booking.findOne(query).lean();
        if (!booking) {
          return res.status(404).json({ verified: false, message: "booking not found" });
        }

        const verified = booking.status && booking.status !== "cancelled" && booking.status !== "refunded";

        const response: any = {
          verified,
          booking,
          paymentStatus: includePayments ? booking.checkInInfo?.paymentDetails || null : undefined,
          conflicts: [],
          notes: [],
        };

        if (checkAvailability) {
          const activeStatuses = ["pending", "confirmed", "arrived", "completed"];
          const overlapping = await Booking.findOne({
            hotelId: booking.hotelId,
            status: { $in: activeStatuses },
            checkIn: { $lt: booking.checkOut },
            checkOut: { $gt: booking.checkIn },
            _id: { $ne: booking._id },
          }).select("_id reservationNumber status checkIn checkOut").lean();

          if (overlapping) {
            response.conflicts.push({
              bookingId: overlapping._id,
              reservationNumber: overlapping.reservationNumber,
              status: overlapping.status,
              checkIn: overlapping.checkIn,
              checkOut: overlapping.checkOut,
            });
            response.verified = false;
          }
        }

        return res.json(response);
      }

      default:
        return res.status(404).json({ message: "unknown tool" });
    }
  } catch (err: any) {
    if (!isProduction) {
      return res.status(500).json({ message: "tool execution failed", error: err?.message || String(err), stack: err?.stack });
    }

    return res.status(500).json({ message: "tool execution failed" });
  }
});

export default router;
