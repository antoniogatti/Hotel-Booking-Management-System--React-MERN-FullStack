import express from "express";
import mongoose from "mongoose";
import verifyToken from "../middleware/auth";
import requireRole from "../middleware/requireRole";
import { logError } from "../lib/logger";
import Hotel from "../models/hotel";
import PnlEntry from "../models/pnl-entry";
import Booking from "../models/booking";
import ExternalCalendarEvent from "../models/external-calendar-event";
import { PnlBookingDetails } from "../models/pnl-booking-details";
import PnlBookingIncome from "../models/pnl-booking-income";
import PnlRecordedIncome from "../models/pnl-recorded-income";
import PnlGridView from "../models/pnl-grid-view";
import User from "../models/user";
import { sendCheckInInvitationEmail } from "../lib/contact-mail";

const router = express.Router();
router.use(verifyToken, requireRole("admin"));

const validYear = (year: string) => /^\d{4}$/.test(year) && Number(year) >= 1900 && Number(year) <= 9998;

const parseGridView = (body: unknown) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["name", "columns", "hiddenGroups", "hiddenColumns", "frozenColumns", "widths", "colorTags", "columnColors", "colorFilter", "columnFilters"].includes(key))) return null;
  const validKeys = (value: unknown, max: number): value is string[] =>
    Array.isArray(value) && value.length <= max &&
    value.every((key) => typeof key === "string" && /^[a-zA-Z][a-zA-Z0-9]{0,49}$/.test(key)) &&
    new Set(value).size === value.length;
  if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 80 ||
      !validKeys(input.columns, 100) || input.columns.length === 0 || !validKeys(input.hiddenGroups, 20) ||
      typeof input.frozenColumns !== "number" || !Number.isSafeInteger(input.frozenColumns) ||
      input.frozenColumns < 0 || input.frozenColumns > input.columns.length ||
      !input.widths || typeof input.widths !== "object" || Array.isArray(input.widths)) return null;
  const widths = input.widths as Record<string, unknown>;
  const columns = input.columns;
  const hiddenColumns = input.hiddenColumns ?? [];
  if (!validKeys(hiddenColumns, 100) || hiddenColumns.some((key) => !columns.includes(key))) return null;
  if (Object.keys(widths).length > 100 || Object.entries(widths).some(([key, value]) =>
    !columns.includes(key) || typeof value !== "number" || !Number.isSafeInteger(value) || value < 90 || value > 600
  )) return null;
  const tags = input.colorTags ?? [];
  if (!Array.isArray(tags) || tags.length > 20 || tags.some((tag) =>
    !tag || typeof tag !== "object" || Array.isArray(tag) ||
    Object.keys(tag).some((key) => !["id", "name", "color"].includes(key)) ||
    typeof tag.id !== "string" || !/^[a-zA-Z0-9-]{1,64}$/.test(tag.id) || tag.id === "uncolored" ||
    typeof tag.name !== "string" || !tag.name.trim() || tag.name.trim().length > 50 ||
    typeof tag.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(tag.color)
  )) return null;
  const colorTags: { id: string; name: string; color: string }[] = tags.map((tag) => ({ id: tag.id, name: tag.name.trim(), color: tag.color.toLowerCase() }));
  if (new Set(colorTags.map((tag) => tag.id)).size !== colorTags.length ||
      new Set(colorTags.map((tag) => tag.name.toLocaleLowerCase())).size !== colorTags.length) return null;
  const colorIds = new Set(colorTags.map((tag) => tag.id));
  const columnColors = input.columnColors ?? {};
  const columnFilters = input.columnFilters ?? {};
  if (typeof columnColors !== "object" || !columnColors || Array.isArray(columnColors) ||
      typeof columnFilters !== "object" || !columnFilters || Array.isArray(columnFilters)) return null;
  if (Object.keys(columnColors).length > 100 || Object.entries(columnColors).some(([key, value]) =>
    !columns.includes(key) || typeof value !== "string" || !colorIds.has(value)
  )) return null;
  if (Object.keys(columnFilters).length > 100 || Object.entries(columnFilters).some(([key, value]) =>
    !columns.includes(key) || typeof value !== "string" || value.length > 1000
  )) return null;
  const colorFilter = input.colorFilter ?? "";
  if (typeof colorFilter !== "string" || (colorFilter !== "" && colorFilter !== "uncolored" && !colorIds.has(colorFilter))) return null;
  return { name: input.name.trim(), columns, hiddenGroups: input.hiddenGroups, hiddenColumns, frozenColumns: input.frozenColumns, widths,
    colorTags, columnColors, colorFilter, columnFilters };
};

