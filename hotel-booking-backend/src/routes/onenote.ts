import express, { Request, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import verifyToken from "../middleware/auth";
import requireRole from "../middleware/requireRole";
import User from "../models/user";
import Booking from "../models/booking";
import ExternalCalendarEvent from "../models/external-calendar-event";
import { getValidMicrosoftGraphAccessToken } from "../lib/microsoft-graph-auth";
import {
  getOneNotePage,
  getOneNotePageContent,
  listOneNoteNotebooks,
  listOneNotePages,
  listPrenotazioniPages,
  listOneNoteSections,
} from "../lib/onenote-service";
import {
  extractPlainTextLinesFromOneNoteHtml,
  parseOneNoteBookingPage,
} from "../lib/onenote-booking-parser";
import { extractBookingDataWithAzureOpenAI } from "../lib/azure-openai-booking-extractor";
import { applyOneNoteSyncToRecord, splitGuestName } from "../lib/onenote-booking-apply";
import { recordAuditEvent } from "../lib/audit-log";
import { logError } from "../lib/logger";

const router = express.Router();
const PRENOTAZIONI_PAGE_BATCH_SIZE = 10;

router.use(verifyToken, requireRole("admin"));

const getUserGraphAccessToken = async (req: Request, res: Response) => {
  const user = await User.findById(req.userId);
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return null;
  }

  const accessToken = await getValidMicrosoftGraphAccessToken(user);
  if (!accessToken) {
    res.status(409).json({
      message:
        "Microsoft Graph is not connected for this account. Sign in with Microsoft again and grant Notes.Read access.",
    });
    return null;
  }

  return accessToken;
};

const mapPrenotazioniPage = async (accessToken: string, page: Awaited<ReturnType<typeof listOneNotePages>>["value"][number]) => {
  try {
    const content = await getOneNotePageContent(accessToken, page.id);
    return {
      pageId: page.id,
      title: page.title,
      createdDateTime: page.createdDateTime,
      lastModifiedDateTime: page.lastModifiedDateTime,
      parentSection: page.parentSection,
      parsed: parseOneNoteBookingPage({
        title: page.title,
        html: content,
      }),
      rawHtml: content,
      parseError: null,
    };
  } catch (pageError) {
    return {
      pageId: page.id,
      title: page.title,
      createdDateTime: page.createdDateTime,
      lastModifiedDateTime: page.lastModifiedDateTime,
      parentSection: page.parentSection,
      parsed: null,
      rawHtml: null,
      parseError:
        pageError instanceof Error
          ? pageError.message
          : "Unable to fetch or parse this OneNote page",
    };
  }
};

const mapPrenotazioniPagesInBatches = async (
  accessToken: string,
  pages: Awaited<ReturnType<typeof listOneNotePages>>["value"]
) => {
  const bookingResults: Awaited<ReturnType<typeof mapPrenotazioniPage>>[] = [];

  for (let index = 0; index < pages.length; index += PRENOTAZIONI_PAGE_BATCH_SIZE) {
    const batch = pages.slice(index, index + PRENOTAZIONI_PAGE_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((page) => mapPrenotazioniPage(accessToken, page))
    );
    bookingResults.push(...batchResults);
  }

  return bookingResults;
};

router.get("/notebooks", async (req: Request, res: Response) => {
  try {
    const accessToken = await getUserGraphAccessToken(req, res);
    if (!accessToken) {
      return;
    }

    const notebooks = await listOneNoteNotebooks(accessToken);
    res.status(200).json(notebooks);
  } catch (error) {
    logError("Unable to fetch OneNote notebooks", error, {
      route: "onenote.notebooks",
      actorId: req.userId,
    });
    res.status(500).json({ message: "Unable to fetch OneNote notebooks" });
  }
});

