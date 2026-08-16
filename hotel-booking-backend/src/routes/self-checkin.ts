import express, { Request, Response } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { Types } from "mongoose";
import SelfCheckin from "../models/selfCheckin";
import verifyToken from "../middleware/auth";
import requireRole from "../middleware/requireRole";
import { sendSelfCheckinNotificationEmail } from "../lib/contact-mail";
import { logError } from "../lib/logger";
import { trackTelemetryEvent, trackTelemetryException } from "../lib/telemetry";
import {
  deleteSelfCheckinFileFromGridFS,
  getSelfCheckinFileStream,
  saveSelfCheckinFileToGridFS,
} from "../lib/self-checkin-gridfs";

const router = express.Router();

// stricter limiter for public self-checkin submissions
const selfCheckinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.SELF_CHECKIN_RATE_LIMIT || 20),
  message: "Too many self check-in attempts from this IP, please try later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const detectMimeType = (buffer: Buffer) => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }

  return null;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 20,
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error("Only JPG, PNG, WEBP and PDF files are allowed."));
      return;
    }
    cb(null, true);
  },
});

type NormalizedGuest = {
  givenName: string;
  familyName: string;
  documentType: "id_card" | "passport";
  documentNumber: string;
  breakfastChoice?: "Savoury" | "Sweet";
  documents: Array<{
    gridFsId: Types.ObjectId;
    filename: string;
    mimeType: string;
    size: number;
    uploadedAt: Date;
  }>;
};

const buildSelfCheckinTelemetryProperties = (
  req: Request,
  extras?: Record<string, string>
): Record<string, string> => {
  const sourceCode = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const ip = String(req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "");

  return {
    route: "self-checkin.create",
    hasSourceCode: String(Boolean(sourceCode)),
    ip,
    userAgent: String(req.get("user-agent") || ""),
    ...(extras || {}),
  };
};

const parseGuestsInput = (rawGuests: unknown): NormalizedGuest[] => {
  let value: unknown = rawGuests;

  if (typeof rawGuests === "string") {
    try {
      value = JSON.parse(rawGuests);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => ({
    breakfastChoice: (() => {
      const raw = String((item as any)?.breakfastChoice || "").trim();
      return raw ? (raw as "Savoury" | "Sweet") : undefined;
    })(),
    givenName: String((item as any)?.givenName || "").trim(),
    familyName: String((item as any)?.familyName || "").trim(),
    documentType: String((item as any)?.documentType || "").trim() as "id_card" | "passport",
    documentNumber: String((item as any)?.documentNumber || "").trim(),
    documents: [],
  }));
};

const validateBreakfastTimeRange = (value: string) => {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return false;
  }

  const hh = Number(match[1]);
  const mm = Number(match[2]);
  const total = hh * 60 + mm;
  const min = 8 * 60 + 30;
  const max = 10 * 60;
  return total >= min && total <= max;
};

const resolveGuestIndex = (
  file: Express.Multer.File,
  fileOrderIndex: number,
  rawGuestIndexMap: unknown,
  guestCount: number
) => {
  const fromField = file.fieldname.match(/guestFiles\[(\d+)\]|guestFiles_(\d+)/);
  if (fromField) {
    const value = Number(fromField[1] || fromField[2]);
    if (!Number.isNaN(value) && value >= 0 && value < guestCount) {
      return value;
    }
  }

  let mapValues: number[] = [];
  if (typeof rawGuestIndexMap === "string" && rawGuestIndexMap.trim()) {
    try {
      const parsed = JSON.parse(rawGuestIndexMap);
      if (Array.isArray(parsed)) {
        mapValues = parsed.map((entry) => Number(entry));
      }
    } catch {
      mapValues = rawGuestIndexMap
        .split(",")
        .map((entry) => Number(entry.trim()))
        .filter((entry) => !Number.isNaN(entry));
    }
  } else if (Array.isArray(rawGuestIndexMap)) {
    mapValues = rawGuestIndexMap.map((entry) => Number(entry));
  }

  const byMap = mapValues[fileOrderIndex];
  if (!Number.isNaN(byMap) && byMap >= 0 && byMap < guestCount) {
    return byMap;
  }

  return Math.min(fileOrderIndex, Math.max(guestCount - 1, 0));
};

