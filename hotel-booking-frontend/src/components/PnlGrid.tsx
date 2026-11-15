import { KeyboardEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "react-query";
import * as api from "../api-client";
import { moneyToCents, signedMoneyToCents, stayNights, validYear } from "../pages/pnl-utils";
import { Button } from "./ui/button";
import { PnlBookingMatches, possibleBookingMatches } from "./PnlBookingMatches";
import PnlGridViews, { moveGridColumn } from "./PnlGridViews";
import PnlCheckInActions from "./PnlCheckInActions";
import { GripVertical } from "lucide-react";

type Room = { _id: string; name: string };
type Values = Record<string, string>;
type Sheet = "income" | "additional" | "expense";
type GridRow = {
  key: string;
  sheet: Sheet;
  booking?: api.PnlBooking;
  entry?: api.PnlEntry;
  values: Values;
  saved: Values;
  error?: string;
  saving?: Promise<void>;
  queued?: boolean;
};
type Column = {
  key: string;
  label: string;
  width?: number;
  kind?: "date" | "money" | "number" | "room" | "payment" | "boolean" | "invoiceStatus";
  readOnly?: boolean;
  recordedOnly?: boolean;
  overlapOnly?: boolean;
};

const incomeColumns: Column[] = [
  { key: "notes", label: "Notes", width: 220 },
  { key: "roomId", label: "Room", width: 180, kind: "room", recordedOnly: true },
  { key: "date", label: "Check-in", kind: "date", recordedOnly: true },
  { key: "checkOut", label: "Check-out", kind: "date", recordedOnly: true },
  { key: "guestName", label: "Guest", width: 180, recordedOnly: true },
  { key: "reference", label: "Reference", width: 160, recordedOnly: true },
  { key: "source", label: "Source", readOnly: true },
  { key: "grossAmountCents", label: "Booking value (€)", kind: "money" },
  { key: "nights", label: "Nights", kind: "number", readOnly: true, width: 100 },
  { key: "guestCount", label: "Pax", kind: "number", width: 100 },
  { key: "identifier", label: "Guest ID" },
  { key: "guestDetails", label: "Guest ages / details", width: 180 },
  { key: "country", label: "Country" },
  { key: "city", label: "City" },
  { key: "phone", label: "Phone", width: 150, recordedOnly: true },
  { key: "email", label: "Email", width: 200, recordedOnly: true },
  { key: "invoiceDate", label: "Invoice date", kind: "date" },
  { key: "invoiceNumber", label: "Invoice number" },
  { key: "invoiceRequired", label: "Invoice required", kind: "boolean" },
  { key: "invoiceCreated", label: "Invoice status", kind: "invoiceStatus" },
  { key: "unit", label: "Unit price (€)", readOnly: true },
  { key: "netAmountCents", label: "Before tourist tax (€)", kind: "money", width: 175 },
  { key: "touristTaxCents", label: "Tourist tax (€)", kind: "money" },
  { key: "month", label: "Month", readOnly: true, width: 95 },
  { key: "taxQuarter", label: "Tax quarter" },
  { key: "paymentMethod", label: "Payment method" },
  { key: "paymentStatus", label: "Payment status", kind: "payment" },
  { key: "sourceAmount", label: "Original non-EUR value", readOnly: true },
  { key: "possibleBookings", label: "Possible bookings", width: 260, readOnly: true },
  { key: "status", label: "Inclusion / status", width: 220, readOnly: true },
  { key: "includePossibleOverlap", label: "Include booking overlap", kind: "boolean", overlapOnly: true },
  { key: "excludeFromTotals", label: "Exclude recorded income", kind: "boolean", recordedOnly: true },
];
const incomeGroups = [
  { id: "stayV2", label: "01 Stay" },
  { id: "registrationV2", label: "02 Registration" },
  { id: "invoicingV2", label: "03 Invoicing" },
  { id: "reviewV2", label: "04 Payment & review" },
];
const groupKeys: Record<string, string[]> = {
  stayV2: ["roomId", "date", "checkOut", "guestName", "reference", "source", "grossAmountCents", "nights", "guestCount"],
  registrationV2: ["identifier", "guestDetails", "country", "city", "phone", "email"],
  invoicingV2: ["invoiceDate", "invoiceNumber", "invoiceRequired", "invoiceCreated", "unit", "netAmountCents", "touristTaxCents", "month", "taxQuarter"],
  reviewV2: ["notes", "paymentMethod", "paymentStatus", "sourceAmount", "possibleBookings", "status", "includePossibleOverlap", "excludeFromTotals"],
};
const incomeViewColumns = incomeColumns.map((column) => ({
  key: column.key, label: column.label,
  group: incomeGroups.find((group) => groupKeys[group.id].includes(column.key))!.id,
}));
const defaultIncomeLayout: api.PnlGridLayout = {
  columns: incomeColumns.map((column) => column.key), hiddenGroups: [], hiddenColumns: [], frozenColumns: 5, widths: {},
  colorTags: [], columnColors: {}, colorFilter: "", columnFilters: {},
};
const tint = (hex: string, strength: number, base = 255) => {
  const channels = [1, 3, 5].map((index) => Math.round(base * (1 - strength) + parseInt(hex.slice(index, index + 2), 16) * strength));
  return `rgb(${channels.join(", ")})`;
};
const entryColumns: Column[] = [
  { key: "description", label: "Description", width: 210 },
  { key: "date", label: "Date", kind: "date" },
  { key: "month", label: "Month", readOnly: true, width: 95 },
  { key: "category", label: "Category" },
  { key: "roomId", label: "Room", kind: "room", width: 180 },
  { key: "nights", label: "Nights", kind: "number", width: 100 },
  { key: "guestCount", label: "Guests", kind: "number", width: 100 },
  { key: "payee", label: "Payee" },
  { key: "reference", label: "Reference" },
  { key: "invoice", label: "Invoice" },
  { key: "notes", label: "Notes", width: 220 },
  { key: "numberOfNights", label: "Number of nights", kind: "number" },
  { key: "status", label: "Payment status", kind: "payment" },
  { key: "amountCents", label: "Amount (€)", kind: "money" },
];
const additionalColumns = entryColumns.filter((column) =>
  ["description", "date", "month", "category", "roomId", "status", "amountCents"].includes(column.key)
);
const stringNumber = (value: number | null | undefined) => value == null ? "" : String(value);
const money = (value: number | null | undefined) => value == null ? "" : (value / 100).toFixed(2);
const booleanValue = (value: boolean | null | undefined) => value == null ? "" : value ? "yes" : "no";
const rowDirty = (row: GridRow) => Object.keys(row.values).some((key) => row.values[key] !== row.saved[key]);
const rowLabel = (row: GridRow) => row.values.guestName || row.values.description || row.values.reference || "Income";

function makeBookingRow(booking: api.PnlBooking): GridRow {
  const values: Values = {
    reference: booking.reference, guestName: booking.guestName, phone: booking.phone, email: booking.email,
    roomId: booking.roomId, date: booking.checkIn, checkOut: booking.checkOut || "",
    country: booking.country, identifier: booking.identifier, city: booking.city,
    guestCount: stringNumber(booking.guestCount),
    grossAmountCents: booking.currency === "EUR" ? money(booking.amountCents) : "",
    netAmountCents: money(booking.netAmountCents), guestDetails: booking.guestDetails, notes: booking.notes || "",
    paymentMethod: booking.paymentMethod, paymentStatus: booking.paymentStatus || "unknown", taxQuarter: booking.taxQuarter,
    invoiceDate: booking.invoiceDate || "", touristTaxCents: money(booking.touristTaxCents),
    invoiceNumber: booking.invoiceNumber, invoiceRequired: booleanValue(booking.invoiceRequired),
    invoiceCreated: booleanValue(booking.invoiceCreated),
    includePossibleOverlap: booleanValue(booking.overrides?.includePossibleOverlap),
    excludeFromTotals: booleanValue(booking.overrides?.excludeFromTotals),
  };
  return { key: `${booking.source}:${booking.id}`, sheet: "income", booking, values, saved: { ...values } };
}

function makeEntryRow(entry: api.PnlEntry): GridRow {
  const values: Values = {
    description: entry.description, date: entry.date, category: entry.category, roomId: entry.roomId || "",
    nights: stringNumber(entry.nights), guestCount: stringNumber(entry.guestCount),
    payee: entry.payee || "", reference: entry.reference || "", invoice: entry.invoice || "",
    notes: entry.notes || "", numberOfNights: stringNumber(entry.numberOfNights),
    status: entry.status, amountCents: money(entry.amountCents),
  };
  return { key: `entry:${entry._id}`, sheet: entry.type === "income" ? "additional" : "expense", entry, values, saved: { ...values } };
}

function count(value: string, label: string, min: number, max: number): number | undefined {
  if (!value.trim()) return undefined;
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(`${label} must be a whole number between ${min} and ${max}.`);
  }
  return number;
}

function checkedDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !validYear(value.slice(0, 4)) ||
      Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("Enter a valid date.");
  }
  return value;
}

function buildSave(row: GridRow, values: Values, rooms: Room[]) {
  const changed = (key: string) => values[key] !== row.saved[key];
  if (row.entry) {
    const entry = { ...row.entry };
    const amount = moneyToCents(values.amountCents);
    if (amount === null) throw new Error("Amount must be positive with at most two decimal places.");
    if (!values.description.trim() || values.description.trim().length > 200 ||
        !values.category.trim() || values.category.trim().length > 80) {
      throw new Error("Description and category are required (maximum 200 and 80 characters).");
    }
    if (["payee", "reference", "invoice"].some((key) => values[key].trim().length > 200) || values.notes.trim().length > 1000) {
      throw new Error("A text value is too long.");
    }
    return { entry: {
      ...entry, date: checkedDate(values.date), amountCents: amount,
      description: values.description.trim(), category: values.category.trim(), roomId: values.roomId || null,
      status: values.status as api.PnlEntryInput["status"],
      nights: count(values.nights, "Nights", 0, 10000) ?? null,
      guestCount: count(values.guestCount, "Guests", 0, 10000) ?? null,
      numberOfNights: count(values.numberOfNights, "Number of nights", 0, 10000) ?? null,
      payee: values.payee.trim(), reference: values.reference.trim(), invoice: values.invoice.trim(), notes: values.notes.trim(),
    } };
  }
  const booking = row.booking!;
  const details = { ...booking.overrides };
  const textFields = ["country", "identifier", "city", "guestDetails", "notes", "paymentMethod", "taxQuarter", "invoiceNumber"] as const;
  for (const key of textFields) {
    if (!changed(key)) continue;
    const value = values[key].trim();
    if (value.length > (key === "notes" ? 1000 : key === "guestDetails" ? 300 : 100)) throw new Error(`${key} is too long.`);
    details[key] = value || undefined;
  }
  if (changed("guestCount")) details.guestCount = count(values.guestCount, "Pax", 1, 1000);
  if (changed("invoiceDate")) details.invoiceDate = values.invoiceDate ? checkedDate(values.invoiceDate) : undefined;
  if (changed("paymentStatus")) {
    const status = values.paymentStatus;
    if (status !== "paid" && status !== "pending" && status !== "unknown") throw new Error("Select a valid payment status.");
    details.paymentStatus = status;
  }
  if (changed("touristTaxCents")) {
    const value = values.touristTaxCents.trim();
    const amount = value ? signedMoneyToCents(value) : undefined;
    if (amount === null || (amount !== undefined && amount < 0)) throw new Error("Tourist tax must be zero or a positive amount with at most two decimal places.");
    details.touristTaxCents = amount;
  }
  if (changed("grossAmountCents")) {
    const value = values.grossAmountCents.trim();
    const amount = value ? moneyToCents(value) : undefined;
    if (amount === null || (booking.source === "recorded" && amount === undefined)) throw new Error("Booking value must be positive with at most two decimal places.");
    details.grossAmountCents = amount;
  }
  if (changed("netAmountCents")) {
    const value = values.netAmountCents.trim();
    const amount = value ? signedMoneyToCents(value) : undefined;
    if (amount === null) throw new Error("Enter a valid amount before tourist tax.");
    details.netAmountCents = amount;
  }
  if (changed("invoiceRequired")) details.invoiceRequired = values.invoiceRequired ? values.invoiceRequired === "yes" : undefined;
  if (changed("invoiceCreated")) details.invoiceCreated = values.invoiceCreated ? values.invoiceCreated === "yes" : undefined;
  if (changed("includePossibleOverlap")) details.includePossibleOverlap = values.includePossibleOverlap ? values.includePossibleOverlap === "yes" : undefined;
  if (changed("excludeFromTotals")) details.excludeFromTotals = values.excludeFromTotals ? values.excludeFromTotals === "yes" : undefined;
  if (details.invoiceCreated !== undefined && details.invoiceRequired !== true) throw new Error("Set invoice required to Yes before setting its status.");
  if (details.invoiceNumber && details.invoiceRequired === false) throw new Error("Clear the invoice number before selecting No.");
  if (details.invoiceCreated === true && !details.invoiceNumber) throw new Error("Enter an invoice number before marking it created.");
  if (booking.source !== "recorded") return { booking, details };
  if (["reference", "guestName", "phone", "email"].some((key) => values[key].trim().length > 200)) {
    throw new Error("A text value exceeds 200 characters.");
  }
  const date = checkedDate(values.date);
  const nights = stayNights(date, values.checkOut);
  if (values.checkOut && (nights === null || nights > 10000)) throw new Error("Check-out must be after check-in (maximum 10,000 nights).");
  const identity: api.PnlRecordedIdentity = {
    reference: values.reference.trim(), guestName: values.guestName.trim(), phone: values.phone.trim(),
    email: values.email.trim(), roomId: values.roomId,
    roomName: values.roomId === booking.roomId ? booking.roomName || "" : rooms.find((room) => room._id === values.roomId)?.name || "",
    date, nights,
  };
  return { booking, details, identity };
}