router.get(
  "/sections",
  [query("notebookId").optional().isString().withMessage("Notebook ID must be a string")],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const accessToken = await getUserGraphAccessToken(req, res);
      if (!accessToken) {
        return;
      }

      const sections = await listOneNoteSections(
        accessToken,
        req.query.notebookId ? String(req.query.notebookId) : undefined
      );
      res.status(200).json(sections);
    } catch (error) {
      logError("Unable to fetch OneNote sections", error, {
        route: "onenote.sections",
        actorId: req.userId,
        notebookId: req.query.notebookId,
      });
      res.status(500).json({ message: "Unable to fetch OneNote sections" });
    }
  }
);

router.get(
  "/pages",
  [query("sectionId").optional().isString().withMessage("Section ID must be a string")],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const accessToken = await getUserGraphAccessToken(req, res);
      if (!accessToken) {
        return;
      }

      const pages = await listOneNotePages(
        accessToken,
        req.query.sectionId ? String(req.query.sectionId) : undefined
      );
      res.status(200).json(pages);
    } catch (error) {
      logError("Unable to fetch OneNote pages", error, {
        route: "onenote.pages",
        actorId: req.userId,
        sectionId: req.query.sectionId,
      });
      res.status(500).json({ message: "Unable to fetch OneNote pages" });
    }
  }
);

router.get(
  "/prenotazioni/bookings",
  async (req: Request, res: Response) => {
    try {
      const accessToken = await getUserGraphAccessToken(req, res);
      if (!accessToken) {
        return;
      }

      const { sections, pages } = await listPrenotazioniPages(accessToken);
      const bookingResults = await mapPrenotazioniPagesInBatches(accessToken, pages);

      res.status(200).json({
        sectionName: "Prenotazioni",
        sectionCount: sections.length,
        bookingCount: bookingResults.length,
        parsedCount: bookingResults.filter((booking) => !booking.parseError).length,
        failedCount: bookingResults.filter((booking) => Boolean(booking.parseError)).length,
        bookings: bookingResults,
      });
    } catch (error) {
      logError("Unable to fetch parsed Prenotazioni bookings from OneNote", error, {
        route: "onenote.prenotazioni-bookings",
        actorId: req.userId,
      });
      res.status(500).json({ message: "Unable to fetch Prenotazioni bookings from OneNote" });
    }
  }
);

router.get(
  "/pages/:pageId",
  [param("pageId").notEmpty().withMessage("Page ID is required")],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const accessToken = await getUserGraphAccessToken(req, res);
      if (!accessToken) {
        return;
      }

      const page = await getOneNotePage(accessToken, req.params.pageId);
      res.status(200).json(page);
    } catch (error) {
      logError("Unable to fetch OneNote page", error, {
        route: "onenote.page",
        actorId: req.userId,
        pageId: req.params.pageId,
      });
      res.status(500).json({ message: "Unable to fetch OneNote page" });
    }
  }
);

router.get(
  "/pages/:pageId/content",
  [param("pageId").notEmpty().withMessage("Page ID is required")],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const accessToken = await getUserGraphAccessToken(req, res);
      if (!accessToken) {
        return;
      }

      const content = await getOneNotePageContent(accessToken, req.params.pageId);
      res.status(200).json({ pageId: req.params.pageId, content });
    } catch (error) {
      logError("Unable to fetch OneNote page content", error, {
        route: "onenote.page-content",
        actorId: req.userId,
        pageId: req.params.pageId,
      });
      res.status(500).json({ message: "Unable to fetch OneNote page content" });
    }
  }
);

