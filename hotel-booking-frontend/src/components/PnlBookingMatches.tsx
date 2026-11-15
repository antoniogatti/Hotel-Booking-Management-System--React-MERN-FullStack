import { Link } from "react-router-dom";
import { PnlBooking } from "../api-client";

type Stay = Pick<PnlBooking, "source" | "reference" | "roomId" | "checkIn" | "checkOut">;
type Match = { booking: PnlBooking; evidence: string[]; rank: number };

export function possibleBookingMatches(stay: Stay, bookings: PnlBooking[]): Match[] {
  if (stay.source !== "recorded") return [];
  const reference = stay.reference.trim().toLocaleUpperCase();
  return bookings.flatMap((booking) => {
    if (booking.source === "recorded") return [];
    const sameReference = !!reference && reference === booking.reference.trim().toLocaleUpperCase();
    const sameRoom = !!stay.roomId && stay.roomId === booking.roomId;
    const sameArrival = !!stay.checkIn && stay.checkIn === booking.checkIn;
    if (!sameReference && !(sameRoom && sameArrival)) return [];
    const sameDeparture = !!stay.checkOut && stay.checkOut === booking.checkOut;
    const evidence = [
      ...(sameReference ? ["Reference matches"] : []),
      ...(sameRoom ? ["Room matches"] : ["Room differs or missing"]),
      ...(sameArrival ? ["Check-in matches"] : ["Check-in differs"]),
      ...(!stay.checkOut ? ["Check-out missing"] : sameDeparture ? ["Check-out matches"] : ["Check-out differs"]),
    ];
    return [{ booking, evidence, rank: (sameReference ? 4 : 0) + (sameRoom && sameArrival ? 2 : 0) + (sameDeparture ? 1 : 0) }];
  }).sort((a, b) => b.rank - a.rank || a.booking.reference.localeCompare(b.booking.reference) || a.booking.id.localeCompare(b.booking.id));
}

export function PnlBookingMatches({ matches }: { matches: Match[] }) {
  if (!matches.length) return <span className="text-slate-500">No suggestions</span>;
  return <ul className="space-y-2">{matches.map(({ booking, evidence }) =>
    <li key={`${booking.source}:${booking.id}`}>
      <Link to={`/booking/${booking.id}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-teal-700 underline">
        {booking.reference || "Booking"} ({booking.source === "local" ? "Site" : "Booking.com"})
      </Link>
      <span className="block text-xs text-slate-600">{booking.guestName || "Guest unavailable"} · {booking.checkIn} to {booking.checkOut}</span>
      <span className="block text-xs text-slate-600">{evidence.join(" · ")}</span>
    </li>
  )}</ul>;
}
