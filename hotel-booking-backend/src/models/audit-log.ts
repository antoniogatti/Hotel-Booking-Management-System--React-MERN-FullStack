import mongoose, { Document } from "mongoose";

export interface IAuditLog extends Document {
  action: string;
  entityType: string;
  entityId?: string;
  hotelId?: string;
  actorId?: string;
  actorRole?: string;
  actorEmail?: string;
  targetUserId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, index: true },
    hotelId: { type: String, index: true },
    actorId: { type: String, index: true },
    actorRole: { type: String },
    actorEmail: { type: String },
    targetUserId: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ hotelId: 1, createdAt: -1 });

export default mongoose.model<IAuditLog>("AuditLog", auditLogSchema);