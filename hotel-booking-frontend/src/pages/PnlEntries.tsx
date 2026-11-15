import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import PnlTable, { PnlColumn } from "../components/PnlTable";
import PnlGrid from "../components/PnlGrid";
import { PnlBookingMatches, possibleBookingMatches } from "../components/PnlBookingMatches";
import * as apiClient from "../api-client";
import { currentYear, formatMoney, moneyToCents, signedMoneyToCents, today, validYear } from "./pnl-utils";

type EntryType = "income" | "expense";
type FormValues = {
  date: string;
  amount: string;
  category: string;
  description: string;
  roomId: string;
  status: "paid" | "pending" | "unknown";
  nights: string;
  guestCount: string;
  numberOfNights: string;
  payee: string;
  reference: string;
  invoice: string;
  notes: string;
};
type BookingForm = {
  reference: string;
  guestName: string;
  phone: string;
  email: string;
  roomId: string;
  date: string;
  nights: string;
  country: string;
  city: string;
  identifier: string;
  guestDetails: string;
  guestCount: string;
  grossAmount: string;
  netAmount: string;
  paymentMethod: string;
  taxQuarter: string;
  invoiceRequired: "unknown" | "yes" | "no";
  invoiceCreated: "unknown" | "yes" | "no";
  invoiceNumber: string;
};