function display(row: GridRow, column: Column, rooms: Room[], bookings: api.PnlBooking[] = []): string {
  if (column.key === "month") return row.values.date ? row.values.date.slice(0, 7) : "";
  if (column.key === "source") return row.booking?.source === "local" ? "Site" : row.booking?.source === "booking_com" ? "Booking.com" : "Recorded income";
  if (column.key === "nights" && row.booking) return stringNumber(stayNights(row.values.date, row.values.checkOut));
  if (column.key === "sourceAmount") return row.booking && row.booking.currency !== "EUR" && row.booking.amountCents != null
    ? `${money(row.booking.amountCents)} ${row.booking.currency || "(currency unknown)"}` : "";
  if (column.key === "unit") {
    const net = signedMoneyToCents(row.values.netAmountCents);
    const nights = stayNights(row.values.date, row.values.checkOut);
    return net !== null && nights !== null
      ? money(Math.sign(net) * Math.round(Math.abs(net) / nights)) : "";
  }
  if (column.key === "checkOut") {
    return row.values.checkOut || "";
  }
  if (column.key === "possibleBookings" && row.booking?.source === "recorded") {
    return possibleBookingMatches({ source: row.booking.source, reference: row.values.reference, roomId: row.values.roomId,
      checkIn: row.values.date, checkOut: display(row, { key: "checkOut", label: "Check-out" }, rooms) }, bookings)
      .map(({ booking, evidence }) => [booking.reference, booking.guestName, ...evidence].join(" ")).join(" ");
  }
  if (column.key === "status" && row.booking) {
    const booking = row.booking;
    return [booking.status, booking.reason ? `${booking.reason} — excluded` : "", booking.possibleRepeatedRecord ? "Same room/date — review" : "", booking.possibleRecordedOverlap && booking.overrides.includePossibleOverlap ? "Overlap — manually included" : ""].filter(Boolean).join(" · ");
  }
  if (column.kind === "room") return rooms.find((room) => room._id === row.values.roomId)?.name || row.booking?.roomName || (row.values.roomId ? "Removed room" : "Unassigned");
  return row.values[column.key] || "";
}

