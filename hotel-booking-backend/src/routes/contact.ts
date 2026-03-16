import express, { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { sendContactEmails } from "../lib/contact-mail";

const router = express.Router();

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
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const payload = {
      name: String(req.body.name || "").trim(),
      email: String(req.body.email || "").trim().toLowerCase(),
      phone: String(req.body.phone || "").trim() || undefined,
      message: String(req.body.message || "").trim(),
    };

    try {
      await sendContactEmails(payload);

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
