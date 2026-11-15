import { Link } from "react-router-dom";
import { useQuery } from "react-query";
import { useState } from "react";
import * as apiClient from "../api-client";
import { currentYear, formatMoney, validYear } from "./pnl-utils";
import PnlTable, { PnlColumn } from "../components/PnlTable";
import AnalyticsDashboard from "./AnalyticsDashboard";

const months = Array.from({ length: 12 }, (_, index) =>
  new Date(2024, index, 1).toLocaleString("en-GB", { month: "short" })
);
type OverviewRow = { id: string; name: string; monthly: number[]; total: number };

const PnlOverview = () => {
  const [year, setYear] = useState(currentYear);
  const rooms = useQuery(["bookingManagementRooms"], apiClient.fetchBookingManagementRooms);
  const entries = useQuery(["pnl-entries", year], () => apiClient.fetchPnlEntries(Number(year)), { enabled: validYear(year), retry: false });
  const bookings = useQuery(["pnl-bookings", year], () => apiClient.fetchPnlBookings(Number(year)), { enabled: validYear(year), retry: false });
  const includedBookings = (bookings.data || []).filter((booking) => !booking.reason && booking.amountCents !== null);
  const excludedCount = (bookings.data || []).filter((booking) => booking.reason).length;

  const totals = (entries.data || []).reduce(
    (result, entry) => {
      result[entry.type] += entry.amountCents;
      return result;
    },
    { income: 0, expense: 0 }
  );
  totals.income += includedBookings.reduce((sum, booking) => sum + (booking.amountCents ?? 0), 0);
  const roomNames = new Map((rooms.data || []).map((room) => [room._id, room.name]));
  const keys = new Set((entries.data || []).map((entry) => entry.roomId || ""));
  includedBookings.forEach((booking) => keys.add(booking.roomId));
  (rooms.data || []).forEach((room) => keys.add(room._id));
  const rows = [...keys].sort((a, b) => {
    if (!a) return 1;
    if (!b) return -1;
    return (roomNames.get(a) || a).localeCompare(roomNames.get(b) || b);
  });
  const overviewRows: OverviewRow[] = rows.map((roomId) => {
    const monthly = Array<number>(12).fill(0);
    for (const entry of (entries.data || []).filter((item) => (item.roomId || "") === roomId)) {
      monthly[Number(entry.date.slice(5, 7)) - 1] += entry.type === "income" ? entry.amountCents : -entry.amountCents;
    }
    for (const booking of includedBookings.filter((item) => item.roomId === roomId)) {
      monthly[Number(booking.checkIn.slice(5, 7)) - 1] += booking.amountCents ?? 0;
    }
    return { id: roomId, name: roomId ? roomNames.get(roomId) || "Removed room" : "Shared / unassigned", monthly, total: monthly.reduce((sum, value) => sum + value, 0) };
  });
  const overviewColumns: PnlColumn<OverviewRow>[] = [
    { key: "room", label: "Room", width: 170, rowHeader: true, value: (row) => row.name, render: (row) => row.name },
    ...months.map((month, index): PnlColumn<OverviewRow> => ({ key: month, label: month, width: 120, align: "right", value: (row) => row.monthly[index], render: (row) => <span className={row.monthly[index] < 0 ? "text-rose-700" : "text-slate-700"}>{formatMoney(row.monthly[index])}</span> })),
    { key: "year", label: "Year", align: "right", value: (row) => row.total, render: (row) => <span className="font-semibold">{formatMoney(row.total)}</span> },
  ];

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-9">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">P&amp;L management</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Profit &amp; loss overview</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Recorded income, booking values and manual entries by room and month. Income is assigned to the check-in month and is not proof of payment. Entries are included regardless of payment status; shared costs are not allocated.</p>
        </div>
        <label className="text-sm font-medium text-slate-700">Year
          <input aria-label="Year" type="number" min="1900" max="9998" value={year} onChange={(event) => setYear(event.target.value)} className="ml-3 w-24 rounded-lg border border-slate-300 px-3 py-2" />
        </label>
      </header>
      {!validYear(year) ? <p role="alert" className="text-sm text-rose-700">Enter a year between 1900 and 9998.</p> :
        rooms.isLoading || entries.isLoading || bookings.isLoading ? <p role="status" className="text-sm text-slate-600">Loading P&amp;L overview...</p> :
        rooms.isError || entries.isError || bookings.isError ? <div role="alert" className="rounded-xl border border-rose-200 bg-white p-5 text-rose-700">Unable to load P&amp;L data. <button className="font-semibold underline" onClick={() => { void rooms.refetch(); void entries.refetch(); void bookings.refetch(); }}>Retry</button></div> :
        <>
          {excludedCount > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{excludedCount} income row{excludedCount === 1 ? "" : "s"} excluded from totals because of status, missing amounts, unconfirmed currency, possible duplicates or an administrator decision. <Link className="font-semibold underline" to="/pnl/income">Review income</Link>.</p>}
          <section aria-label="Annual P&L totals" className="grid gap-4 sm:grid-cols-3">
            {[["Estimated income", totals.income], ["Expenses", totals.expense], ["Estimated net profit / loss", totals.income - totals.expense]].map(([label, amount]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-600">{label}</p>
                <p className={`mt-2 text-2xl font-semibold ${Number(amount) < 0 ? "text-rose-700" : "text-slate-900"}`}>{formatMoney(Number(amount))}</p>
              </div>
            ))}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-xl font-semibold text-slate-900">Room and month</h2><p className="mt-1 text-sm text-slate-500">Net = income minus expenses. Select a ledger to add or edit entries.</p></div>
              <div className="flex gap-4 text-sm font-semibold text-teal-700"><Link to="/pnl/income">Manage income</Link><Link to="/pnl/expenses">Manage expenses</Link></div>
            </div>
            {entries.data?.length === 0 && bookings.data?.length === 0 && <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No bookings or manual entries for {year}.</p>}
            <PnlTable label="Room and month" columns={overviewColumns} rows={overviewRows} rowKey={(row) => row.id || "shared"} />
          </section>
        </>
      }
      <AnalyticsDashboard />
    </div>
  );
};

export default PnlOverview;