const gridViewResponse = (view: { _id: unknown; name: string; columns: string[]; hiddenGroups: string[]; hiddenColumns?: string[]; frozenColumns: number; widths: unknown;
  colorTags?: unknown; columnColors?: unknown; colorFilter?: string; columnFilters?: unknown }) => ({
  id: String(view._id), name: view.name, columns: view.columns, hiddenGroups: view.hiddenGroups, hiddenColumns: view.hiddenColumns ?? [],
  frozenColumns: view.frozenColumns, widths: view.widths, colorTags: view.colorTags ?? [],
  columnColors: view.columnColors ?? {}, colorFilter: view.colorFilter ?? "", columnFilters: view.columnFilters ?? {},
});

router.get("/views", async (req, res) => {
  try {
    const [views, user] = await Promise.all([
      PnlGridView.find({ userId: req.userId }).lean(),
      User.findOne({ _id: req.userId }).select("+pnlDefaultGridView").lean(),
    ]);
    if (!user) return res.status(404).json({ message: "User not found." });
    const defaultView = user.pnlDefaultGridView == null ? null : parseGridView(user.pnlDefaultGridView);
    if (user.pnlDefaultGridView != null && !defaultView) throw new Error("Stored default P&L grid view is invalid.");
    views.sort((a, b) => a.name.localeCompare(b.name));
    return res.json({ views: views.map(gridViewResponse), defaultView });
  } catch (error) {
    logError("Failed to load P&L grid views", error);
    return res.status(500).json({ message: "Unable to load grid views." });
  }
});

router.put("/views/default", async (req, res) => {
  const view = parseGridView(req.body);
  if (!view) return res.status(400).json({ message: "Provide a valid grid view." });
  try {
    const user = await User.findByIdAndUpdate(req.userId, { $set: { pnlDefaultGridView: view } }, { new: true, runValidators: true }).select("_id");
    if (!user) return res.status(404).json({ message: "User not found." });
    return res.json({ defaultView: view });
  } catch (error) {
    logError("Failed to save default P&L grid view", error);
    return res.status(500).json({ message: "Unable to save default grid view." });
  }
});

router.post("/views", async (req, res) => {
  const view = parseGridView(req.body);
  if (!view) return res.status(400).json({ message: "Provide a valid grid view." });
  try {
    const saved = await PnlGridView.create({ ...view, userId: req.userId });
    return res.status(201).json(gridViewResponse(saved));
  } catch (error) {
    logError("Failed to create P&L grid view", error);
    return res.status(500).json({ message: "Unable to save grid view." });
  }
});

router.put("/views/:id", async (req, res) => {
  const view = parseGridView(req.body);
  if (!view || !mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Provide a valid grid view and ID." });
  try {
    const saved = await PnlGridView.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, view, { new: true, runValidators: true });
    if (!saved) return res.status(404).json({ message: "Grid view not found." });
    return res.json(gridViewResponse(saved));
  } catch (error) {
    logError("Failed to update P&L grid view", error);
    return res.status(500).json({ message: "Unable to save grid view." });
  }
});

router.delete("/views/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid grid view ID." });
  try {
    const deleted = await PnlGridView.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ message: "Grid view not found." });
    return res.status(204).end();
  } catch (error) {
    logError("Failed to delete P&L grid view", error);
    return res.status(500).json({ message: "Unable to delete grid view." });
  }
});

const validDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1900 || Number(value.slice(0, 4)) > 9998) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const parseBookingDetails = (body: unknown): PnlBookingDetails | null => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  const fields = ["country", "city", "identifier", "guestDetails", "notes", "guestCount", "grossAmountCents", "netAmountCents", "unitAmountCents", "invoiceRequired", "invoiceCreated", "invoiceNumber", "invoiceDate", "touristTaxCents", "paymentMethod", "paymentStatus", "taxQuarter", "includePossibleOverlap", "excludeFromTotals"];
  if (Object.keys(input).some((key) => !fields.includes(key))) return null;
  const details: PnlBookingDetails = {};
  for (const key of ["country", "city", "identifier", "guestDetails", "notes", "invoiceNumber", "paymentMethod", "taxQuarter"] as const) {
    const value = input[key];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value !== "string" || value.trim().length > (key === "notes" ? 1000 : key === "guestDetails" ? 300 : 100)) return null;
    if (value.trim()) details[key] = value.trim();
  }
  if (input.invoiceDate !== undefined && input.invoiceDate !== null && input.invoiceDate !== "") {
    if (!validDate(input.invoiceDate)) return null;
    details.invoiceDate = input.invoiceDate;
  }
  if (input.paymentStatus !== undefined && input.paymentStatus !== null && input.paymentStatus !== "") {
    if (input.paymentStatus !== "paid" && input.paymentStatus !== "pending" && input.paymentStatus !== "unknown") return null;
    details.paymentStatus = input.paymentStatus;
  }
  for (const key of ["guestCount", "grossAmountCents", "netAmountCents", "unitAmountCents", "touristTaxCents"] as const) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    const min = key === "guestCount" || key === "grossAmountCents" ? 1 : key === "touristTaxCents" ? 0 : -10000000000;
    const max = key === "guestCount" ? 1000 : 10000000000;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) return null;
    details[key] = value;
  }
  for (const key of ["invoiceRequired", "invoiceCreated", "includePossibleOverlap", "excludeFromTotals"] as const) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== "boolean") return null;
    details[key] = value;
  }
  if (details.invoiceCreated !== undefined && details.invoiceRequired !== true) return null;
  if (details.invoiceNumber && details.invoiceRequired === false) return null;
  if (details.invoiceCreated === true && !details.invoiceNumber) return null;
  return details;
};

const moneyFromStoredValue = (value: number | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) && Math.abs(cents) <= 10000000000 ? cents : null;
};

const incomeDetails = (booking: {
  country?: string;
  city?: string;
  adultCount?: number;
  childCount?: number;
  pnlIncome?: PnlBookingDetails;
  checkInInfo?: { paymentDetails?: string };
  excelSync?: {
    country?: string;
    city?: string;
    identifier?: string;
    invoiceNumber?: string;
    paymentVia?: string;
    netPrice?: number;
    unitPrice?: number;
    raw?: Record<string, unknown>;
  };
}, checkIn: string, checkOut: string, isEur: boolean) => {
  const overrides = booking.pnlIncome || {};
  const previous = booking.excelSync;
  const rawDetails = Object.entries(previous?.raw || {}).find(([key]) =>
    key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "") === "eta"
  )?.[1];
  const rawTaxQuarter = Object.entries(previous?.raw || {}).find(([key]) =>
    key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "") === "trimestreimposta"
  )?.[1];
  const days = (Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86400000;
  const nights = Number.isSafeInteger(days) && days > 0 ? days : null;
  const adults = Number.isSafeInteger(booking.adultCount) && (booking.adultCount || 0) > 0 ? booking.adultCount || 0 : 0;
  const children = Number.isSafeInteger(booking.childCount) && (booking.childCount || 0) > 0 ? booking.childCount || 0 : 0;
  const netAmountCents = overrides.netAmountCents ?? (isEur ? moneyFromStoredValue(previous?.netPrice) : null);
  const calculatedUnit = nights && netAmountCents !== null
    ? Math.sign(netAmountCents) * Math.round(Math.abs(netAmountCents) / nights)
    : null;
  return {
    country: overrides.country || booking.country || previous?.country || "",
    city: overrides.city || booking.city || previous?.city || "",
    identifier: overrides.identifier || previous?.identifier || "",
    guestDetails: overrides.guestDetails || (typeof rawDetails === "string" || typeof rawDetails === "number" ? String(rawDetails) : ""),
    notes: overrides.notes || "",
    guestCount: overrides.guestCount ?? (adults + children || null),
    nights,
    netAmountCents,
    unitAmountCents: calculatedUnit,
    invoiceRequired: overrides.invoiceRequired ?? null,
    invoiceCreated: overrides.invoiceRequired === true ? overrides.invoiceCreated ?? null : null,
    invoiceNumber: overrides.invoiceRequired === false ? "" : overrides.invoiceNumber || previous?.invoiceNumber || "",
    invoiceDate: overrides.invoiceDate || "",
    touristTaxCents: overrides.touristTaxCents ?? null,
    paymentMethod: overrides.paymentMethod || booking.checkInInfo?.paymentDetails || previous?.paymentVia || "",
    paymentStatus: overrides.paymentStatus || "unknown",
    taxQuarter: overrides.taxQuarter || (typeof rawTaxQuarter === "string" || typeof rawTaxQuarter === "number" ? String(rawTaxQuarter) : ""),
    overrides,
  };
};