const verifyTurnstileIfEnabled = async (req: Request) => {
  const turnstileToken = String(req.body?.turnstileToken || "").trim();
  const isNonProduction = process.env.NODE_ENV !== "production";
  const devCaptchaBypassEnabled =
    isNonProduction &&
    (process.env.ENABLE_DEV_CAPTCHA === "true" || turnstileToken === "DEV_BYPASS");
  const turnstileRequired = Boolean(process.env.TURNSTILE_SECRET) && !devCaptchaBypassEnabled;

  if (!turnstileRequired) {
    return;
  }

  if (!turnstileToken) {
    throw new Error("Captcha verification is required");
  }

  const params = new URLSearchParams();
  params.append("secret", String(process.env.TURNSTILE_SECRET));
  params.append("response", turnstileToken);
  if (req.ip) {
    params.append("remoteip", String(req.ip));
  }

  const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const verifyJson = await verifyRes.json();
  if (!verifyJson.success) {
    throw new Error("Captcha verification failed");
  }
};

router.use(selfCheckinLimiter);

// POST /api/self-checkin (multipart/form-data)
router.post("/", upload.any(), async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const breakfastIncluded = String(req.query.b || "").trim().toLowerCase() !== "false";

    const fullName = String(body.fullName || body.full_name || "").trim();
    const numberOfNights = Number(body.numberOfNights || body.number_of_nights || 0);
    const breakfastTime = String(body.breakfastTime || body.breakfast_time || "").trim();
    const guests = parseGuestsInput(body.guests);

    await verifyTurnstileIfEnabled(req);

    if (!fullName || !numberOfNights || (breakfastIncluded && !breakfastTime)) {
      trackTelemetryEvent(
        "self_checkin_validation_failed",
        buildSelfCheckinTelemetryProperties(req, {
          reason: "missing_required_top_level_fields",
          breakfastIncluded: String(breakfastIncluded),
        })
      );
      return res.status(400).json({ message: "Missing required top-level fields" });
    }

    if (breakfastIncluded && !validateBreakfastTimeRange(breakfastTime)) {
      trackTelemetryEvent(
        "self_checkin_validation_failed",
        buildSelfCheckinTelemetryProperties(req, {
          reason: "invalid_breakfast_time_range",
          breakfastTime,
        })
      );
      return res.status(400).json({ message: "Breakfast time must be between 08:30 and 10:00 (HH:mm)" });
    }

    if (guests.length < 1 || guests.length > 4) {
      trackTelemetryEvent(
        "self_checkin_validation_failed",
        buildSelfCheckinTelemetryProperties(req, {
          reason: "invalid_guest_count",
          guestCount: String(guests.length),
        })
      );
      return res.status(400).json({ message: "Guests must be between 1 and 4" });
    }

    for (let i = 0; i < guests.length; i++) {
      const guest = guests[i];
      if (!guest.givenName || !guest.familyName || !guest.documentNumber) {
        trackTelemetryEvent(
          "self_checkin_validation_failed",
          buildSelfCheckinTelemetryProperties(req, {
            reason: "missing_required_guest_fields",
            guestIndex: String(i),
          })
        );
        return res.status(400).json({ message: `Guest ${i + 1} is missing required fields` });
      }
      if (!["id_card", "passport"].includes(guest.documentType)) {
        trackTelemetryEvent(
          "self_checkin_validation_failed",
          buildSelfCheckinTelemetryProperties(req, {
            reason: "invalid_guest_document_type",
            guestIndex: String(i),
            guestDocumentType: guest.documentType,
          })
        );
        return res.status(400).json({ message: `Guest ${i + 1} has invalid documentType` });
      }
      if (breakfastIncluded && !guest.breakfastChoice) {
        trackTelemetryEvent(
          "self_checkin_validation_failed",
          buildSelfCheckinTelemetryProperties(req, {
            reason: "missing_guest_breakfast_choice",
            guestIndex: String(i),
          })
        );
        return res.status(400).json({ message: `Guest ${i + 1} is missing breakfastChoice` });
      }
      if (breakfastIncluded && guest.breakfastChoice && !["Savoury", "Sweet"].includes(guest.breakfastChoice)) {
        trackTelemetryEvent(
          "self_checkin_validation_failed",
          buildSelfCheckinTelemetryProperties(req, {
            reason: "invalid_guest_breakfast_choice",
            guestIndex: String(i),
            breakfastChoice: String(guest.breakfastChoice),
          })
        );
        return res.status(400).json({ message: `Guest ${i + 1} has invalid breakfastChoice` });
      }
      if (!breakfastIncluded) {
        guest.breakfastChoice = undefined;
      }
    }

    const sourceCode = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!sourceCode) {
      trackTelemetryEvent(
        "self_checkin_validation_failed",
        buildSelfCheckinTelemetryProperties(req, {
          reason: "missing_query_code",
        })
      );
      return res.status(400).json({ message: "Missing required query parameter q" });
    }

    const code = sourceCode;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const userAgent = req.get("user-agent") || undefined;

    const record = new SelfCheckin({
      fullName,
      numberOfNights,
      breakfastTime: breakfastIncluded ? breakfastTime : undefined,
      guests,
      sourceCode,
      ipAddress: typeof ipAddress === "string" ? ipAddress : undefined,
      userAgent,
      code,
    });

    const files = (req.files || []) as Express.Multer.File[];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const detected = detectMimeType(file.buffer);
      if (!detected || !allowedMimeTypes.has(detected)) {
        trackTelemetryEvent(
          "self_checkin_validation_failed",
          buildSelfCheckinTelemetryProperties(req, {
            reason: "invalid_file_format",
            fileName: String(file.originalname || ""),
            mimeType: String(file.mimetype || ""),
          })
        );
        return res.status(400).json({
          message: `Invalid file format for ${file.originalname}. Allowed: JPG, PNG, WEBP, PDF.`,
        });
      }
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const guestIndex = resolveGuestIndex(file, i, body.guestFileGuestIndexes, guests.length);
      const detectedMimeType = detectMimeType(file.buffer) || file.mimetype;
      const stored = await saveSelfCheckinFileToGridFS({
        buffer: file.buffer,
        filename: file.originalname || `guest-${guestIndex + 1}-document`,
        mimeType: detectedMimeType,
      });

      record.guests[guestIndex].documents.push({
        gridFsId: stored.gridFsId,
        filename: stored.filename,
        mimeType: stored.mimeType,
        size: stored.size,
        uploadedAt: stored.uploadedAt,
      });
    }

    for (let i = 0; i < record.guests.length; i++) {
      if (!record.guests[i].documents || record.guests[i].documents.length === 0) {
        trackTelemetryEvent(
          "self_checkin_validation_failed",
          buildSelfCheckinTelemetryProperties(req, {
            reason: "missing_guest_document_file",
            guestIndex: String(i),
          })
        );
        return res.status(400).json({
          message: `Guest ${i + 1} must include a document file (image or PDF).`,
        });
      }
    }

    await record.save();

    let notificationsSent = true;
    let warning: string | undefined;

    try {
      if (process.env.DISABLE_CONTACT_EMAILS === "true") {
        console.info("DISABLE_CONTACT_EMAILS=true — skipping self-checkin email for local testing");
      } else {
        await sendSelfCheckinNotificationEmail({
          id: record._id.toString(),
          fullName,
          breakfastTime,
          numberOfNights,
          sourceCode,
          code,
          guests: record.guests,
        });
      }
    } catch (emailErr) {
      notificationsSent = false;
      warning = "Self check-in saved, but admin notification email could not be sent.";
      logError("Self-checkin notification email failed", emailErr, {
        route: "self-checkin.create",
        selfCheckinId: String(record._id),
      });
      trackTelemetryException(
        emailErr,
        buildSelfCheckinTelemetryProperties(req, {
          reason: "notification_email_failed",
          selfCheckinId: String(record._id),
        })
      );
      trackTelemetryEvent(
        "self_checkin_notification_failed",
        buildSelfCheckinTelemetryProperties(req, {
          selfCheckinId: String(record._id),
        })
      );
    }

    const instructionVideoUrl = process.env.SELF_CHECKIN_INSTRUCTION_VIDEO_URL ||
      "https://www.youtube.com/watch?v=PRb5yw89zxw";

    const resp: any = {
      id: record._id,
      code,
      instructionVideoUrl,
    };

    resp.notificationsSent = notificationsSent;
    if (warning) {
      resp.warning = warning;
    }

    trackTelemetryEvent(
      "self_checkin_submitted",
      buildSelfCheckinTelemetryProperties(req, {
        selfCheckinId: String(record._id),
        hasCode: String(Boolean(code)),
        notificationsSent: String(notificationsSent),
      }),
      {
        guestCount: guests.length,
        fileCount: files.length,
        numberOfNights,
      }
    );

    return res.status(201).json(resp);
  } catch (error) {
    logError("Self-checkin create failed", error, {
      route: "self-checkin.create",
    });
    trackTelemetryException(
      error,
      buildSelfCheckinTelemetryProperties(req, {
        reason: "create_exception",
      })
    );
    trackTelemetryEvent(
      "self_checkin_create_failed",
      buildSelfCheckinTelemetryProperties(req)
    );
    return res.status(500).json({ message: "Failed to save self check-in" });
  }
});

