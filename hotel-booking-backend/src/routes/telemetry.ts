import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { body, validationResult } from "express-validator";
import { logInfo } from "../lib/logger";
import {
  getClientIp,
  trackTelemetryEvent,
  trackTelemetryException,
  withClientIp,
} from "../lib/telemetry";

const router = express.Router();

const clientErrorLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  "/client-error",
  clientErrorLimiter,
  [
    body("message").trim().isLength({ min: 1, max: 500 }),
    body("source").optional({ nullable: true }).trim().isLength({ max: 300 }),
    body("stack").optional({ nullable: true }).trim().isLength({ max: 4000 }),
    body("path").optional({ nullable: true }).trim().isLength({ max: 300 }),
  ],
  (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: "Validation failed" });
    }

    const error = new Error(String(req.body.message));
    error.stack = String(req.body.stack || "") || error.stack;

    trackTelemetryException(
      error,
      withClientIp(
        {
          origin: "frontend",
          source: String(req.body.source || ""),
          path: String(req.body.path || ""),
          userAgent: String(req.headers["user-agent"] || ""),
        },
        getClientIp(req)
      )
    );

    return res.status(204).send();
  }
);

router.post(
  "/page-view",
  [
    body("path")
      .trim()
      .isLength({ min: 1, max: 300 })
      .withMessage("Path is required"),
    body("title")
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 200 })
      .withMessage("Title is too long"),
    body("referrer")
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 500 })
      .withMessage("Referrer is too long"),
    body("language")
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 20 })
      .withMessage("Language is too long"),
    body("timeZone")
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 100 })
      .withMessage("Time zone is too long"),
    body("isPublicPage")
      .optional({ nullable: true })
      .custom((value) => value === true || value === false)
      .withMessage("isPublicPage must be boolean"),
  ],
  (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const ip = getClientIp(req);
    const isPublicPage = req.body?.isPublicPage !== false;

    const pageViewContext = {
      path: String(req.body.path || ""),
      title: String(req.body.title || ""),
      referrer: String(req.body.referrer || ""),
      language: String(req.body.language || ""),
      timeZone: String(req.body.timeZone || ""),
      userAgent: String(req.headers["user-agent"] || ""),
      ip,
      isPublicPage,
      countryCode:
        String(req.headers["cf-ipcountry"] || "") || "",
      region: String(req.headers["x-appengine-region"] || "") || "",
      city: "",
    };

    logInfo("public_page_view", pageViewContext);

    trackTelemetryEvent(
      "public_page_view",
      withClientIp(
        {
          path: pageViewContext.path,
          title: pageViewContext.title,
          referrer: pageViewContext.referrer,
          language: pageViewContext.language,
          timeZone: pageViewContext.timeZone,
          userAgent: pageViewContext.userAgent,
          ip: pageViewContext.ip,
          isPublicPage: String(pageViewContext.isPublicPage),
          countryCode: pageViewContext.countryCode,
          region: pageViewContext.region,
          city: pageViewContext.city,
        },
        ip
      )
    );

    return res.status(204).send();
  }
);

export default router;
