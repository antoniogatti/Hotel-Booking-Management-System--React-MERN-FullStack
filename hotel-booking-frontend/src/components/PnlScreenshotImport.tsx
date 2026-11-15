import { ClipboardEvent, useEffect, useState } from "react";
import { useQueryClient } from "react-query";
import { createWorker, OEM, PSM } from "tesseract.js";
import workerUrl from "tesseract.js/dist/worker.min.js?url";
import coreUrl from "tesseract.js-core/tesseract-core-lstm.wasm.js?url";
import * as apiClient from "../api-client";
import { moneyToCents, stayNights } from "../pages/pnl-utils";
import { Button } from "./ui/button";
import { OcrLine, parseBookingScreenshot, ScreenshotRow } from "./bookingScreenshotParser";

type ReviewRow = ScreenshotRow & { candidates: apiClient.PnlBooking[]; selected: string; saved: boolean };
type Room = { _id: string; name: string };
const inputClass = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
const emptyRow = (): ReviewRow => ({ reference: "", guestName: "", room: "", checkIn: "", checkOut: "", guests: "", amount: "", sharedTotal: "", candidates: [], selected: "", saved: false });

export default function PnlScreenshotImport({ rooms, onClose, onSaved }: { rooms: Room[]; onClose: () => void; onSaved: (year: string) => void }) {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  const queryClient = useQueryClient();
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const update = (index: number, patch: Partial<ReviewRow>) => setRows((current) => current.map((row, i) => i === index ? { ...row, ...patch } : row));
  const readImage = async (file: File) => {
    if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
      setError("Choose an image smaller than 15 MB.");
      return;
    }
    setBusy(true);
    setError("");
    setRows([]);
    setPreview(URL.createObjectURL(file));
    let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
    try {
      setProgress("Preparing image...");
      const bitmap = await createImageBitmap(file);
      if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 20000000) {
        bitmap.close();
        throw new Error("Image dimensions are too large.");
      }
      const scale = Math.min(2, 6000 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to process the image in this browser.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      worker = await createWorker("eng", OEM.LSTM_ONLY, {
        workerPath: workerUrl, corePath: coreUrl, workerBlobURL: false, cacheMethod: "none",
        langPath: new URL(`${import.meta.env.BASE_URL}ocr`, window.location.origin).href,
        logger: (message) => setProgress(`${message.status} ${Math.round(message.progress * 100)}%`),
      });
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      const result = await worker.recognize(canvas, {}, { blocks: true, text: true });
      const lines: OcrLine[] = (result.data.blocks || []).flatMap((block) =>
        block.paragraphs.flatMap((paragraph) => paragraph.lines.map((line) => ({ text: line.text.trim(), ...line.bbox }))));
      const extracted = parseBookingScreenshot(lines, rooms.map((room) => room.name));
      setRows(extracted.map((row) => ({ ...row, candidates: [], selected: "", saved: false })));
      if (!extracted.length) setError("No reservation references were recognised. Try a clearer crop or add a row manually.");
      setProgress("Extraction finished. Review every field before saving.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to extract the image. Try another image.");
      setProgress("");
    } finally {
      if (worker) await worker.terminate();
      setBusy(false);
    }
  };
  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"));
    if (file) {
      event.preventDefault();
      void readImage(file);
    }
  };
  const findMatches = async (index: number, row: ReviewRow) => {
    if (!stayNights(row.checkIn, row.checkOut)) {
      setError("Enter valid check-in and check-out dates before finding bookings.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const bookings = await apiClient.fetchPnlBookings(Number(row.checkIn.slice(0, 4)));
      const candidates = bookings.filter((booking) => booking.source === "booking_com" && booking.checkIn === row.checkIn && booking.checkOut === row.checkOut);
      update(index, { candidates, selected: "" });
      if (!candidates.length) setError("No active Booking.com bookings match those dates. Check the dates or sync the booking first; no new booking was created.");
    } catch {
      setError("Unable to load matching bookings. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const save = async (index: number, row: ReviewRow) => {
    const booking = row.candidates.find((item) => item.id === row.selected);
    const gross = row.amount ? moneyToCents(row.amount) : undefined;
    const guests = row.guests ? Number(row.guests) : undefined;
    if (!booking || !row.reference.trim() || !row.guestName.trim() || gross === null ||
        (guests !== undefined && (!/^\d+$/.test(row.guests) || guests < 1 || guests > 1000))) {
      setError("Select a booking and enter a reference, guest name, valid guest count and positive EUR amount (amount and guest count may be blank).");
      return;
    }
    if (rows.some((other, otherIndex) => otherIndex !== index && other.saved && other.selected === booking.id)) {
      setError("This booking was already updated by another row. Select a different booking.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiClient.savePnlScreenshotDetails(booking, {
        bookingReference: row.reference.trim(), bookingGuestName: row.guestName.trim(),
        ...(guests === undefined ? {} : { guestCount: guests }),
        ...(gross === undefined ? {} : { grossAmountCents: gross }),
      });
      update(index, { saved: true });
      await queryClient.invalidateQueries("pnl-bookings");
      onSaved(booking.checkIn.slice(0, 4));
    } catch {
      setError("Unable to save. The booking may have changed; find it again and review before retrying.");
    } finally {
      setBusy(false);
    }
  };
  return <section className="space-y-4 rounded-2xl border border-teal-200 bg-white p-5 sm:p-7" aria-labelledby="screenshot-heading">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="screenshot-heading" className="text-xl font-semibold text-slate-900">Import Booking.com screenshot</h2>
        <p className="mt-1 text-sm text-slate-600">OCR runs in your browser using a locally served AI model. The image is not uploaded. OCR can make mistakes: review every field and select an existing booking before saving.</p></div>
      <Button variant="outline" onClick={onClose} disabled={busy}>Close</Button>
    </div>
    <label className="block text-sm font-medium text-slate-700">Paste an image here
      <textarea className={inputClass} rows={2} placeholder="Click here and paste your screenshot" onPaste={onPaste} disabled={busy} />
    </label>
    <label className="block text-sm font-medium text-slate-700">Or choose an image
      <input className="mt-1 block w-full text-sm" type="file" accept="image/*" disabled={busy} onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void readImage(file);
      }} />
    </label>
    {preview && <img src={preview} alt="Screenshot to review" className="max-h-80 max-w-full rounded-lg border border-slate-200 object-contain" />}
    {progress && <p role="status" className="text-sm text-slate-600">{progress}</p>}
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <p className="text-sm text-amber-800">Prices can cover multiple rooms. The detected total is not applied automatically; allocate amounts per room yourself. Unmatched reservations are not created.</p>
    {rows.map((row, index) => <fieldset key={index} disabled={busy || row.saved} className="space-y-3 rounded-xl border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold">Reservation {index + 1}{row.saved ? " — saved" : ""}</legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {([
          ["reference", "Reference", "text"], ["guestName", "Guest name", "text"], ["room", "Room from screenshot", "text"],
          ["checkIn", "Check-in", "date"], ["checkOut", "Check-out", "date"], ["guests", "Guests for this room", "number"],
          ["amount", "Amount for this room (EUR)", "text"],
        ] as const).map(([field, label, type]) => <label key={field} className="text-sm font-medium text-slate-700">{label}
          <input className={inputClass} type={type} value={row[field]} maxLength={field === "guestName" || field === "reference" ? 200 : undefined}
            onChange={(event) => update(index, { [field]: event.target.value, ...(field === "checkIn" || field === "checkOut" ? { candidates: [], selected: "" } : {}) })} />
        </label>)}
      </div>
      {row.sharedTotal && <p className="text-sm text-slate-600">OCR detected a total of {row.sharedTotal} EUR. Verify it and allocate it yourself if applicable.</p>}
      <div className="flex flex-wrap items-end gap-3">
        <Button type="button" variant="outline" onClick={() => void findMatches(index, row)}>Find bookings for these dates</Button>
        {row.candidates.length > 0 && <label className="min-w-72 flex-1 text-sm font-medium text-slate-700">Confirm matching booking
          <select className={inputClass} value={row.selected} onChange={(event) => update(index, { selected: event.target.value })}>
            <option value="">Select a booking</option>
            {row.candidates.map((booking) => <option key={booking.id} value={booking.id}>{rooms.find((room) => room._id === booking.roomId)?.name || booking.roomName || "Unknown room"} · {booking.reference} · {booking.guestName || "Guest unavailable"} · {booking.checkIn} to {booking.checkOut}</option>)}
          </select>
        </label>}
        <Button type="button" onClick={() => void save(index, row)} disabled={!row.selected}>Save reviewed row</Button>
      </div>
    </fieldset>)}
    <Button type="button" variant="outline" disabled={busy} onClick={() => setRows((current) => [...current, emptyRow()])}>Add a row manually</Button>
  </section>;
}