const parseEntry = (body: unknown) => {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  const { type, date, amountCents, category, description, roomId, status } = input;
  if (
    (type !== "income" && type !== "expense") ||
    !validDate(date) ||
    typeof amountCents !== "number" || !Number.isSafeInteger(amountCents) || amountCents < 1 || amountCents > 10000000000 ||
    typeof category !== "string" || !category.trim() || category.trim().length > 80 ||
    typeof description !== "string" || !description.trim() || description.trim().length > 200 ||
    (roomId !== null && (typeof roomId !== "string" || !mongoose.isValidObjectId(roomId))) ||
    (status !== "paid" && status !== "pending" && status !== "unknown")
  ) return null;
  const optional: Record<string, string | number | null> = {};
  for (const key of ["nights", "guestCount", "numberOfNights"] as const) {
    const value = input[key];
    if (value === undefined) continue;
    if (value === null) {
      optional[key] = null;
      continue;
    }
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 10000) return null;
    optional[key] = value;
  }
  for (const key of ["payee", "reference", "invoice", "notes"] as const) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || value.trim().length > (key === "notes" ? 1000 : 200)) return null;
    optional[key] = value.trim();
  }
  return { type, date, amountCents, category: category.trim(), description: description.trim(), roomId, status, ...optional };
};

