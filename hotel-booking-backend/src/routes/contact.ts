import express, { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { sendContactEmails } from "../lib/contact-mail";

const router = express.Router();

// Tight rate limiter for contact form to reduce automated spam
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 requests per windowMs
  message: "Too many contact form submissions from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return ipKeyGenerator(String(req.ip || ""));
  },
});

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Submit contact form
 *     description: Sends a contact notification email to the Palazzo Pinto inbox and a confirmation email to the user.
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - message
 *               - privacyAccepted
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               message:
 *                 type: string
 *               privacyAccepted:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Contact message sent
 *       400:
 *         description: Validation failed
 *       500:
 *         description: Mail delivery failed
 */
router.post(
  "/",
  contactLimiter,
  [
    body("name")
      .trim()
      .isLength({ min: 2, max: 120 })
      .withMessage("Name must be between 2 and 120 characters"),
    body("email").trim().isEmail().withMessage("A valid email is required"),
    body("phone")
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 50 })
      .withMessage("Phone number is too long"),
    body("message")
      .trim()
      .isLength({ min: 10, max: 4000 })
      .withMessage("Message must be between 10 and 4000 characters"),
    body("privacyAccepted")
      .custom((value) => value === true || value === "true")
      .withMessage("Privacy consent is required"),
    // devCaptcha removed: using Cloudflare Turnstile and honeypot/ratelimit instead
  ],
  async (req: Request, res: Response) => {
    // Simple honeypot check: legitimate users won't fill this hidden field
    if (req.body && typeof req.body.hp === "string" && req.body.hp.trim() !== "") {
      console.warn("Contact form honeypot triggered", { ip: req.ip, ua: req.headers["user-agent"] });
      return res.status(400).json({ message: "Validation failed" });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    // Verify Cloudflare Turnstile token if provided or required in dev
    const turnstileToken = String(req.body.turnstileToken || "").trim();
    const isNonProduction = process.env.NODE_ENV !== "production";
    const devCaptchaBypassEnabled =
      process.env.ENABLE_DEV_CAPTCHA === "true" ||
      (isNonProduction && turnstileToken === "DEV_BYPASS");

    // Require Turnstile verification only when secret is configured and bypass is disabled.
    const turnstileRequired = Boolean(process.env.TURNSTILE_SECRET) && !devCaptchaBypassEnabled;

    if (turnstileRequired) {
      if (!turnstileToken) {
        return res.status(400).json({ message: "Captcha verification is required" });
      }

      try {
        const secret = process.env.TURNSTILE_SECRET as string;
        if (!secret) {
          // If no secret configured but required, fail safe
          return res.status(500).json({ message: "Captcha verification not configured on server" });
        }

        const params = new URLSearchParams();
        params.append("secret", secret);
        params.append("response", turnstileToken);
        if (req.ip) params.append("remoteip", String(req.ip));

        const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        });

        const verifyJson = await verifyRes.json();
        if (!verifyJson.success) {
          console.warn("Turnstile verification failed", verifyJson);
          return res.status(400).json({ message: "Captcha verification failed" });
        }
      } catch (err) {
        console.error("Turnstile verification error", err);
        return res.status(500).json({ message: "Captcha verification error" });
      }
    }

    const payload = {
      name: String(req.body.name || "").trim(),
      email: String(req.body.email || "").trim().toLowerCase(),
      phone: String(req.body.phone || "").trim() || undefined,
      message: String(req.body.message || "").trim(),
    };

    try {
      if (process.env.DISABLE_CONTACT_EMAILS === "true") {
        console.info("DISABLE_CONTACT_EMAILS=true — skipping sendContactEmails for local testing");
      } else {
        await sendContactEmails(payload);
      }

      return res.status(200).json({
        message: "Your message has been sent successfully.",
      });
    } catch (error) {
      console.error("Contact form email error:", error);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown mail delivery error";

      if (errorMessage.includes("ErrorAccessDenied") || errorMessage.includes("403")) {
        return res.status(500).json({
          message:
            "Contact mail service is not authorized in Microsoft tenant yet (Graph AccessDenied). Complete Mail.Send app permission + admin consent for info@palazzopintobnb.com.",
        });
      }

      return res.status(500).json({
        message:
          "We could not send your message right now. Please try again in a few minutes.",
      });
    }
  }
);

export default router;