// Admin - list submissions
router.get("/admin", verifyToken, requireRole("admin", "hotel_owner"), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
    const skip = Math.max(Number(req.query.skip || 0), 0);
    const [items, total] = await Promise.all([
      SelfCheckin.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("fullName breakfastTime numberOfNights sourceCode code createdAt guests"),
      SelfCheckin.countDocuments({}),
    ]);

    res.status(200).json({ items, total, limit, skip });
  } catch (error) {
    logError("Self-checkin admin list failed", error, {
      route: "self-checkin.admin.list",
    });
    trackTelemetryException(error, {
      route: "self-checkin.admin.list",
    });
    trackTelemetryEvent("self_checkin_admin_list_failed", {
      route: "self-checkin.admin.list",
    });
    res.status(500).json({ message: "Unable to fetch self check-ins" });
  }
});

// Admin - single submission detail
router.get("/admin/:id", verifyToken, requireRole("admin", "hotel_owner"), async (req: Request, res: Response) => {
  try {
    const item = await SelfCheckin.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Self check-in not found" });
    }
    return res.status(200).json(item);
  } catch (error) {
    logError("Self-checkin admin detail failed", error, {
      route: "self-checkin.admin.detail",
      selfCheckinId: String(req.params.id || ""),
    });
    trackTelemetryException(error, {
      route: "self-checkin.admin.detail",
      selfCheckinId: String(req.params.id || ""),
    });
    trackTelemetryEvent("self_checkin_admin_detail_failed", {
      route: "self-checkin.admin.detail",
      selfCheckinId: String(req.params.id || ""),
    });
    return res.status(500).json({ message: "Unable to fetch self check-in details" });
  }
});

