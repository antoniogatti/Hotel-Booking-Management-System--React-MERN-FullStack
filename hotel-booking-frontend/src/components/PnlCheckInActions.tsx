import { useState } from "react";
import axios from "axios";
import * as api from "../api-client";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";

type Options = { accessCode: string; locker: string; breakfastIncluded: boolean };
type Result = { sent: boolean; message: string };
const keyOf = (booking: api.PnlBooking) => `${booking.source}:${booking.id}`;

export default function PnlCheckInActions({ bookings, onSent, onBusyChange }: {
  bookings: api.PnlBooking[];
  onSent: (key: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<api.PnlBooking[]>([]);
  const [mode, setMode] = useState<"desk" | "self">("desk");
  const [options, setOptions] = useState<Record<string, Options>>({});
  const [results, setResults] = useState<Record<string, Result>>({});
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const remaining = targets.filter((booking) => !results[keyOf(booking)]?.sent);

  const begin = () => {
    setTargets(bookings);
    setMode("desk");
    setOptions({});
    setResults({});
    setError("");
    setOpen(true);
  };
  const getOptions = (key: string): Options => options[key] || { accessCode: "", locker: "", breakfastIncluded: true };
  const updateOptions = (key: string, value: Partial<Options>) => setOptions((previous) => ({
    ...previous, [key]: { ...(previous[key] || { accessCode: "", locker: "", breakfastIncluded: true }), ...value },
  }));
  const send = async () => {
    if (mode === "self" && remaining.some((booking) => {
      const option = getOptions(keyOf(booking));
      return !/^[a-zA-Z0-9_-]{1,80}$/.test(option.accessCode) || !/^(\d{1,2})?$/.test(option.locker);
    })) {
      setError("Enter an access code for every unsent booking and an optional one- or two-digit locker number.");
      return;
    }
    if (!window.confirm(`Send ${mode === "self" ? "self check-in links" : "desk check-in instructions"} to ${remaining.length} selected guest(s)? Check the recipients and access codes first.`)) return;
    setError("");
    setSending(true);
    onBusyChange(true);
    try {
      for (const booking of remaining) {
        const key = keyOf(booking);
        if (booking.source === "recorded") continue;
        try {
          await api.sendPnlCheckInInvitation(mode === "desk"
            ? { source: booking.source, id: booking.id, expectedEmail: booking.email, mode }
            : { source: booking.source, id: booking.id, expectedEmail: booking.email, mode, ...getOptions(key) });
          setResults((previous) => ({ ...previous, [key]: { sent: true, message: "Accepted for sending" } }));
          onSent(key);
        } catch (failure) {
          const responseMessage = axios.isAxiosError<{ message?: string }>(failure) && failure.response?.status &&
            failure.response.status >= 400 && failure.response.status < 500 ? failure.response.data?.message : undefined;
          setResults((previous) => ({ ...previous, [key]: {
            sent: false, message: responseMessage || "Delivery not confirmed. Check sent mail before retrying.",
          } }));
        }
      }
    } finally {
      setSending(false);
      onBusyChange(false);
    }
  };

  return <>
    <Button size="sm" variant="outline" disabled={!bookings.length || sending} onClick={begin}>Check-in actions ({bookings.length})</Button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent overlayClassName="z-[110] bg-black/40" className="z-[120] w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Check-in actions</SheetTitle>
          <SheetDescription>Review selected bookings. Desk procedures are for staff; emails go to each guest separately.</SheetDescription>
        </SheetHeader>
        <fieldset className="mt-4 flex flex-wrap gap-4 text-sm">
          <legend className="font-medium">Check-in type</legend>
          <label><input type="radio" name="checkin-mode" checked={mode === "desk"} disabled={sending || Object.values(results).some((result) => result.sent)} onChange={() => setMode("desk")} /> Desk check-in</label>
          <label><input type="radio" name="checkin-mode" checked={mode === "self"} disabled={sending || Object.values(results).some((result) => result.sent)} onChange={() => setMode("self")} /> Self check-in</label>
        </fieldset>
        {mode === "self" && <p className="mt-3 text-sm text-amber-800">Enter the actual access code for each booking. The guest link contains this code; keep it private. Self check-in submissions do not automatically update the booking.</p>}
        <div className="mt-4 space-y-3">
          {targets.map((booking) => {
            const key = keyOf(booking);
            const option = getOptions(key);
            const result = results[key];
            return <div key={key} className="rounded border border-slate-200 p-3 text-sm">
              <p className="font-semibold">{booking.guestName || "Guest"} · {booking.reference || booking.id}</p>
              <p>{booking.email || "No guest email"} · {booking.checkIn}</p>
              {booking.roomId && <a className="text-teal-700 underline" target="_blank" rel="noopener noreferrer" href={`/hotel/${encodeURIComponent(booking.roomId)}/check-in/${encodeURIComponent(booking.id)}`}>Open staff check-in procedure</a>}
              {mode === "self" && !result?.sent && <div className="mt-2 flex flex-wrap items-end gap-3">
                <label>Access code <input aria-label={`Access code for ${booking.reference}`} type="password" autoComplete="off" maxLength={80} disabled={sending} value={option.accessCode} onChange={(event) => updateOptions(key, { accessCode: event.target.value })} className="block rounded border border-slate-300 px-2 py-1" /></label>
                <label>Locker <input aria-label={`Locker for ${booking.reference}`} inputMode="numeric" maxLength={2} disabled={sending} value={option.locker} onChange={(event) => updateOptions(key, { locker: event.target.value })} className="block w-20 rounded border border-slate-300 px-2 py-1" /></label>
                <label><input type="checkbox" checked={option.breakfastIncluded} disabled={sending} onChange={(event) => updateOptions(key, { breakfastIncluded: event.target.checked })} /> Breakfast included</label>
              </div>}
              {result && <p role={result.sent ? "status" : "alert"} className={`mt-2 ${result.sent ? "text-emerald-700" : "text-rose-700"}`}>{result.message}</p>}
            </div>;
          })}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
        <Button className="mt-4" disabled={sending || remaining.length === 0} onClick={() => void send()}>{sending ? "Sending…" : `Send email to ${remaining.length} guest(s)`}</Button>
      </SheetContent>
    </Sheet>
  </>;
}