const PAGE_SIZE = 50;

export default function PnlGrid({ type, year, bookings, entries, rooms, onClose }: {
  type: "income" | "expense"; year: string; bookings: api.PnlBooking[]; entries: api.PnlEntry[]; rooms: Room[]; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [sheet, setSheet] = useState<Sheet>(type === "income" ? "income" : "expense");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [incomeLayout, setIncomeLayout] = useState<api.PnlGridLayout>(defaultIncomeLayout);
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(() => new Set());
  const [checkInBusy, setCheckInBusy] = useState(false);
  const checkInBusyRef = useRef(false);
  const [filterRevision, setFilterRevision] = useState(0);
  const layoutDirtyRef = useRef(false);
  layoutDirtyRef.current = layoutDirty;
  const [, redraw] = useState(0);
  const [message, setMessage] = useState("");
  const rows = useRef<GridRow[]>([...bookings.map(makeBookingRow), ...entries.map(makeEntryRow)]);
  const drag = useRef<{ key: string; x: number; width: number } | null>(null);
  const draggedColumn = useRef<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const refresh = () => { if (alive.current) redraw((value) => value + 1); };
  const isUnsaved = () => rows.current.some((row) => rowDirty(row) || row.saving);
  useEffect(() => {
    alive.current = true;
    dialog.current?.focus();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (isUnsaved() || layoutDirtyRef.current || checkInBusyRef.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { alive.current = false; window.removeEventListener("beforeunload", beforeUnload); };
  }, []);

  const saveRow = async (row: GridRow): Promise<void> => {
    if (row.saving) {
      row.queued = true;
      await row.saving;
      return;
    }
    if (!rowDirty(row)) return;
    const values = { ...row.values };
    let payload: ReturnType<typeof buildSave>;
    try {
      payload = buildSave(row, values, rooms);
    } catch (error) {
      row.error = error instanceof Error ? error.message : "Invalid values.";
      refresh();
      return;
    }
    row.error = undefined;
    row.saving = (async () => {
      try {
        if (payload.entry) {
          const saved = await api.savePnlEntry(payload.entry, row.entry!._id);
          row.entry = saved;
        } else if (payload.booking && payload.details) {
          await api.savePnlBookingDetails(payload.booking, payload.details, payload.identity);
          row.booking = { ...payload.booking, ...payload.identity, overrides: payload.details };
        }
        row.saved = values;
        if (row.sheet === "income") setFilterRevision((previous) => previous + 1);
      } catch {
        row.error = "Save failed. Your changes are still here; retry with Save all.";
      }
    })();
    refresh();
    await row.saving;
    row.saving = undefined;
    const queued = row.queued;
    row.queued = false;
    refresh();
    if (queued && !row.error && rowDirty(row)) await saveRow(row);
  };

  const saveAll = async () => {
    setMessage("");
    await Promise.all(rows.current.map((row) => saveRow(row)));
    if (rows.current.some((row) => rowDirty(row) || row.saving)) {
      setMessage("Some changes could not be saved. Check highlighted rows and retry.");
    } else {
      setMessage("All changes saved.");
    }
  };
  const close = async () => {
    if (checkInBusy) return;
    await Promise.all(rows.current.filter((row) => row.saving).map((row) => row.saving));
    if (isUnsaved()) {
      setMessage("You have unsaved changes. Fix errors and save, or discard them before closing.");
      return;
    }
    if (layoutDirty && !window.confirm("Close without saving view changes?")) return;
    await Promise.all([queryClient.invalidateQueries("pnl-entries"), queryClient.invalidateQueries("pnl-bookings")]);
    onClose();
  };
  const discard = async () => {
    if (rows.current.some((row) => row.saving)) return;
    if (!window.confirm("Discard all unsaved changes? Already saved changes will remain.")) return;
    for (const row of rows.current) { row.values = { ...row.saved }; row.error = undefined; }
    refresh();
    setMessage("Unsaved changes discarded.");
  };
  const orderedIncomeColumns = useMemo(() => incomeLayout.columns.flatMap((key) => {
    const column = incomeColumns.find((item) => item.key === key);
    return column ? [column] : [];
  }), [incomeLayout.columns]);
  const columns = useMemo(() => sheet === "income" ? orderedIncomeColumns.filter((column) => {
    const color = incomeLayout.columnColors[column.key];
    return !incomeLayout.hiddenColumns.includes(column.key) && !incomeLayout.hiddenGroups.includes(incomeViewColumns.find((item) => item.key === column.key)!.group) &&
      (!incomeLayout.colorFilter || (incomeLayout.colorFilter === "uncolored" ? !color : color === incomeLayout.colorFilter));
  }) : sheet === "expense" ? entryColumns : additionalColumns,
  [sheet, orderedIncomeColumns, incomeLayout.hiddenGroups, incomeLayout.hiddenColumns, incomeLayout.colorFilter, incomeLayout.columnColors]);
  const columnValues = useMemo(() => {
    if (sheet !== "income") return new Map<string, string[]>();
    return new Map(incomeColumns.map((column) => [
      column.key,
      [...new Set(rows.current.filter((row) => row.sheet === "income").map((row) => display(row, column, rooms, bookings)))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })),
    ]));
  }, [sheet, rooms, bookings, filterRevision]);
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const searchColumns = sheet === "income" ? orderedIncomeColumns : columns;
    const result = rows.current.filter((row) => row.sheet === sheet && (!term || searchColumns.some((column) =>
      display(row, column, rooms, bookings).toLocaleLowerCase().includes(term))) &&
      (sheet !== "income" || Object.entries(incomeLayout.columnFilters).every(([key, value]) => {
        const column = incomeColumns.find((item) => item.key === key);
        return column && display(row, column, rooms, bookings) === value;
      })));
    if (sort) {
      const column = searchColumns.find((item) => item.key === sort.key);
      if (column) result.sort((a, b) => {
        const left = display(a, column, rooms, bookings);
        const right = display(b, column, rooms, bookings);
        if (!left || !right) return !left && !right ? 0 : !left ? 1 : -1;
        const numeric = column.kind === "money" || column.kind === "number" || column.key === "unit";
        const comparison = numeric ? Number(left.replace(",", ".")) - Number(right.replace(",", ".")) : left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
        return (Number.isNaN(comparison) ? left.localeCompare(right) : comparison) * (sort.desc ? -1 : 1);
      });
    }
    return result;
    // Row edits are deliberately not re-sorted while typing.
  }, [sheet, search, sort, rooms, columns, orderedIncomeColumns, bookings, incomeLayout.columnFilters, filterRevision]);
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selectable = visible.filter((row) => row.booking && row.booking.source !== "recorded");
  const selected = rows.current.flatMap((row) => row.booking && selectedBookings.has(row.key) ? [row.booking] : []);
  const selectRow = (key: string, checked: boolean) => setSelectedBookings((previous) => {
    const next = new Set(previous);
    if (checked) next.add(key); else next.delete(key);
    return next;
  });
  const dirtyCount = rows.current.filter(rowDirty).length;
  const savingCount = rows.current.filter((row) => row.saving).length;
  const errorCount = rows.current.filter((row) => row.error).length;
  const resize = (key: string, value: number) => {
    const size = Math.max(90, Math.min(600, Math.round(value)));
    if (sheet === "income") setIncomeLayout((previous) => ({ ...previous, widths: { ...previous.widths, [key]: size } }));
    else setWidths((previous) => ({ ...previous, [key]: size }));
  };
  const width = (column: Column) => (sheet === "income" ? incomeLayout.widths : widths)[column.key] ?? column.width ?? 145;
  const pinnedOffset = (index: number) => sheet === "income" && index < incomeLayout.frozenColumns
    ? 48 + columns.slice(0, index).reduce((total, column) => total + width(column), 0)
    : undefined;
  const moveResize = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) resize(drag.current.key, drag.current.width + event.clientX - drag.current.x);
  };
  const keyboardResize = (event: KeyboardEvent<HTMLDivElement>, column: Column) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      resize(column.key, width(column) + (event.key === "ArrowRight" ? 16 : -16));
    }
  };
  const change = (row: GridRow, key: string, value: string) => {
    row.values = { ...row.values, [key]: value };
    row.error = undefined;
    setMessage("");
    refresh();
  };
  const enterCell = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    const cell = event.currentTarget.closest("td");
    let next = cell?.parentElement?.nextElementSibling;
    while (cell && next) {
      const target = next.children[cell.cellIndex]?.querySelector<HTMLElement>("input, select, textarea");
      if (target) { target.focus(); return; }
      next = next.nextElementSibling;
    }
    event.currentTarget.blur();
  };

  return (
    <div ref={dialog} role="dialog" aria-modal="true" aria-label={`${type === "income" ? "Income" : "Expenses"} full-screen editor`} tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== "Tab" || !event.currentTarget.contains(event.target as Node)) return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [role='separator'][tabindex='0'], [role='region'][tabindex='0']"));
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      className="fixed inset-0 z-[100] flex flex-col bg-slate-100 text-slate-900">
      <header className="max-h-[60vh] shrink-0 overflow-y-auto border-b border-slate-300 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-semibold">{type === "income" ? "Income" : "Expenses"} editor <span className="text-slate-500">{year}</span></h2>
            <p className="text-xs text-slate-600">Changes save when you leave a cell. Tab moves across; Enter moves down. Shift+Enter adds a line in text cells. Booking identity and calculated cells are read-only. Booking suggestions need review and do not link records or change totals. Inclusion warnings refresh when you reopen the editor.</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <span aria-live="polite" className={`flex h-10 w-44 items-center text-sm ${errorCount ? "text-rose-700" : "text-slate-600"}`}>{savingCount ? `Saving ${savingCount}…` : errorCount ? `${errorCount} row(s) need attention` : dirtyCount ? `${dirtyCount} unsaved row(s)` : "All changes saved"}</span>
            <Button size="sm" onClick={() => void saveAll()}>Save all</Button>
            <Button size="sm" variant="outline" onClick={() => void discard()} disabled={!dirtyCount || !!savingCount}>Discard unsaved</Button>
            <Button size="sm" variant="outline" disabled={checkInBusy} onClick={() => void close()}>Close editor</Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {type === "income" && <div role="group" aria-label="Income sheets" className="flex gap-1">
            {([["income", "Booking income"], ["additional", "Additional income"]] as const).map(([key, label]) =>
              <button key={key} type="button" disabled={checkInBusy} aria-pressed={sheet === key} onClick={() => { setSheet(key); setPage(0); setSort(null); }} className={`rounded-md px-3 py-1.5 text-sm font-medium ${sheet === key ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700"}`}>{label}</button>)}
          </div>}
          <label className="text-sm">Search <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} className="ml-1 rounded border border-slate-300 px-2 py-1" placeholder="Search this sheet" /></label>
          {sheet === "income" && <button type="button" aria-pressed={showFilters} onClick={() => setShowFilters((value) => !value)} className="rounded border border-slate-300 px-2 py-1 text-sm">{showFilters ? "Hide value filters" : "Show value filters"}</button>}
          {sheet === "income" && <><PnlCheckInActions bookings={selected} onSent={(key) => selectRow(key, false)} onBusyChange={(busy) => { checkInBusyRef.current = busy; setCheckInBusy(busy); }} />
            {selected.length > 0 && <button type="button" disabled={checkInBusy} onClick={() => setSelectedBookings(new Set())} className="text-sm text-teal-700 underline">Clear selection</button>}</>}
          <span className="text-sm text-slate-600">{filtered.length} rows</span>
          <div className="ml-auto flex items-center gap-2 text-sm"><button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded border px-2 py-1 disabled:opacity-40">Previous</button><span>Page {page + 1} of {Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}</span><button disabled={(page + 1) * PAGE_SIZE >= filtered.length} onClick={() => setPage(page + 1)} className="rounded border px-2 py-1 disabled:opacity-40">Next</button></div>
        </div>
        {type === "income" && <div hidden={sheet !== "income"}><PnlGridViews layout={incomeLayout} defaultLayout={defaultIncomeLayout} columns={incomeViewColumns} groups={incomeGroups} onChange={setIncomeLayout} onDirtyChange={setLayoutDirty} />
          <p className="mt-1 text-xs text-slate-600">Check-in actions are available for site and Booking.com bookings; recorded income is not linked to a booking.</p></div>}
        {message && <p role={errorCount || dirtyCount ? "alert" : "status"} className="mt-2 text-sm text-rose-700">{message}</p>}
      </header>
      <div role="region" aria-label="Editable grid" tabIndex={0} className="min-h-0 flex-1 overflow-auto">
        <table className="table-fixed border-separate border-spacing-0 text-left text-sm" aria-label={`${sheet === "income" ? "Booking income" : sheet === "expense" ? "Expenses" : "Additional income"} grid`} style={{ width: (sheet === "income" ? 48 : 90) + columns.reduce((total, column) => total + width(column), 0) }}>
          <colgroup><col style={{ width: sheet === "income" ? 48 : 90 }} />{columns.map((column) => <col key={column.key} style={{ width: width(column) }} />)}</colgroup>
          <thead className="sticky top-0 z-20 bg-slate-100">
            <tr>{sheet !== "income" ? <th scope="col" className="sticky left-0 z-30 border-b border-r border-slate-300 bg-slate-100 p-2">Row</th> :
              <th scope="col" className="sticky left-0 z-30 border-b border-r border-slate-300 bg-slate-100 p-2">
                <input type="checkbox" aria-label="Select bookings on this page" disabled={!selectable.length || checkInBusy} checked={selectable.length > 0 && selectable.every((row) => selectedBookings.has(row.key))}
                  ref={(element) => { if (element) element.indeterminate = selectable.some((row) => selectedBookings.has(row.key)) && !selectable.every((row) => selectedBookings.has(row.key)); }}
                  onChange={(event) => { const checked = event.target.checked; setSelectedBookings((previous) => { const next = new Set(previous); for (const row of selectable) { if (checked) next.add(row.key); else next.delete(row.key); } return next; }); }} />
              </th>}
              {columns.map((column, index) => {
                const color = sheet === "income" ? incomeLayout.colorTags.find((tag) => tag.id === incomeLayout.columnColors[column.key])?.color : undefined;
                const selectedValue = incomeLayout.columnFilters[column.key];
                const values = columnValues.get(column.key) || [];
                return <th key={column.key} scope="col" aria-sort={sort?.key === column.key ? sort.desc ? "descending" : "ascending" : "none"} style={{ left: pinnedOffset(index), backgroundColor: color ? tint(color, 0.3) : undefined }} className={`${pinnedOffset(index) !== undefined ? "sticky z-30" : "relative"} border-b border-r border-slate-300 bg-slate-100 p-2 pr-4 align-top`}
                onDragOver={(event) => { if (sheet === "income" && draggedColumn.current) event.preventDefault(); }}
                onDrop={(event) => { event.preventDefault(); const from = draggedColumn.current; if (from) setIncomeLayout((previous) => ({ ...previous, columns: moveGridColumn(previous.columns, from, column.key) })); draggedColumn.current = null; }}>
                {sheet === "income" && <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-600">{incomeGroups.find((group) => group.id === incomeViewColumns.find((item) => item.key === column.key)?.group)?.label}</div>}
                {sheet === "income" && <span draggable aria-label={`Drag ${column.label} column`} title={`Drag ${column.label} to reorder`} className="mr-1 cursor-grab select-none text-slate-500"
                  onDragStart={(event) => { draggedColumn.current = column.key; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", column.key); }}
                  onDragEnd={() => { draggedColumn.current = null; }}><GripVertical className="inline h-4 w-4" aria-hidden="true" /></span>}
                <button type="button" className="text-left font-semibold" onClick={() => { setSort({ key: column.key, desc: sort?.key === column.key && !sort.desc }); setPage(0); }}>{column.label}{sort?.key === column.key ? sort.desc ? " ↓" : " ↑" : ""}</button>
                {sheet === "income" && showFilters && <select aria-label={`Filter ${column.label} by value`} value={selectedValue === undefined ? "" : JSON.stringify(selectedValue)} onChange={(event) => {
                  const filters = { ...incomeLayout.columnFilters };
                  if (event.target.value === "") delete filters[column.key];
                  else filters[column.key] = JSON.parse(event.target.value) as string;
                  setIncomeLayout({ ...incomeLayout, columnFilters: filters });
                  setPage(0);
                }} className="mt-1 block w-full min-w-0 rounded border border-slate-300 bg-white px-1 py-1 text-xs">
                  <option value="">All values</option>
                  {selectedValue !== undefined && !values.includes(selectedValue) && <option value={JSON.stringify(selectedValue)}>{selectedValue || "(Empty)"} (not present)</option>}
                  {values.map((value) => <option key={value} value={JSON.stringify(value)}>{value || "(Empty)"}</option>)}
                </select>}
                <div role="separator" aria-label={`Resize ${column.label} column`} aria-orientation="vertical" aria-valuemin={90} aria-valuemax={600} aria-valuenow={width(column)} tabIndex={0} style={{ touchAction: "none" }} className="absolute inset-y-0 right-0 w-3 cursor-col-resize border-r border-slate-300 focus-visible:outline focus-visible:outline-teal-600"
                  onKeyDown={(event) => keyboardResize(event, column)} onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { key: column.key, x: event.clientX, width: width(column) }; }} onPointerMove={moveResize} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
              </th>; })}</tr>
          </thead>
          <tbody>{visible.map((row, index) => <tr key={row.key} className="bg-white">
            {sheet !== "income" && <th scope="row" className={`sticky left-0 z-10 border-b border-r border-slate-300 p-2 text-xs ${row.error ? "bg-rose-100 text-rose-800" : rowDirty(row) ? "bg-amber-50" : "bg-slate-50"}`}>
              {page * PAGE_SIZE + index + 1}<span className="block font-normal">{row.saving ? "Saving" : row.error ? "Error" : rowDirty(row) ? "Unsaved" : "Saved"}</span>{row.error && <span role="alert" className="block break-words">{row.error}</span>}
            </th>}
            {sheet === "income" && <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white p-2 align-top">
              <input type="checkbox" aria-label={`Select ${rowLabel(row)} (${row.values.reference})`} disabled={!row.booking || row.booking.source === "recorded" || checkInBusy} checked={selectedBookings.has(row.key)} onChange={(event) => selectRow(row.key, event.target.checked)} />
            </td>}
            {columns.map((column, columnIndex) => {
              const readOnly = column.readOnly || (column.recordedOnly && row.booking?.source !== "recorded") || (column.overlapOnly && !row.booking?.possibleRecordedOverlap);
              const value = readOnly ? display(row, column, rooms) : row.values[column.key] || "";
              const label = `${column.label} for ${rowLabel(row)}`;
              const cellClass = `h-full min-h-10 w-full border-0 bg-transparent px-2 py-2 text-left outline-none focus:bg-teal-50 focus:ring-2 focus:ring-inset focus:ring-teal-600 ${row.values[column.key] !== row.saved[column.key] ? "bg-amber-50" : ""}`;
              const common = { "aria-label": label, value, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => change(row, column.key, event.target.value), onBlur: () => { if (row.saving || row.values[column.key] !== row.saved[column.key]) void saveRow(row); } };
              const color = sheet === "income" ? incomeLayout.colorTags.find((tag) => tag.id === incomeLayout.columnColors[column.key])?.color : undefined;
              return <td key={column.key} title={readOnly ? "Read-only" : undefined} style={{ left: pinnedOffset(columnIndex), backgroundColor: color ? tint(color, 0.08, readOnly ? 248 : 255) : undefined }} className={`${pinnedOffset(columnIndex) !== undefined ? "sticky z-10" : ""} border-b border-r border-slate-200 align-top ${readOnly ? "bg-slate-50 px-2 py-2 text-slate-600 [overflow-wrap:anywhere]" : "bg-white"}`}>
                {column.key === "possibleBookings" && row.booking ? row.booking.source === "recorded" ? <PnlBookingMatches matches={possibleBookingMatches({ source: row.booking.source, reference: row.values.reference, roomId: row.values.roomId, checkIn: row.values.date, checkOut: display(row, { key: "checkOut", label: "Check-out" }, rooms) }, bookings)} /> : "—"
                  : readOnly ? value || "—" : column.kind === "room" ? <select {...common} className={cellClass}><option value="">Unassigned</option>{value && !rooms.some((room) => room._id === value) && <option value={value}>Removed room</option>}{rooms.map((room) => <option key={room._id} value={room._id}>{room.name}</option>)}</select>
                  : column.kind === "payment" ? <select {...common} className={cellClass}><option value="unknown">Not specified</option><option value="paid">Paid</option><option value="pending">Pending</option></select>
                  : column.kind === "boolean" || column.kind === "invoiceStatus" ? <select {...common} className={cellClass}><option value="">Not specified</option><option value="yes">{column.kind === "boolean" ? "Yes" : "Created"}</option><option value="no">{column.kind === "boolean" ? "No" : "Pending"}</option></select>
                  : ["description", "guestName", "notes", "guestDetails", "email", "payee"].includes(column.key)
                    ? <textarea {...common} rows={2} placeholder={column.key === "notes" ? "Add a note…" : undefined} className={`${cellClass} resize-none [overflow-wrap:anywhere]`} onKeyDown={enterCell} />
                    : <input {...common} type={column.kind === "date" ? "date" : "text"} inputMode={column.kind === "money" ? "decimal" : column.kind === "number" ? "numeric" : undefined} className={cellClass} onKeyDown={enterCell} />}
                {sheet === "income" && columnIndex === 0 && (row.saving || row.error || rowDirty(row)) && <span className={`block px-2 pb-1 text-xs ${row.error ? "text-rose-800" : "text-slate-600"}`}>
                  {row.saving ? "Saving" : row.error ? "Error" : "Unsaved"}{row.error && <span role="alert" className="block break-words">{row.error}</span>}
                </span>}
              </td>;
            })}
          </tr>)}</tbody>
        </table>
        {visible.length === 0 && <p className="p-6 text-sm text-slate-600">No rows on this sheet match your search.</p>}
      </div>
    </div>
  );
}