const emptyForm = (): FormValues => ({ date: today(), amount: "", category: "", description: "", roomId: "", status: "paid", nights: "", guestCount: "", numberOfNights: "", payee: "", reference: "", invoice: "", notes: "" });
const fieldClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PnlEntries = ({ type }: { type: EntryType }) => {
  const [year, setYear] = useState(currentYear);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [error, setError] = useState("");
  const [editingBooking, setEditingBooking] = useState<apiClient.PnlBooking | null>(null);
  const [bookingForm, setBookingForm] = useState<BookingForm | null>(null);
  const bookingFormHeading = useRef<HTMLHeadingElement>(null);
  const queryClient = useQueryClient();
  const rooms = useQuery(["bookingManagementRooms"], apiClient.fetchBookingManagementRooms);
  const entries = useQuery(["pnl-entries", year], () => apiClient.fetchPnlEntries(Number(year)), { enabled: validYear(year), retry: false });
  const bookings = useQuery(["pnl-bookings", year], () => apiClient.fetchPnlBookings(Number(year)), { enabled: type === "income" && validYear(year), retry: false });
  const save = useMutation(({ entry, id }: { entry: apiClient.PnlEntryInput; id?: string }) => apiClient.savePnlEntry(entry, id));
  const remove = useMutation(apiClient.deletePnlEntry);
  const saveBooking = useMutation(({ booking, details, identity }: { booking: apiClient.PnlBooking; details: apiClient.PnlBookingDetails; identity?: apiClient.PnlRecordedIdentity }) => apiClient.savePnlBookingDetails(booking, details, identity));
  const title = type === "income" ? "Income" : "Expenses";
  const rows = (entries.data || []).filter((entry) => entry.type === type);
  const roomNames = new Map((rooms.data || []).map((room) => [room._id, room.name]));

  useEffect(() => {
    if (editingBooking) bookingFormHeading.current?.focus();
  }, [editingBooking]);

  const reset = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(false);
    setError("");
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amountCents = moneyToCents(form.amount);
    const countFields = [form.nights, form.guestCount, form.numberOfNights];
    if (amountCents === null || !validYear(form.date.slice(0, 4)) || (type === "expense" && countFields.some((value) => value !== "" && (!/^\d+$/.test(value) || Number(value) > 10000)))) {
      setError("Enter a valid date, positive amount, and whole-number counts between 0 and 10000.");
      return;
    }
    try {
      await save.mutateAsync({
        id: editingId || undefined,
        entry: { type, date: form.date, amountCents, category: form.category.trim(), description: form.description.trim(), roomId: form.roomId || null, status: form.status, ...(type === "expense" ? { nights: form.nights === "" ? null : Number(form.nights), guestCount: form.guestCount === "" ? null : Number(form.guestCount), numberOfNights: form.numberOfNights === "" ? null : Number(form.numberOfNights), payee: form.payee.trim(), reference: form.reference.trim(), invoice: form.invoice.trim(), notes: form.notes.trim() } : {}) },
      });
      await queryClient.invalidateQueries("pnl-entries");
      setYear(form.date.slice(0, 4));
      reset();
    } catch {
      setError("Unable to save the entry. Check the details and try again.");
    }
  };
  const edit = (entry: apiClient.PnlEntry) => {
    setForm({ date: entry.date, amount: (entry.amountCents / 100).toFixed(2), category: entry.category, description: entry.description, roomId: entry.roomId || "", status: entry.status, nights: entry.nights == null ? "" : String(entry.nights), guestCount: entry.guestCount == null ? "" : String(entry.guestCount), numberOfNights: entry.numberOfNights == null ? "" : String(entry.numberOfNights), payee: entry.payee || "", reference: entry.reference || "", invoice: entry.invoice || "", notes: entry.notes || "" });
    setEditingId(entry._id);
    setError("");
    setShowForm(true);
  };
  const deleteEntry = async (entry: apiClient.PnlEntry) => {
    if (!window.confirm(`Delete "${entry.description}"? This cannot be undone.`)) return;
    setError("");
    try {
      await remove.mutateAsync(entry._id);
      await queryClient.invalidateQueries("pnl-entries");
      if (editingId === entry._id) reset();
    } catch {
      setError("Unable to delete the entry. Please try again.");
    }
  };
  const editBookingDetails = (booking: apiClient.PnlBooking) => {
    const details = booking.overrides || {};
    const money = (value?: number) => value === undefined ? "" : (value / 100).toFixed(2);
    setBookingForm({
      reference: booking.reference,
      guestName: booking.guestName,
      phone: booking.phone,
      email: booking.email,
      roomId: booking.roomId,
      date: booking.checkIn,
      nights: booking.nights == null ? "" : String(booking.nights),
      country: details.country || "",
      city: details.city || "",
      identifier: details.identifier || "",
      guestDetails: details.guestDetails || "",
      guestCount: details.guestCount === undefined ? "" : String(details.guestCount),
      grossAmount: money(details.grossAmountCents),
      netAmount: money(details.netAmountCents),
      paymentMethod: details.paymentMethod || "",
      taxQuarter: details.taxQuarter || "",
      invoiceRequired: details.invoiceRequired === true ? "yes" : details.invoiceRequired === false ? "no" : "unknown",
      invoiceCreated: details.invoiceCreated === true ? "yes" : details.invoiceCreated === false ? "no" : "unknown",
      invoiceNumber: details.invoiceNumber || booking.invoiceNumber || "",
    });
    setError("");
    setEditingBooking(booking);
  };
  const submitBookingDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingBooking || !bookingForm) return;
    const gross = bookingForm.grossAmount ? moneyToCents(bookingForm.grossAmount) : undefined;
    const net = bookingForm.netAmount ? signedMoneyToCents(bookingForm.netAmount) : undefined;
    const guestCount = bookingForm.guestCount ? Number(bookingForm.guestCount) : undefined;
    if (gross === null || net === null || (guestCount !== undefined && (!/^\d+$/.test(bookingForm.guestCount) || !Number.isSafeInteger(guestCount) || guestCount < 1 || guestCount > 1000))) {
      setError("Enter valid amounts with at most two decimal places and a guest count between 1 and 1000.");
      return;
    }
    if (bookingForm.invoiceRequired === "yes" && bookingForm.invoiceCreated === "yes" && !bookingForm.invoiceNumber.trim()) {
      setError("Enter the invoice number when the invoice has been created.");
      return;
    }
    if (editingBooking.source === "recorded" && (gross === undefined || !validYear(bookingForm.date.slice(0, 4)) ||
      (bookingForm.nights !== "" && (!/^\d+$/.test(bookingForm.nights) || Number(bookingForm.nights) < 1 || Number(bookingForm.nights) > 10000)))) {
      setError("Enter a date, positive booking value and a valid number of nights.");
      return;
    }
    const details: apiClient.PnlBookingDetails = {
      ...editingBooking.overrides,
      country: bookingForm.country.trim() || undefined,
      city: bookingForm.city.trim() || undefined,
      identifier: bookingForm.identifier.trim() || undefined,
      guestDetails: bookingForm.guestDetails.trim() || undefined,
      guestCount,
      grossAmountCents: gross,
      netAmountCents: net,
      paymentMethod: bookingForm.paymentMethod.trim() || undefined,
      taxQuarter: bookingForm.taxQuarter.trim() || undefined,
      invoiceRequired: bookingForm.invoiceRequired === "unknown" ? undefined : bookingForm.invoiceRequired === "yes",
      invoiceCreated: bookingForm.invoiceRequired === "yes" && bookingForm.invoiceCreated !== "unknown" ? bookingForm.invoiceCreated === "yes" : undefined,
      invoiceNumber: bookingForm.invoiceRequired !== "no" ? bookingForm.invoiceNumber.trim() || undefined : undefined,
    };
    try {
      const identity = editingBooking.source === "recorded" ? {
        reference: bookingForm.reference.trim(), guestName: bookingForm.guestName.trim(),
        phone: bookingForm.phone.trim(), email: bookingForm.email.trim(), roomId: bookingForm.roomId,
        roomName: bookingForm.roomId === editingBooking.roomId ? editingBooking.roomName || "" : roomNames.get(bookingForm.roomId) || "",
        date: bookingForm.date, nights: bookingForm.nights === "" ? null : Number(bookingForm.nights),
      } : undefined;
      await saveBooking.mutateAsync({ booking: editingBooking, details, identity });
      await queryClient.invalidateQueries("pnl-bookings");
      if (identity) setYear(identity.date.slice(0, 4));
      setEditingBooking(null);
      setBookingForm(null);
      setError("");
    } catch {
      setError("Unable to save booking income details. Check the details and try again.");
    }
  };
  const toggleOverlap = async (booking: apiClient.PnlBooking) => {
    try {
      await saveBooking.mutateAsync({ booking, details: { ...booking.overrides, includePossibleOverlap: !booking.overrides.includePossibleOverlap } });
      await queryClient.invalidateQueries("pnl-bookings");
      setError("");
    } catch {
      setError("Unable to update the overlap decision. Please try again.");
    }
  };
  const toggleRecordedIncome = async (booking: apiClient.PnlBooking) => {
    try {
      await saveBooking.mutateAsync({
        booking,
        details: { ...booking.overrides, excludeFromTotals: !booking.overrides.excludeFromTotals },
        identity: { reference: booking.reference, guestName: booking.guestName, phone: booking.phone, email: booking.email,
          roomId: booking.roomId, roomName: booking.roomName || "", date: booking.checkIn, nights: booking.nights },
      });
      await queryClient.invalidateQueries("pnl-bookings");
      setError("");
    } catch {
      setError("Unable to update the income inclusion decision. Please try again.");
    }
  };

  const bookingColumns: PnlColumn<apiClient.PnlBooking>[] = [
    { key: "room", label: "Room", value: (row) => roomNames.get(row.roomId) || row.roomName || "Shared / unassigned", render: (row) => roomNames.get(row.roomId) || row.roomName || "Shared / unassigned" },
    { key: "checkIn", label: "Check-in", value: (row) => row.checkIn, render: (row) => row.checkIn },
    { key: "checkOut", label: "Check-out", value: (row) => row.checkOut, render: (row) => row.checkOut || "—" },
    { key: "guest", label: "Guest", width: 180, value: (row) => row.guestName, render: (row) => row.guestName || "Not available" },
    { key: "reference", label: "Reference / source", width: 160, value: (row) => row.reference, render: (row) => <>{row.source === "recorded" ? row.reference || "—" : <Link to={`/booking/${row.id}`} className="font-semibold text-teal-700">{row.reference}</Link>}<p className="text-xs text-slate-500">{row.source === "recorded" ? "Recorded income" : row.source === "local" ? "Local" : "Booking.com"}</p></> },
    { key: "possibleBookings", label: "Possible bookings", width: 260, render: (row) => row.source === "recorded" ? <PnlBookingMatches matches={possibleBookingMatches(row, bookings.data || [])} /> : "—" },
    { key: "phone", label: "Phone", width: 150, value: (row) => row.phone, render: (row) => row.phone || "—" },
    { key: "email", label: "Email", width: 210, value: (row) => row.email, render: (row) => row.email || "—" },
    { key: "invoiceNumber", label: "Invoice number", value: (row) => row.invoiceNumber, render: (row) => row.invoiceNumber || "—" },
    { key: "country", label: "Country", value: (row) => row.country, render: (row) => row.country || "—" },
    { key: "identifier", label: "Identifier", value: (row) => row.identifier, render: (row) => row.identifier || "—" },
    { key: "city", label: "City", value: (row) => row.city, render: (row) => row.city || "—" },
    { key: "month", label: "Month", width: 105, value: (row) => Number(row.checkIn.slice(5, 7)), render: (row) => months[Number(row.checkIn.slice(5, 7)) - 1] || "—" },
    { key: "nights", label: "Nights", width: 105, value: (row) => row.nights, render: (row) => row.nights ?? "—" },
    { key: "guests", label: "Guests", width: 105, value: (row) => row.guestCount, render: (row) => row.guestCount ?? "—" },
    { key: "amount", label: "Booking value", align: "right", value: (row) => row.amountCents, render: (row) => row.amountCents == null ? "Not available" : row.currency === "EUR" ? formatMoney(row.amountCents) : `${(row.amountCents / 100).toFixed(2)} ${row.currency || "(currency unknown)"}` },
    { key: "unit", label: "Unit price", align: "right", value: (row) => row.unitAmountCents, render: (row) => row.unitAmountCents == null ? "—" : formatMoney(row.unitAmountCents) },
    { key: "net", label: "Before tourist tax", align: "right", value: (row) => row.netAmountCents, render: (row) => row.netAmountCents == null ? "—" : formatMoney(row.netAmountCents) },
    { key: "guestDetails", label: "Guest ages / details", width: 180, value: (row) => row.guestDetails, render: (row) => row.guestDetails || "—" },
    { key: "paymentMethod", label: "Payment method", value: (row) => row.paymentMethod, render: (row) => row.paymentMethod || "—" },
    { key: "taxQuarter", label: "Tax quarter", value: (row) => row.taxQuarter, render: (row) => row.taxQuarter || "—" },
    { key: "status", label: "Booking status", value: (row) => row.status, render: (row) => <><span className="capitalize">{row.status}</span>{row.reason && <p className="text-xs font-medium text-amber-700">{row.reason} — excluded</p>}{row.possibleRecordedOverlap && row.overrides.includePossibleOverlap && <p className="text-xs font-medium text-amber-700">Possible overlap — manually included</p>}{row.possibleRepeatedRecord && <p className="text-xs font-medium text-amber-700">Another record has the same room and date — review</p>}</> },
    { key: "invoiceRequired", label: "Invoice required", value: (row) => row.invoiceRequired == null ? null : row.invoiceRequired ? "Yes" : "No", render: (row) => row.invoiceRequired === true ? "Yes" : row.invoiceRequired === false ? "No" : "Not specified" },
    { key: "invoiceStatus", label: "Invoice status", value: (row) => row.invoiceRequired === true ? row.invoiceCreated === true ? "Created" : row.invoiceCreated === false ? "Pending" : null : null, render: (row) => row.invoiceRequired === true ? row.invoiceCreated === true ? "Created" : row.invoiceCreated === false ? "Pending" : "Not specified" : "—" },
    { key: "actions", label: "Actions", width: 180, render: (row) => <><button className="font-semibold text-teal-700" aria-label={`Edit income details for ${row.reference || row.guestName}`} onClick={() => editBookingDetails(row)}>Edit details</button>{row.possibleRecordedOverlap && (row.reason === "Possible overlap with recorded income" || !row.reason) && <button className="mt-2 block font-semibold text-amber-700" disabled={saveBooking.isLoading} onClick={() => toggleOverlap(row)}>{row.overrides.includePossibleOverlap ? "Exclude overlap" : "Include despite overlap"}</button>}{row.source === "recorded" && <button className="mt-2 block font-semibold text-amber-700" disabled={saveBooking.isLoading} onClick={() => toggleRecordedIncome(row)}>{row.overrides.excludeFromTotals ? "Include in totals" : "Exclude from totals"}</button>}</> },
  ];
  const ledgerColumns: PnlColumn<apiClient.PnlEntry>[] = [
    { key: "description", label: "Description", width: 200, value: (row) => row.description, render: (row) => <span className="font-medium">{row.description}</span> },
    { key: "date", label: "Date", value: (row) => row.date, render: (row) => row.date },
    { key: "month", label: "Month", width: 105, value: (row) => Number(row.date.slice(5, 7)), render: (row) => months[Number(row.date.slice(5, 7)) - 1] || "—" },
    { key: "category", label: "Category", value: (row) => row.category, render: (row) => row.category },
    { key: "room", label: "Room", value: (row) => row.roomId ? roomNames.get(row.roomId) || "Removed room" : "Shared / unassigned", render: (row) => row.roomId ? roomNames.get(row.roomId) || "Removed room" : "Shared / unassigned" },
    ...(type === "expense" ? [
      { key: "nights", label: "Nights", width: 105, value: (row: apiClient.PnlEntry) => row.nights, render: (row: apiClient.PnlEntry) => row.nights ?? "—" },
      { key: "guests", label: "Guests", width: 105, value: (row: apiClient.PnlEntry) => row.guestCount, render: (row: apiClient.PnlEntry) => row.guestCount ?? "—" },
      { key: "payee", label: "Payee", value: (row: apiClient.PnlEntry) => row.payee, render: (row: apiClient.PnlEntry) => row.payee || "—" },
      { key: "reference", label: "Reference", value: (row: apiClient.PnlEntry) => row.reference, render: (row: apiClient.PnlEntry) => row.reference || "—" },
      { key: "invoice", label: "Invoice", value: (row: apiClient.PnlEntry) => row.invoice, render: (row: apiClient.PnlEntry) => row.invoice || "—" },
      { key: "notes", label: "Notes", width: 200, value: (row: apiClient.PnlEntry) => row.notes, render: (row: apiClient.PnlEntry) => row.notes || "—" },
      { key: "numberOfNights", label: "Number of nights", value: (row: apiClient.PnlEntry) => row.numberOfNights, render: (row: apiClient.PnlEntry) => row.numberOfNights ?? "—" },
    ] : []),
    { key: "status", label: "Status", value: (row) => row.status, render: (row) => <span className="capitalize">{row.status}</span> },
    { key: "amount", label: "Amount", align: "right", value: (row) => row.amountCents, render: (row) => formatMoney(row.amountCents) },
    { key: "actions", label: "Actions", width: 160, render: (row) => <><button onClick={() => edit(row)} className="mr-3 font-semibold text-teal-700" aria-label={`Edit ${row.description}`}>Edit</button><button onClick={() => deleteEntry(row)} disabled={remove.isLoading} className="font-semibold text-rose-700" aria-label={`Delete ${row.description}`}>Delete</button></> },
  ];

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-9">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">P&amp;L management</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{type === "income" ? "Bookings are loaded automatically. Add only additional non-booking income below to avoid double counting." : "Track manually recorded costs in EUR."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Year<input aria-label="Year" type="number" min="1900" max="9998" value={year} onChange={(e) => setYear(e.target.value)} className="ml-3 w-24 rounded-lg border border-slate-300 px-3 py-2" /></label>
          <Link to="/pnl" className="text-sm font-semibold text-teal-700">P&amp;L overview</Link>
          <Button variant="outline" onClick={() => setShowGrid(true)} disabled={!validYear(year) || rooms.isLoading || rooms.isError || entries.isLoading || entries.isError || (type === "income" && (bookings.isLoading || bookings.isError))}>Open full-screen editor</Button>
          <Button onClick={() => { reset(); setShowForm(true); }} disabled={rooms.isLoading || rooms.isError}>Add {type}</Button>
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {showGrid && <PnlGrid type={type} year={year} bookings={bookings.data || []} entries={rows} rooms={rooms.data || []} onClose={() => setShowGrid(false)} />}
      {rooms.isError && <p role="alert" className="text-sm text-rose-700">Unable to load rooms. <button className="font-semibold underline" onClick={() => rooms.refetch()}>Retry</button></p>}
      {showForm && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <h2 className="text-xl font-semibold text-slate-900">{editingId ? "Edit" : "Add"} {type}</h2>
          <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">Date<input required type="date" min="1900-01-01" max="9998-12-31" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700">Amount (EUR)<input required type="text" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700">Category<input required maxLength={80} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder={type === "income" ? "e.g. Room revenue" : "e.g. Cleaning"} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700">Description<input required maxLength={200} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700">Room<select aria-label="Room" value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} className={fieldClass}><option value="">Shared / unassigned</option>{form.roomId && !roomNames.has(form.roomId) && <option value={form.roomId} disabled>Removed room — select another</option>}{(rooms.data || []).map((room) => <option key={room._id} value={room._id}>{room.name}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Payment status<select aria-label="Payment status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormValues["status"] })} className={fieldClass}><option value="paid">Paid</option><option value="pending">Pending</option><option value="unknown">Not specified</option></select></label>
            {type === "expense" && <>
              <label className="text-sm font-medium text-slate-700">Nights<input type="number" min="0" max="10000" step="1" value={form.nights} onChange={(e) => setForm({ ...form, nights: e.target.value })} className={fieldClass} /></label>
              <label className="text-sm font-medium text-slate-700">Guests<input type="number" min="0" max="10000" step="1" value={form.guestCount} onChange={(e) => setForm({ ...form, guestCount: e.target.value })} className={fieldClass} /></label>
              <label className="text-sm font-medium text-slate-700">Number of nights<input type="number" min="0" max="10000" step="1" value={form.numberOfNights} onChange={(e) => setForm({ ...form, numberOfNights: e.target.value })} className={fieldClass} /></label>
              <label className="text-sm font-medium text-slate-700">Payee<input maxLength={200} value={form.payee} onChange={(e) => setForm({ ...form, payee: e.target.value })} className={fieldClass} /></label>
              <label className="text-sm font-medium text-slate-700">Reference<input maxLength={200} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={fieldClass} /></label>
              <label className="text-sm font-medium text-slate-700">Invoice<input maxLength={200} value={form.invoice} onChange={(e) => setForm({ ...form, invoice: e.target.value })} className={fieldClass} /></label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-3">Notes<textarea maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={fieldClass} /></label>
            </>}
            <div className="flex gap-3 sm:col-span-2 lg:col-span-3"><Button type="submit" disabled={save.isLoading || rooms.isError}>{save.isLoading ? "Saving..." : "Save entry"}</Button><Button type="button" variant="outline" onClick={reset}>Cancel</Button></div>
          </form>
        </section>
      )}

      {type === "income" && validYear(year) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <h2 className="text-xl font-semibold text-slate-900">Booking income</h2>
          <p className="mt-1 text-sm text-slate-500">Values are attributed to the check-in month, not verified payments. Unconfirmed, missing, non-EUR and possible duplicate or overlapping bookings are excluded from totals.</p>
          <p className="mt-1 text-sm text-slate-500">Possible bookings are suggestions based on reference or room and check-in. Review dates and guest details; suggestions do not link records or change totals.</p>
          <p className="mt-1 text-sm text-slate-500">Nights and month come from the stay dates. Unit price is the amount before tourist tax per night when available. Missing amounts are not estimated.</p>
          {editingBooking && bookingForm && (
            <form onSubmit={submitBookingDetails} className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-3">
                <h3 ref={bookingFormHeading} tabIndex={-1} className="font-semibold text-slate-900">Income details for {editingBooking.reference}</h3>
                <p className="mt-1 text-sm text-slate-600">{editingBooking.source === "recorded" ? "Edit this independent income record. Its value is included in P&L totals." : "Leave overrides blank to use booking data. Changes are saved for income reporting only; an EUR booking value override changes P&L totals."}</p>
              </div>
              {editingBooking.source === "recorded" && <>
                <label className="text-sm font-medium text-slate-700">Reference<input maxLength={200} value={bookingForm.reference} onChange={(e) => setBookingForm({ ...bookingForm, reference: e.target.value })} className={fieldClass} /></label>
                <label className="text-sm font-medium text-slate-700">Guest name<input maxLength={200} value={bookingForm.guestName} onChange={(e) => setBookingForm({ ...bookingForm, guestName: e.target.value })} className={fieldClass} /></label>
                <label className="text-sm font-medium text-slate-700">Phone<input maxLength={200} value={bookingForm.phone} onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })} className={fieldClass} /></label>
                <label className="text-sm font-medium text-slate-700">Email<input maxLength={200} value={bookingForm.email} onChange={(e) => setBookingForm({ ...bookingForm, email: e.target.value })} className={fieldClass} /></label>
                <label className="text-sm font-medium text-slate-700">Room<select value={bookingForm.roomId} onChange={(e) => setBookingForm({ ...bookingForm, roomId: e.target.value })} className={fieldClass}><option value="">Shared / unassigned</option>{bookingForm.roomId && !roomNames.has(bookingForm.roomId) && <option value={bookingForm.roomId}>Removed room</option>}{(rooms.data || []).map((room) => <option key={room._id} value={room._id}>{room.name}</option>)}</select></label>
                <label className="text-sm font-medium text-slate-700">Check-in date<input required type="date" min="1900-01-01" max="9998-12-31" value={bookingForm.date} onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })} className={fieldClass} /></label>
                <label className="text-sm font-medium text-slate-700">Nights<input type="number" min="1" max="10000" step="1" value={bookingForm.nights} onChange={(e) => setBookingForm({ ...bookingForm, nights: e.target.value })} className={fieldClass} /></label>
              </>}
              <label className="text-sm font-medium text-slate-700">Country override<input maxLength={100} value={bookingForm.country} placeholder={editingBooking.country || "Not available"} onChange={(e) => setBookingForm({ ...bookingForm, country: e.target.value })} className={fieldClass} /></label>
              <label className="text-sm font-medium text-slate-700">City override<input maxLength={100} value={bookingForm.city} placeholder={editingBooking.city || "Not available"} onChange={(e) => setBookingForm({ ...bookingForm, city: e.target.value })} className={fieldClass} /></label>
              <label className="text-sm font-medium text-slate-700">Guest identifier<input maxLength={100} value={bookingForm.identifier} placeholder={editingBooking.identifier || "Not available"} onChange={(e) => setBookingForm({ ...bookingForm, identifier: e.target.value })} className={fieldClass} /></label>
              <label className="text-sm font-medium text-slate-700">Guest count override<input type="number" min="1" max="1000" step="1" value={bookingForm.guestCount} placeholder={editingBooking.guestCount?.toString() || "Not available"} onChange={(e) => setBookingForm({ ...bookingForm, guestCount: e.target.value })} className={fieldClass} /></label>
              <label className="text-sm font-medium text-slate-700">Guest ages / details<input maxLength={300} value={bookingForm.guestDetails} placeholder={editingBooking.guestDetails || "Not available"} onChange={(e) => setBookingForm({ ...bookingForm, guestDetails: e.target.value })} className={fieldClass} /></label>
              <label className="text-sm font-medium text-slate-700">Booking value override (EUR)<input type="text" inputMode="decimal" value={bookingForm.grossAmount} placeholder={editingBooking.currency === "EUR" && editingBooking.amountCents != null ? (editingBooking.amountCents / 100).toFixed(2) : "Not available"} onChange={(e) => setBookingForm({ ...bookingForm, grossAmount: e.target.value })} className={fieldClass} /></label>
              <label className="text-sm font-medium text-slate-700">Before tourist tax override (EUR)<input type="text" inputMode="decimal" value={bookingForm.netAmount} placeholder={editingBooking.netAmountCents != null ? (editingBooking.netAmountCents / 100).toFixed(2) : "Not available"} onChange={(e) => setBookingForm({ ...bookingForm, netAmount: e.target.value })} className={fieldClass} /></label>
              <label className="text-sm font-medium text-slate-700">Payment method override<input maxLength={100} value={bookingForm.paymentMethod} placeholder={editingBooking.paymentMethod || "Not available"} onChange={(e) => setBookingForm({ ...bookingForm, paymentMethod: e.target.value })} className={fieldClass} /></label>
              <label className="text-sm font-medium text-slate-700">Tax quarter override<input maxLength={100} value={bookingForm.taxQuarter} placeholder={editingBooking.taxQuarter || "Not available"} onChange={(e) => setBookingForm({ ...bookingForm, taxQuarter: e.target.value })} className={fieldClass} /></label>
              <label className="text-sm font-medium text-slate-700">Invoice required<select value={bookingForm.invoiceRequired} onChange={(e) => setBookingForm({ ...bookingForm, invoiceRequired: e.target.value as BookingForm["invoiceRequired"] })} className={fieldClass}><option value="unknown">Not specified</option><option value="yes">Yes</option><option value="no">No</option></select></label>
              {bookingForm.invoiceRequired === "yes" &&
                <label className="text-sm font-medium text-slate-700">Invoice status<select value={bookingForm.invoiceCreated} onChange={(e) => setBookingForm({ ...bookingForm, invoiceCreated: e.target.value as BookingForm["invoiceCreated"] })} className={fieldClass}><option value="unknown">Not specified</option><option value="no">Pending</option><option value="yes">Created</option></select></label>
              }
              {bookingForm.invoiceRequired !== "no" &&
                <label className="text-sm font-medium text-slate-700">Invoice number<input required={bookingForm.invoiceRequired === "yes" && bookingForm.invoiceCreated === "yes"} maxLength={100} value={bookingForm.invoiceNumber} placeholder={editingBooking.invoiceNumber || "Not available"} onChange={(e) => setBookingForm({ ...bookingForm, invoiceNumber: e.target.value })} className={fieldClass} /></label>
              }
              <div className="flex gap-3 sm:col-span-2 lg:col-span-3"><Button type="submit" disabled={saveBooking.isLoading}>{saveBooking.isLoading ? "Saving..." : "Save income details"}</Button><Button type="button" variant="outline" onClick={() => { setEditingBooking(null); setBookingForm(null); setError(""); }}>Cancel</Button></div>
            </form>
          )}
          {bookings.isLoading ? <p role="status" className="mt-5 text-sm text-slate-600">Loading bookings...</p> :
            bookings.isError ? <p role="alert" className="mt-5 text-sm text-rose-700">Unable to load bookings. <button className="font-semibold underline" onClick={() => bookings.refetch()}>Retry</button></p> :
            bookings.data?.length === 0 ? <p className="mt-5 text-sm text-slate-600">No bookings with check-in in {year}.</p> :
            <PnlTable label="Booking income" columns={bookingColumns} rows={bookings.data || []} rowKey={(booking) => `${booking.source}-${booking.id}`} />}
        </section>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-semibold text-slate-900">Manual {title.toLowerCase()} ledger</h2><p className="mt-1 text-sm text-slate-500">All entries are included in P&amp;L totals, including entries with unspecified payment status.</p></div>
        </div>
        {!validYear(year) ? <p role="alert" className="mt-5 text-sm text-rose-700">Enter a year between 1900 and 9998.</p> :
          entries.isLoading || rooms.isLoading ? <p role="status" className="mt-5 text-sm text-slate-600">Loading entries...</p> :
          entries.isError || rooms.isError ? <p role="alert" className="mt-5 text-sm text-rose-700">Unable to load the ledger. <button className="font-semibold underline" onClick={() => { void entries.refetch(); void rooms.refetch(); }}>Retry</button></p> :
          rows.length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No {type} entries for {year}.</p> :
          <PnlTable label={`Manual ${title.toLowerCase()} ledger`} columns={ledgerColumns} rows={rows} rowKey={(entry) => entry._id} />}
      </section>
    </div>
  );
};

export default PnlEntries;
