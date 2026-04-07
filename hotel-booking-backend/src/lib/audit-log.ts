import { Request } from "express";
import AuditLog from "../models/audit-log";
import { logError } from "./logger";

type AuditEventInput = {
  action: string;
  entityType: string;
  entityId?: string;
  hotelId?: string;
  actorId?: string;
  actorRole?: string;
  actorEmail?: string;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
};

const resolveIpAddress = (req?: Request) => {
  if (!req) {
    return undefined;
  }

  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return req.ip;
};

const resolveUserAgent = (req?: Request) => {
  if (!req) {
    return undefined;
  }

  const userAgent = req.get("user-agent");
  return userAgent || undefined;
};

export const recordAuditEvent = async (input: AuditEventInput) => {
  try {
    await AuditLog.create({
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      hotelId: input.hotelId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      actorEmail: input.actorEmail,
      targetUserId: input.targetUserId,
      ipAddress: resolveIpAddress(input.req),
      userAgent: resolveUserAgent(input.req),
      metadata: input.metadata,
    });
  } catch (error) {
    logError("Failed to persist audit event", error, {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      hotelId: input.hotelId,
    });
  }
};