// Admin - stream GridFS file belonging to a submission
router.get(
  "/admin/:id/files/:fileId",
  verifyToken,
  requireRole("admin", "hotel_owner"),
  async (req: Request, res: Response) => {
    try {
      const item = await SelfCheckin.findById(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Self check-in not found" });
      }

      const fileId = req.params.fileId;
      const hasFile = item.guests.some((guest) =>
        (guest.documents || []).some((doc) => String(doc.gridFsId) === fileId)
      );

      if (!hasFile) {
        return res.status(404).json({ message: "File not found for this submission" });
      }

      const streamData = await getSelfCheckinFileStream(fileId);
      if (!streamData) {
        return res.status(404).json({ message: "File not found" });
      }

      const contentType = String(streamData.fileDoc.contentType || "application/octet-stream");
      const filename = String(streamData.fileDoc.filename || "document");

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename=\"${filename.replace(/\"/g, "")}\"`);

      streamData.stream.on("error", () => {
        if (!res.headersSent) {
          res.status(500).json({ message: "Unable to stream file" });
        }
      });

      streamData.stream.pipe(res);
      return;
    } catch (error) {
      logError("Self-checkin admin file stream failed", error, {
        route: "self-checkin.admin.file",
        selfCheckinId: String(req.params.id || ""),
        fileId: String(req.params.fileId || ""),
      });
      trackTelemetryException(error, {
        route: "self-checkin.admin.file",
        selfCheckinId: String(req.params.id || ""),
        fileId: String(req.params.fileId || ""),
      });
      trackTelemetryEvent("self_checkin_admin_file_failed", {
        route: "self-checkin.admin.file",
        selfCheckinId: String(req.params.id || ""),
        fileId: String(req.params.fileId || ""),
      });
      return res.status(500).json({ message: "Unable to stream file" });
    }
  }
);

// Admin - delete submission and all uploaded files
router.delete(
  "/admin/:id",
  verifyToken,
  requireRole("admin", "hotel_owner"),
  async (req: Request, res: Response) => {
    try {
      const item = await SelfCheckin.findById(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Self check-in not found" });
      }

      const fileIds = item.guests.flatMap((guest) =>
        (guest.documents || []).map((doc) => String(doc.gridFsId || "")).filter(Boolean)
      );

      let deletedFiles = 0;
      for (const fileId of fileIds) {
        try {
          await deleteSelfCheckinFileFromGridFS(fileId);
          deletedFiles += 1;
        } catch (fileErr) {
          logError("Self-checkin file delete failed", fileErr, {
            route: "self-checkin.admin.delete",
            selfCheckinId: String(req.params.id || ""),
            fileId,
          });
        }
      }

      await SelfCheckin.deleteOne({ _id: item._id });

      trackTelemetryEvent("self_checkin_admin_deleted", {
        route: "self-checkin.admin.delete",
        selfCheckinId: String(item._id),
      }, {
        fileCount: fileIds.length,
        deletedFiles,
      });

      return res.status(200).json({
        message: "Self check-in deleted successfully",
        id: String(item._id),
        deletedFiles,
      });
    } catch (error) {
      logError("Self-checkin admin delete failed", error, {
        route: "self-checkin.admin.delete",
        selfCheckinId: String(req.params.id || ""),
      });
      trackTelemetryException(error, {
        route: "self-checkin.admin.delete",
        selfCheckinId: String(req.params.id || ""),
      });
      trackTelemetryEvent("self_checkin_admin_delete_failed", {
        route: "self-checkin.admin.delete",
        selfCheckinId: String(req.params.id || ""),
      });
      return res.status(500).json({ message: "Unable to delete self check-in" });
    }
  }
);

export default router;