router.get("/entries", async (req, res) => {
  const year = String(req.query.year || "");
  const type = req.query.type;
  if (!validYear(year) || (type && type !== "income" && type !== "expense")) {
    return res.status(400).json({ message: "Provide a valid year and entry type." });
  }
  try {
    const filter = { date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` }, ...(type ? { type } : {}) };
    const entries = await PnlEntry.find(filter).lean();
    entries.sort((a, b) => b.date.localeCompare(a.date) || String(b._id).localeCompare(String(a._id)));
    return res.json({ entries });
  } catch (error) {
    logError("Failed to load P&L entries", error);
    return res.status(500).json({ message: "Unable to load P&L entries." });
  }
});

router.get("/bookings", async (req, res) => {
  const year = String(req.query.year || "");
  if (!validYear(year)) return res.status(400).json({ message: "Provide a valid year." });
  try {
    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${Number(year) + 1}-01-01T00:00:00.000Z`);
    const [local, imported, recorded] = await Promise.all([
      Booking.find({ checkIn: { $gte: start, $lt: end } })
        .select("_id hotelId reservationNumber firstName lastName email phone adultCount childCount nationality city country checkIn checkOut status totalCost checkInInfo.paymentDetails +pnlIncome excelSync.identifier excelSync.invoiceNumber excelSync.country excelSync.city excelSync.netPrice excelSync.unitPrice excelSync.paymentVia excelSync.raw")
        .lean(),
      ExternalCalendarEvent.find({ source: "booking_com", status: "active", startDate: { $gte: start, $lt: end } })
        .select("_id hotelId externalUid firstName lastName email phone adultCount childCount nationality city country startDate endDate totalCost currency checkInInfo.paymentDetails +pnlIncome excelSync.identifier excelSync.invoiceNumber excelSync.country excelSync.city excelSync.netPrice excelSync.unitPrice excelSync.paymentVia excelSync.raw")
        .lean(),
      PnlRecordedIncome.find({ date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } }).lean(),
    ]);
    const keys = [
      ...local.map((booking) => `local:${String(booking._id)}`),
      ...imported.map((booking) => `booking_com:${String(booking._id)}`),
    ];
    const incomeRecords = keys.length ? await PnlBookingIncome.find({ _id: { $in: keys } }).lean() : [];
    const incomeByBooking = new Map(incomeRecords.map((record) => [record._id, record.details]));
    const amount = (value: number | undefined) => {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
      const cents = Math.round(value * 100);
      return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
    };
    const rows = [
      ...local.map((booking) => {
        const overrides = incomeByBooking.get(`local:${String(booking._id)}`) ?? booking.pnlIncome;
        return {
        id: String(booking._id),
        reference: booking.reservationNumber || String(booking._id),
        source: "local" as const,
        roomId: String(booking.hotelId),
        checkIn: booking.checkIn.toISOString().slice(0, 10),
        checkOut: booking.checkOut.toISOString().slice(0, 10),
        status: booking.status,
        guestName: [booking.firstName, booking.lastName].filter(Boolean).join(" "),
        email: booking.email || "",
        phone: booking.phone || "",
        ...incomeDetails({ ...booking, pnlIncome: overrides }, booking.checkIn.toISOString().slice(0, 10), booking.checkOut.toISOString().slice(0, 10), true),
        nationality: booking.nationality || "",
        adults: booking.adultCount,
        children: booking.childCount,
        amountCents: overrides?.grossAmountCents ?? amount(booking.totalCost),
        currency: "EUR",
        possibleRecordedOverlap: false,
        reason: !["confirmed", "arrived", "completed"].includes(booking.status) ? "Booking is not confirmed" : overrides?.grossAmountCents === undefined && amount(booking.totalCost) === null ? "Amount unavailable" : "",
      }; }),
      ...imported.map((booking) => {
        const overrides = incomeByBooking.get(`booking_com:${String(booking._id)}`) ?? booking.pnlIncome;
        return {
        id: String(booking._id),
        reference: booking.externalUid,
        source: "booking_com" as const,
        roomId: String(booking.hotelId),
        checkIn: booking.startDate.toISOString().slice(0, 10),
        checkOut: booking.endDate.toISOString().slice(0, 10),
        status: "imported",
        guestName: [booking.firstName, booking.lastName].filter(Boolean).join(" "),
        email: booking.email || "",
        phone: booking.phone || "",
        ...incomeDetails({ ...booking, pnlIncome: overrides }, booking.startDate.toISOString().slice(0, 10), booking.endDate.toISOString().slice(0, 10), overrides?.grossAmountCents !== undefined || booking.currency?.toUpperCase() === "EUR"),
        nationality: booking.nationality || "",
        adults: booking.adultCount,
        children: booking.childCount,
        amountCents: overrides?.grossAmountCents ?? amount(booking.totalCost),
        currency: overrides?.grossAmountCents !== undefined ? "EUR" : (booking.currency || "").toUpperCase(),
        possibleRecordedOverlap: false,
        reason: overrides?.grossAmountCents !== undefined ? "" : amount(booking.totalCost) === null ? "Amount unavailable" : booking.currency?.toUpperCase() !== "EUR" ? "Currency is not confirmed as EUR" : "",
      }; }),
    ];
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (row.source === "local" && !["confirmed", "arrived", "completed"].includes(row.status)) continue;
      const key = `${row.roomId}|${row.checkIn}|${row.checkOut}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    for (const row of rows) {
      const key = `${row.roomId}|${row.checkIn}|${row.checkOut}`;
      if ((!row.reason || row.reason === "Amount unavailable" || row.reason === "Currency is not confirmed as EUR") && (counts.get(key) || 0) > 1) {
        row.reason = "Possible duplicate stay";
      }
      row.possibleRecordedOverlap = recorded.some((item) => !item.details.excludeFromTotals && item.date === row.checkIn && (!item.roomId || item.roomId === row.roomId));
      if (!row.reason && row.possibleRecordedOverlap && !row.overrides.includePossibleOverlap) {
        row.reason = "Possible overlap with recorded income";
      }
    }
    const recordedCounts = new Map<string, number>();
    for (const item of recorded) {
      const key = `${item.roomId || ""}|${item.date}`;
      recordedCounts.set(key, (recordedCounts.get(key) || 0) + 1);
    }
    const recordedRows = recorded.map((item) => {
      const checkOut = item.nights
        ? new Date(Date.parse(`${item.date}T00:00:00Z`) + item.nights * 86400000).toISOString().slice(0, 10)
        : "";
      return {
        id: item._id,
        reference: item.reference || "",
        source: "recorded" as const,
        roomId: item.roomId || "",
        roomName: item.roomName || "",
        checkIn: item.date,
        checkOut,
        status: "recorded",
        guestName: item.guestName || "",
        email: item.email || "",
        phone: item.phone || "",
        ...incomeDetails({ pnlIncome: item.details }, item.date, checkOut, true),
        nationality: "",
        amountCents: item.details.grossAmountCents ?? null,
        currency: "EUR",
        possibleRecordedOverlap: false,
        possibleRepeatedRecord: (recordedCounts.get(`${item.roomId || ""}|${item.date}`) || 0) > 1,
        reason: item.details.excludeFromTotals ? "Excluded by administrator" : item.details.grossAmountCents == null ? "Amount unavailable" : "",
      };
    });
    const allRows = [...rows, ...recordedRows];
    allRows.sort((a, b) => b.checkIn.localeCompare(a.checkIn) || a.reference.localeCompare(b.reference));
    return res.json({ bookings: allRows });
  } catch (error) {
    logError("Failed to load P&L bookings", error);
    return res.status(500).json({ message: "Unable to load P&L bookings." });
  }
});

router.post("/check-in-invitations", async (req, res) => {
  const input = req.body as Record<string, unknown> | null;
  const selfDetails = input && input.mode === "self" && typeof input.accessCode === "string" &&
    /^[a-zA-Z0-9_-]{1,80}$/.test(input.accessCode) && typeof input.locker === "string" &&
    /^(\d{1,2})?$/.test(input.locker) && typeof input.breakfastIncluded === "boolean"
    ? { accessCode: input.accessCode, locker: input.locker, breakfastIncluded: input.breakfastIncluded } : null;
  if (!input || (input.source !== "local" && input.source !== "booking_com") ||
      typeof input.id !== "string" || !mongoose.isValidObjectId(input.id) ||
      typeof input.expectedEmail !== "string" || input.expectedEmail.length > 254 ||
      (input.mode !== "desk" && input.mode !== "self") ||
      (input.mode === "self" && !selfDetails)) {
    return res.status(400).json({ message: "Provide valid booking and check-in details." });
  }
  try {
    const booking = input.source === "local"
      ? await Booking.findById(input.id).lean()
      : await ExternalCalendarEvent.findOne({ _id: input.id, source: "booking_com" }).lean();
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if ((input.source === "local" && booking.status !== "confirmed") ||
        (input.source === "booking_com" && booking.status !== "active")) {
      return res.status(400).json({ message: "Only confirmed or active bookings can receive check-in invitations." });
    }
    const email = String(booking.email || "").trim();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "This booking needs a valid guest email address." });
    }
    if (email.toLocaleLowerCase() !== input.expectedEmail.trim().toLocaleLowerCase()) {
      return res.status(409).json({ message: "The guest email changed. Reopen the editor and review it before sending." });
    }
    const reference = "reservationNumber" in booking ? booking.reservationNumber : booking.externalUid;
    const checkIn = "checkIn" in booking ? booking.checkIn : booking.startDate;
    await sendCheckInInvitationEmail({
      email, guestName: [booking.firstName, booking.lastName].filter(Boolean).join(" "),
      reference: reference || input.id, checkIn: checkIn.toISOString(),
      mode: input.mode,
      ...(selfDetails || {}),
    });
    return res.json({ message: "Check-in invitation accepted for sending." });
  } catch (error) {
    logError("Failed to send check-in invitation", new Error(error instanceof Error ? error.name : "Unknown error"), { route: "pnl.check-in-invitation", bookingId: input.id });
    return res.status(500).json({ message: "Could not confirm delivery. Check sent mail before retrying." });
  }
});

router.put("/bookings/:source/:id", async (req, res) => {
  if (req.params.source === "recorded") {
    const input = req.body as Record<string, unknown> | null;
    const details = parseBookingDetails(input?.details);
    const identityFields = ["reference", "guestName", "phone", "email", "roomId", "roomName"] as const;
    if (!input || !details || !/^[a-f0-9]{64}$/.test(req.params.id) || details.grossAmountCents === undefined ||
        identityFields.some((key) => typeof input[key] !== "string" || (input[key] as string).length > 200) ||
        !validDate(input.date) ||
        (input.nights !== null && (typeof input.nights !== "number" || !Number.isSafeInteger(input.nights) || input.nights < 1 || input.nights > 10000)) ||
        (input.roomId !== "" && !mongoose.isValidObjectId(input.roomId))) {
      return res.status(400).json({ message: "Provide valid recorded income details and amount." });
    }
    try {
      if (input.roomId && !(await Hotel.exists({ _id: input.roomId }))) {
        return res.status(400).json({ message: "Selected room does not exist." });
      }
      const identity = Object.fromEntries(identityFields.map((key) => [key, (input[key] as string).trim()]));
      const saved = await PnlRecordedIncome.findByIdAndUpdate(
        req.params.id, { $set: { ...identity, date: input.date, nights: input.nights, details, updatedBy: req.userId } }, { new: true, runValidators: true }
      );
      if (!saved) return res.status(404).json({ message: "Recorded income not found." });
      return res.json({ message: "Income details saved." });
    } catch (error) {
      logError("Failed to save recorded income details", error);
      return res.status(500).json({ message: "Unable to save recorded income details." });
    }
  }
  const details = parseBookingDetails(req.body);
  if (!details || !mongoose.isValidObjectId(req.params.id) || !["local", "booking_com"].includes(req.params.source)) {
    return res.status(400).json({ message: "Provide valid booking income details." });
  }
  try {
    const exists = req.params.source === "local"
      ? await Booking.exists({ _id: req.params.id })
      : await ExternalCalendarEvent.exists({ _id: req.params.id, source: "booking_com" });
    if (!exists) return res.status(404).json({ message: "Booking not found." });
    await PnlBookingIncome.findByIdAndUpdate(
      `${req.params.source}:${req.params.id}`,
      { $set: { source: req.params.source, bookingId: req.params.id, details, updatedBy: req.userId } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.json({ message: "Booking income details saved." });
  } catch (error) {
    logError("Failed to save booking income details", error);
    return res.status(500).json({ message: "Unable to save booking income details." });
  }
});

router.post("/entries", async (req, res) => {
  const entry = parseEntry(req.body);
  if (!entry) return res.status(400).json({ message: "Provide a valid date, amount, description, category, room and status." });
  try {
    if (entry.roomId && !(await Hotel.exists({ _id: entry.roomId }))) {
      return res.status(400).json({ message: "Selected room does not exist." });
    }
    const saved = await PnlEntry.create({ ...entry, createdBy: req.userId });
    return res.status(201).json(saved);
  } catch (error) {
    logError("Failed to create P&L entry", error);
    return res.status(500).json({ message: "Unable to save P&L entry." });
  }
});

router.put("/entries/:id", async (req, res) => {
  const entry = parseEntry(req.body);
  if (!mongoose.isValidObjectId(req.params.id) || !entry) {
    return res.status(400).json({ message: "Provide a valid entry and entry ID." });
  }
  try {
    if (entry.roomId && !(await Hotel.exists({ _id: entry.roomId }))) {
      return res.status(400).json({ message: "Selected room does not exist." });
    }
    const saved = await PnlEntry.findByIdAndUpdate(req.params.id, entry, { new: true, runValidators: true });
    if (!saved) return res.status(404).json({ message: "P&L entry not found." });
    return res.json(saved);
  } catch (error) {
    logError("Failed to update P&L entry", error);
    return res.status(500).json({ message: "Unable to update P&L entry." });
  }
});

router.delete("/entries/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid entry ID." });
  try {
    const deleted = await PnlEntry.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "P&L entry not found." });
    return res.status(204).end();
  } catch (error) {
    logError("Failed to delete P&L entry", error);
    return res.status(500).json({ message: "Unable to delete P&L entry." });
  }
});

export default router;
