import express, { Request, Response } from "express";
import multer from "multer";
import Hotel from "../models/hotel";
import verifyToken from "../middleware/auth";
import requireRole from "../middleware/requireRole";
import { body } from "express-validator";
import { HotelType } from "../../../shared/types";
import { recordAuditEvent } from "../lib/audit-log";
import { logError } from "../lib/logger";

const router = express.Router();

class UploadValidationError extends Error {
  statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
    this.statusCode = 400;
  }
}

const allowedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const detectImageMimeType = (buffer: Buffer) => {
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

  return null;
};

const validateUploadedImages = (files: Express.Multer.File[]) => {
  files.forEach((file) => {
    if (!allowedImageMimeTypes.has(file.mimetype)) {
      throw new UploadValidationError(
        `Unsupported file type for ${file.originalname}. Allowed types: JPEG, PNG, WEBP.`
      );
    }

    const detectedMimeType = detectImageMimeType(file.buffer);
    if (!detectedMimeType || detectedMimeType !== file.mimetype) {
      throw new UploadValidationError(
        `File signature validation failed for ${file.originalname}.`
      );
    }
  });
};

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedImageMimeTypes.has(file.mimetype)) {
      cb(new UploadValidationError("Only JPEG, PNG, and WEBP images are allowed."));
      return;
    }

    cb(null, true);
  },
});

const hotelImageUpload = (req: Request, res: Response, next: express.NextFunction) => {
  upload.array("imageFiles", 6)(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "Each image must be 5MB or smaller."
          : "Image upload failed validation.";

      res.status(400).json({ message });
      return;
    }

    if (error instanceof UploadValidationError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }

    next(error);
  });
};

const getUploadedFiles = (req: Request) => {
  const files = (req as Request & { files?: Express.Multer.File[] }).files;
  return Array.isArray(files) ? files : [];
};

router.post(
  "/",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("city").notEmpty().withMessage("City is required"),
    body("country").notEmpty().withMessage("Country is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("type")
      .notEmpty()
      .isArray({ min: 1 })
      .withMessage("Select at least one hotel type"),
    body("pricePerNight")
      .notEmpty()
      .isNumeric()
      .withMessage("Price per night is required and must be a number"),
    body("facilities")
      .notEmpty()
      .isArray()
      .withMessage("Facilities are required"),
  ],
  hotelImageUpload,
  async (req: Request, res: Response) => {
    try {
      const singlePropertyMode =
        String(process.env.SINGLE_PROPERTY_MODE || "false").toLowerCase() ===
        "true";

      if (singlePropertyMode) {
        const existingHotelsCount = await Hotel.countDocuments();
        if (existingHotelsCount >= 1) {
          return res.status(409).json({
            message:
              "Single-property mode enabled: only one property can be configured.",
          });
        }
      }

      const imageFiles = getUploadedFiles(req);
      validateUploadedImages(imageFiles);
      const newHotel: HotelType = req.body;

      // Ensure type is always an array
      if (typeof newHotel.type === "string") {
        newHotel.type = [newHotel.type];
      }

      // Handle nested objects from FormData
      newHotel.contact = {
        phone: req.body["contact.phone"] || "",
        email: req.body["contact.email"] || "",
        website: req.body["contact.website"] || "",
      };

      newHotel.policies = {
        checkInTime: req.body["policies.checkInTime"] || "",
        checkOutTime: req.body["policies.checkOutTime"] || "",
        cancellationPolicy: req.body["policies.cancellationPolicy"] || "",
        petPolicy: req.body["policies.petPolicy"] || "",
        smokingPolicy: req.body["policies.smokingPolicy"] || "",
      };

      const imageUrls = await uploadImages(imageFiles);

      newHotel.imageUrls = imageUrls;
      newHotel.lastUpdated = new Date();
      newHotel.userId = req.userId;

      const hotel = new Hotel(newHotel);
      await hotel.save();

      await recordAuditEvent({
        action: "hotel.created",
        entityType: "hotel",
        entityId: String(hotel._id),
        hotelId: String(hotel._id),
        actorId: req.userId,
        actorRole: req.userRole,
        req,
        metadata: {
          name: hotel.name,
          city: hotel.city,
          country: hotel.country,
          imageCount: hotel.imageUrls.length,
        },
      });

      res.status(201).send(hotel);
    } catch (e) {
      if (e instanceof UploadValidationError) {
        return res.status(e.statusCode).json({ message: e.message });
      }

      logError("Unable to create hotel", e, { route: "my-hotels.create" });
      res.status(500).json({ message: "Something went wrong" });
    }
  }
);

