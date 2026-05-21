import mongoose, { Document } from "mongoose";

export type SchedulerRunStatus = "success" | "failed" | "skipped";

export type SchedulerRunErrorDetail = {
  code: string;
  message: string;
  externalEventId?: string;
  hotelId?: string;
};

export interface ISchedulerRunLog extends Document {
  schedulerName: string;
  slotKey: string;
  runDateKey: string;
  timeZone: string;
  status: SchedulerRunStatus;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  processed: number;
  syncedOneNote: number;
  syncedExcel: number;
  enrichedNames: number;
  errorCount: number;
  errorDetails: SchedulerRunErrorDetail[];
  reason?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schedulerRunLogSchema = new mongoose.Schema(
  {
    schedulerName: { type: String, required: true, trim: true },
    slotKey: { type: String, required: true, trim: true },
    runDateKey: { type: String, required: true, trim: true },
    timeZone: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["success", "failed", "skipped"],
      required: true,
    },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, required: true },
    durationMs: { type: Number, required: true, min: 0 },
    processed: { type: Number, required: true, min: 0, default: 0 },
    syncedOneNote: { type: Number, required: true, min: 0, default: 0 },
    syncedExcel: { type: Number, required: true, min: 0, default: 0 },
    enrichedNames: { type: Number, required: true, min: 0, default: 0 },
    errorCount: { type: Number, required: true, min: 0, default: 0 },
    errorDetails: [
      {
        code: { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true },
        externalEventId: { type: String, trim: true, default: "" },
        hotelId: { type: String, trim: true, default: "" },
      },
    ],
    reason: { type: String, trim: true, default: "" },
    errorCode: { type: String, trim: true, default: "" },
    errorMessage: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

schedulerRunLogSchema.index({ schedulerName: 1, runDateKey: 1, startedAt: -1 });

export default mongoose.model<ISchedulerRunLog>("SchedulerRunLog", schedulerRunLogSchema);
