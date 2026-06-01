import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/user";
import Hotel from "../models/hotel";
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
  const tools = ["health", "rooms.search", "bookings.verify", "availability.check"];
  if (!isProduction) {
    tools.push("bookings.createTest");
  }

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
        const { checkIn, checkOut, adultCount, childCount, destination, hotelId } = params || {};
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

        // Build hotel query
        const hotelQuery: any = { isActive: true };
        if (hotelId) hotelQuery._id = hotelId;
        if (destination) {
          const dest = escapeRegexLiteral(String(destination).trim().slice(0, 100));
          hotelQuery.$or = [{ city: { $regex: dest, $options: "i" } }, { country: { $regex: dest, $options: "i" } }];
        }
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

      case "bookings.createTest": {
        // Development-only helper to insert a test booking into the DB
        if (isProduction) {
          return res.status(403).json({ message: "not allowed in production" });
        }

        const {
          hotelId,
          firstName = "Test",
          lastName = "Guest",
          email = "test@example.com",
          phone = "",
          adultCount = 1,
          childCount = 0,
          checkIn,
          checkOut,
          totalCost = 100,
          reservationNumber,
        } = params || {};

        if (!checkIn || !checkOut) {
          return res.status(400).json({ message: "checkIn and checkOut are required" });
        }

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime()) || checkInDate >= checkOutDate) {
          return res.status(400).json({ message: "invalid checkIn/checkOut dates" });
        }

        let targetHotel = null;
        if (hotelId) {
          targetHotel = await Hotel.findById(hotelId).select("_id").lean();
        } else {
          targetHotel = await Hotel.findOne({ isActive: true }).select("_id").lean();
        }

        if (!targetHotel) {
          // Create a minimal test hotel when none exist (development only)
          const newHotel = new Hotel({
            userId: "mcp-test",
            name: "Test Room",
            city: "Testville",
            country: "Testland",
            slug: "testroom",
            adultCount: Number(adultCount) || 1,
            childCount: Number(childCount) || 0,
            pricePerNight: Number(totalCost) || 100,
            isActive: true,
            description: "Test hotel generated for MCP local tests",
            lastUpdated: new Date(),
            starRating: 1,
          });

          await newHotel.save();
          targetHotel = { _id: newHotel._id } as any;
        }

        const booking = new Booking({
          reservationNumber: reservationNumber || `TEST-${Date.now()}`,
          userId: "mcp-test",
          hotelId: String(targetHotel._id),
          firstName: String(firstName),
          lastName: String(lastName),
          email: String(email),
          phone: String(phone),
          adultCount: Number(adultCount),
          childCount: Number(childCount),
          checkIn: checkInDate,
          checkOut: checkOutDate,
          totalCost: Number(totalCost),
          status: "pending",
        });

        await booking.save();

        return res.json({ bookingId: booking._id, reservationNumber: booking.reservationNumber });
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