router.post(
  "/ai/extract-booking",
  [
    body("text").optional().isString().withMessage("Text must be a string"),
    body("pageId").optional().isString().withMessage("Page ID must be a string"),
    body("bookingId").optional().isString().withMessage("Booking ID must be a string"),
    body("saveToBooking").optional().isBoolean().withMessage("saveToBooking must be a boolean"),
    body("systemPrompt").optional().isString().withMessage("System prompt must be a string"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const rawText = typeof req.body.text === "string" ? req.body.text.trim() : "";
    const pageId = typeof req.body.pageId === "string" ? req.body.pageId.trim() : "";
    const bookingId = typeof req.body.bookingId === "string" ? req.body.bookingId.trim() : "";
    const saveToBooking = req.body.saveToBooking === true;

    if (!rawText && !pageId) {
      return res.status(400).json({
        message: "Provide either text or pageId to extract booking data",
      });
    }

    if (saveToBooking && !bookingId) {
      return res.status(400).json({
        message: "bookingId is required when saveToBooking is true",
      });
    }

    try {
      let sourceText = rawText;
      let pageTitle: string | undefined;
      let ruleBased: ReturnType<typeof parseOneNoteBookingPage> | undefined;

      if (!sourceText) {
        const accessToken = await getUserGraphAccessToken(req, res);
        if (!accessToken) {
          return;
        }

        const [page, html] = await Promise.all([
          getOneNotePage(accessToken, pageId),
          getOneNotePageContent(accessToken, pageId),
        ]);

        pageTitle = page.title;
        sourceText = extractPlainTextLinesFromOneNoteHtml(html).join("\n");
        ruleBased = parseOneNoteBookingPage({
          title: page.title,
          html,
        });
      }

      const extracted = await extractBookingDataWithAzureOpenAI({
        text: sourceText,
        pageTitle,
        systemPrompt: typeof req.body.systemPrompt === "string" ? req.body.systemPrompt : undefined,
      });

      let savedRecord: any = null;
      let recordType: "booking" | "external_booking" | null = null;

      if (saveToBooking && bookingId) {
        let booking = await Booking.findById(bookingId);
        let importedEvent: any = null;

        if (!booking) {
          importedEvent = await ExternalCalendarEvent.findById(bookingId);
        }

        if (!booking && !importedEvent) {
          return res.status(404).json({ message: "Booking not found" });
        }

        const targetRecord = booking || importedEvent;
        recordType = booking ? "booking" : "external_booking";

        applyOneNoteSyncToRecord({
          record: targetRecord,
          matchedPage: {
            pageId: pageId || `azure-openai:${new Date().toISOString()}`,
            title: pageTitle || "Azure OpenAI extraction",
            sectionName: "Prenotazioni",
            parsed: extracted,
          },
          guestName: splitGuestName(
            extracted.guestName || `${targetRecord.firstName || ""} ${targetRecord.lastName || ""}`.trim()
          ),
          fallback: {
            phone: targetRecord.phone,
            email: targetRecord.email,
            nationality: targetRecord.nationality,
          },
        });

        await targetRecord.save();
        savedRecord = targetRecord;

        await recordAuditEvent({
          action: "booking.onenote-ai-sync.completed",
          entityType: recordType,
          entityId: String(targetRecord._id),
          hotelId: String(targetRecord.hotelId),
          actorId: req.userId,
          actorRole: req.userRole,
          req,
          metadata: {
            bookingId,
            pageId: pageId || undefined,
            pageTitle,
            bookingSource: extracted.bookingSource,
            guestName: extracted.guestName,
          },
        });
      }

      return res.status(200).json({
        message: saveToBooking
          ? "Azure OpenAI booking data extracted and applied successfully"
          : "Azure OpenAI booking data extracted successfully",
        extracted,
        source: {
          pageId: pageId || null,
          pageTitle: pageTitle || null,
          textLength: sourceText.length,
        },
        ruleBased,
        booking: savedRecord,
      });
    } catch (error) {
      logError("Unable to extract booking data with Azure OpenAI", error, {
        route: "onenote.ai.extract-booking",
        actorId: req.userId,
        pageId: req.body.pageId,
        bookingId: req.body.bookingId,
      });
      return res.status(500).json({ message: "Unable to extract booking data with Azure OpenAI" });
    }
  }
);

export default router;