router.get(
  "/",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  async (req: Request, res: Response) => {
  try {
    const hotels = await Hotel.find({ userId: req.userId });
    res.json(hotels);
  } catch (error) {
    res.status(500).json({ message: "Error fetching hotels" });
  }
  }
);

router.get(
  "/:id",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  async (req: Request, res: Response) => {
  const id = req.params.id.toString();
  try {
    const hotel = await Hotel.findOne({
      _id: id,
      userId: req.userId,
    });
    res.json(hotel);
  } catch (error) {
    res.status(500).json({ message: "Error fetching hotels" });
  }
  }
);

router.put(
  "/:hotelId",
  verifyToken,
  requireRole("hotel_owner", "admin"),
  hotelImageUpload,
  async (req: Request, res: Response) => {
    try {
      // First, find the existing hotel
      const existingHotel = await Hotel.findOne({
        _id: req.params.hotelId,
        userId: req.userId,
      });

      if (!existingHotel) {
        return res.status(404).json({ message: "Hotel not found" });
      }

      // Prepare update data
      const updateData: any = {
        name: req.body.name,
        city: req.body.city,
        country: req.body.country,
        description: req.body.description,
        type: Array.isArray(req.body.type) ? req.body.type : [req.body.type],
        pricePerNight: Number(req.body.pricePerNight),
        starRating: Number(req.body.starRating),
        adultCount: Number(req.body.adultCount),
        childCount: Number(req.body.childCount),
        facilities: Array.isArray(req.body.facilities)
          ? req.body.facilities
          : [req.body.facilities],
        lastUpdated: new Date(),
      };

      // Handle contact information
      updateData.contact = {
        phone: req.body["contact.phone"] || "",
        email: req.body["contact.email"] || "",
        website: req.body["contact.website"] || "",
      };

      // Handle policies
      updateData.policies = {
        checkInTime: req.body["policies.checkInTime"] || "",
        checkOutTime: req.body["policies.checkOutTime"] || "",
        cancellationPolicy: req.body["policies.cancellationPolicy"] || "",
        petPolicy: req.body["policies.petPolicy"] || "",
        smokingPolicy: req.body["policies.smokingPolicy"] || "",
      };

      // Update the hotel
      const updatedHotel = await Hotel.findByIdAndUpdate(
        req.params.hotelId,
        updateData,
        { new: true }
      );

      if (!updatedHotel) {
        return res.status(404).json({ message: "Hotel not found" });
      }

      // Handle image uploads if any
      const files = getUploadedFiles(req);
      if (files && files.length > 0) {
        validateUploadedImages(files);
        const updatedImageUrls = await uploadImages(files);
        updatedHotel.imageUrls = [
          ...updatedImageUrls,
          ...(req.body.imageUrls
            ? Array.isArray(req.body.imageUrls)
              ? req.body.imageUrls
              : [req.body.imageUrls]
            : []),
        ];
        await updatedHotel.save();
      }

      await recordAuditEvent({
        action: "hotel.updated",
        entityType: "hotel",
        entityId: String(updatedHotel._id),
        hotelId: String(updatedHotel._id),
        actorId: req.userId,
        actorRole: req.userRole,
        req,
        metadata: {
          name: updatedHotel.name,
          city: updatedHotel.city,
          country: updatedHotel.country,
          imageCount: updatedHotel.imageUrls.length,
        },
      });

      res.status(200).json(updatedHotel);
    } catch (error) {
      if (error instanceof UploadValidationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      logError("Unable to update hotel", error, {
        route: "my-hotels.update",
        hotelId: req.params.hotelId,
      });
      res.status(500).json({
        message: "Something went wrong",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

async function uploadImages(imageFiles: any[]) {
  const uploadPromises = imageFiles.map(async (image) => {
    const b64 = Buffer.from(image.buffer as Uint8Array).toString("base64");
    let dataURI = "data:" + image.mimetype + ";base64," + b64;
    return dataURI;
  });

  const imageUrls = await Promise.all(uploadPromises);
  return imageUrls;
}

export default router;
