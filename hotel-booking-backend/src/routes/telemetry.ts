import express, { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import geoip from "geoip-lite";
import { logInfo } from "../lib/logger";
import { trackTelemetryEvent } from "../lib/telemetry";

const router = express.Router();

const getClientIp = (req: Request): string => {
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (typeof xForwardedFor === "string" && xForwardedFor.length > 0) {
    return xForwardedFor.split(",")[0].trim();
  }

  return String(req.ip || "").replace(/^::ffff:/, "");
};

const isPrivateOrLocalIp = (ip: string): boolean => {
  return (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
};

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
    const geo = !isPrivateOrLocalIp(ip) ? geoip.lookup(ip) : null;

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
        String(req.headers["cf-ipcountry"] || "") || geo?.country || "",
      region: String(req.headers["x-appengine-region"] || "") || geo?.region || "",
      city: geo?.city || "",
    };

    logInfo("public_page_view", pageViewContext);

    trackTelemetryEvent("public_page_view", {
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
    });

    return res.status(204).send();
  }
);

export default router;
