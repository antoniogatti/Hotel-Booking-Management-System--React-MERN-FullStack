import express, { Request, Response } from "express";
import { query, validationResult } from "express-validator";
import verifyToken from "../middleware/auth";
import requireRole from "../middleware/requireRole";
import SchedulerRunLog from "../models/scheduler-run-log";
import { logError } from "../lib/logger";

const router = express.Router();
const SCHEDULER_TIME_ZONE = process.env.BOOKING_ENRICHMENT_TIME_ZONE || "Europe/Rome";

const toDateKeyInTimeZone = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

router.get(
  "/enrichment/runs",
  verifyToken,
  requireRole("admin"),
  [
    query("date")
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("date must be YYYY-MM-DD"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const dateKey = String(req.query.date || toDateKeyInTimeZone(new Date(), SCHEDULER_TIME_ZONE));

      const runs = await SchedulerRunLog.find({
        schedulerName: "booking_enrichment",
        runDateKey: dateKey,
      })
        .sort({ startedAt: -1 })
        .lean();

      return res.status(200).json({
        date: dateKey,
        timeZone: SCHEDULER_TIME_ZONE,
        message: runs.length === 0 ? "No scheduler logs available for this day." : undefined,
        runs: runs.map((run) => ({
          _id: String(run._id),
          slotKey: run.slotKey,
          status: run.status,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          durationMs: run.durationMs,
          processed: run.processed,
          syncedOneNote: run.syncedOneNote,
          syncedExcel: run.syncedExcel,
          enrichedNames: run.enrichedNames,
          errors: run.errorCount,
          errorDetails: (run.errorDetails || []).map((detail) => ({
            code: detail.code,
            message: detail.message,
            externalEventId: detail.externalEventId || undefined,
            hotelId: detail.hotelId || undefined,
          })),
          reason: run.reason || undefined,
          errorCode: run.errorCode || undefined,
          errorMessage: run.errorMessage || undefined,
        })),
      });
    } catch (error) {
      logError("Unable to fetch scheduler monitor runs", error, {
        route: "scheduler-monitor.enrichment-runs",
        actorId: req.userId,
      });
      return res.status(500).json({ message: "Unable to fetch scheduler logs" });
    }
  }
);

export default router;
