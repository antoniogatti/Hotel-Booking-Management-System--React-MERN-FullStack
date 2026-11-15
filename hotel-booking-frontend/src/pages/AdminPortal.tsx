import { Link, NavLink } from "react-router-dom";
import { useQuery } from "react-query";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BedDouble,
  Building2,
  CalendarDays,
  CalendarClock,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  LayoutDashboard,
  RefreshCw,
  Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useQueryWithLoading } from "../hooks/useLoadingHooks";
import useAppContext from "../hooks/useAppContext";
import * as apiClient from "../api-client";

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "No sync recorded";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "No sync recorded";
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });

const isToday = (value: string) => {
  const date = new Date(value);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

const getGuestName = (row: apiClient.UpcomingCheckInRow) => {
  const fullName = `${row.firstName} ${row.lastName}`.trim();
  return fullName || row.sourceLabel;
};

const getChannelLabel = (row: apiClient.UpcomingCheckInRow) =>
  row.sourceLabel || (row.source === "local" ? "Direct" : "Imported");

const adminNavClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-white/10 text-white"
      : "text-slate-400 hover:bg-white/5 hover:text-white"
  }`;

const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
    isActive
      ? "bg-slate-900 text-white"
      : "border border-slate-200 bg-white text-slate-600"
  }`;

const AdminPortal = () => {
  const { userRole } = useAppContext();

  const { data: rooms } = useQueryWithLoading(
    ["bookingManagementRooms"],
    apiClient.fetchBookingManagementRooms,
    {
      loadingMessage: "Loading admin portal...",
    }
  );

  const { data: upcomingData, isLoading } = useQuery(
    ["upcomingCheckIns", 7, ""],
    () => apiClient.fetchUpcomingCheckIns({ days: 7 })
  );

  const syncSummary = upcomingData?.summary.sync;
  const syncTone = syncSummary?.issueRooms ? "text-amber-700" : "text-emerald-700";
  const todayRows = (upcomingData?.rows || []).filter((row) => isToday(row.checkIn));
  const previewRows = upcomingData?.rows.slice(0, 5) || [];

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1680px] items-start">
        <aside className="sticky top-[104px] hidden h-[calc(100vh-104px)] w-60 shrink-0 flex-col bg-[#111827] px-4 py-6 lg:flex">
          <div className="mb-8 flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">Palazzo Pinto</p>
              <p className="text-xs text-slate-400">Property workspace</p>
            </div>
          </div>

          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Workspace
          </p>
          <nav aria-label="Admin navigation" className="space-y-1">
            <NavLink to="/admin-portal" end className={adminNavClass}>
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </NavLink>
            <NavLink to="/booking-dashboard" className={adminNavClass}>
              <BarChart3 className="h-4 w-4" />
              Bookings & analytics
            </NavLink>
            <NavLink to="/admin-portal/check-in" className={adminNavClass}>
              <ClipboardCheck className="h-4 w-4" />
              Check-in desk
            </NavLink>
            <NavLink to="/admin-portal/self-checkins" className={adminNavClass}>
              <FileCheck2 className="h-4 w-4" />
              Self check-in
            </NavLink>
            {userRole === "admin" && (
              <NavLink to="/manage-bookings" className={adminNavClass}>
                <CalendarDays className="h-4 w-4" />
                Room calendar
              </NavLink>
            )}
          </nav>

          {userRole === "admin" && (
            <>
              <p className="mb-2 mt-8 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Administration
              </p>
              <nav aria-label="Administration" className="space-y-1">
                <NavLink to="/booking-com-sync" className={adminNavClass}>
                  <RefreshCw className="h-4 w-4" />
                  Sync center
                </NavLink>
                <NavLink to="/scheduler-monitor" className={adminNavClass}>
                  <Clock3 className="h-4 w-4" />
                  Scheduler
                </NavLink>
                <NavLink to="/traffic-insights" className={adminNavClass}>
                  <Activity className="h-4 w-4" />
                  Traffic insights
                </NavLink>
              </nav>
            </>
          )}

          <div className="mt-auto border-t border-white/10 px-3 pt-5">
            <p className="text-xs font-medium text-slate-300">Palazzo Pinto B&B</p>
            <p className="mt-1 text-[11px] text-slate-500">Admin workspace</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-9">
        <nav aria-label="Admin navigation" className="mb-6 flex gap-2 overflow-x-auto pb-1 lg:hidden">
          <NavLink to="/admin-portal" end className={mobileNavClass}>
            Overview
          </NavLink>
          <NavLink to="/booking-dashboard" className={mobileNavClass}>
            Bookings
          </NavLink>
          <NavLink to="/admin-portal/check-in" className={mobileNavClass}>
            Check-in
          </NavLink>
          {userRole === "admin" && (
            <NavLink to="/manage-bookings" className={mobileNavClass}>
              Room calendar
            </NavLink>
          )}
        </nav>

        <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <Shield className="h-4 w-4 text-slate-700" />
                Property operations
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Operations overview</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Arrivals, in-house guests, and booking channel health in one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-slate-900 hover:bg-slate-800">
                <Link to="/admin-portal/check-in">
                  <CalendarClock className="mr-2 h-4 w-4" />
                  Check-in desk
                </Link>
              </Button>
              {userRole === "admin" && (
                <Button asChild variant="secondary">
                  <Link to="/booking-com-sync">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Open Sync Center
                  </Link>
                </Button>
              )}
              {userRole === "admin" && (
                <Button asChild variant="outline">
                  <Link to="/scheduler-monitor">
                    <Clock3 className="mr-2 h-4 w-4" />
                    Open Scheduler Monitor
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </section>

        <section aria-label="Operations metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link to="/booking-com-sync#sync-errors" className="block transition-transform hover:-translate-y-0.5">
            <Card className="h-full border border-slate-200 shadow-none transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base text-slate-700">
                  Sync Status
                  <RefreshCw className={`h-4 w-4 ${syncTone}`} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{syncSummary?.enabledRooms || 0}</div>
                <p className="mt-1 text-sm text-slate-600">rooms with Booking.com sync enabled</p>
                <p className={`mt-3 text-sm font-medium ${syncTone}`}>
                  {syncSummary?.issueRooms ? `${syncSummary.issueRooms} room sync issues` : "Sync healthy"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Last success: {formatDateTime(syncSummary?.lastSuccessfulSyncAt)}
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin-portal/check-in?days=1&status=needs-action" className="block transition-transform hover:-translate-y-0.5">
            <Card className="h-full border border-slate-200 shadow-none transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base text-slate-700">
                  Arrivals Today
                  <CalendarClock className="h-4 w-4 text-orange-600" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{upcomingData?.summary.arrivalsToday || 0}</div>
                <p className="mt-1 text-sm text-slate-600">bookings scheduled to arrive today</p>
                <p className="mt-3 text-xs text-slate-500">
                  Check-in completed today: {upcomingData?.summary.checkedInToday || 0}
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin-portal/check-in?days=1&status=checked-in" className="block transition-transform hover:-translate-y-0.5">
            <Card className="h-full border border-slate-200 shadow-none transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base text-slate-700">
                  Stays In House
                  <BedDouble className="h-4 w-4 text-indigo-600" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{upcomingData?.summary.inHouseToday || 0}</div>
                <p className="mt-1 text-sm text-slate-600">bookings currently in house</p>
                <p className="mt-3 text-xs text-slate-500">Across {rooms?.length || 0} accessible rooms</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin-portal/check-in?days=7" className="block transition-transform hover:-translate-y-0.5">
            <Card className="h-full border border-slate-200 shadow-none transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base text-slate-700">
                  Next 7 Days
                  <Clock3 className="h-4 w-4 text-teal-600" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{upcomingData?.summary.upcomingArrivals || 0}</div>
                <p className="mt-1 text-sm text-slate-600">upcoming arrivals ready for front-desk planning</p>
                <p className="mt-3 text-xs text-slate-500">Rolling view based on live room availability and imports</p>
              </CardContent>
            </Card>
          </Link>
        </section>

        <section>
          <Card className="overflow-hidden border border-slate-200 shadow-none">
            <div className="bg-white">
              <CardHeader className="border-b border-slate-200 pb-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-2xl text-slate-900">Today&apos;s arrivals</CardTitle>
                    <p className="mt-1 text-sm text-slate-500">
                      Immediate front-desk queue for guests arriving today.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Today</p>
                      <p className="text-3xl font-bold text-slate-900">{todayRows.length}</p>
                    </div>
                    <div className="h-10 w-px bg-slate-200" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Checked in</p>
                      <p className="text-3xl font-bold text-emerald-700">{upcomingData?.summary.checkedInToday || 0}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                {isLoading ? (
                  <p className="text-sm text-slate-500">Loading today&apos;s arrivals...</p>
                ) : todayRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                    No new arrivals scheduled for today.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-3 font-semibold">Guest</th>
                          <th className="px-3 py-3 font-semibold">Property</th>
                          <th className="px-3 py-3 font-semibold">Arrival</th>
                          <th className="px-3 py-3 font-semibold">Status</th>
                          <th className="px-3 py-3 text-right font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {todayRows.map((row) => (
                          <tr key={row._id} className="hover:bg-slate-50/80">
                            <td className="px-3 py-4">
                              <p className="font-semibold text-slate-900">{getGuestName(row)}</p>
                              <span className="mt-1 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                {getChannelLabel(row)}
                              </span>
                            </td>
                            <td className="px-3 py-4 font-medium text-slate-700">{row.hotelName}</td>
                            <td className="px-3 py-4 text-slate-600">{row.arrivalTime || "Time missing"}</td>
                            <td className="px-3 py-4">
                              <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${row.isCheckedIn ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                {row.isCheckedIn ? "Checked in" : "Arriving today"}
                              </span>
                            </td>
                            <td className="px-3 py-4">
                              <div className="flex justify-end gap-2">
                                <Button asChild size="sm" className="bg-slate-900 hover:bg-slate-800">
                                  <Link to={`/hotel/${row.hotelId}/check-in/${row._id}`}>
                                    Check in
                                  </Link>
                                </Button>
                                <Button asChild size="sm" variant="secondary">
                                  <Link to={`/booking/${row._id}`}>Booking</Link>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </div>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="border border-slate-200 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-xl text-slate-900">Upcoming check-ins</CardTitle>
                <p className="mt-1 text-sm text-slate-600">Fast preview of the next front-desk actions.</p>
              </div>
              <Link to="/admin-portal/check-in" className="text-sm font-semibold text-teal-700 hover:text-teal-800">
                Full desk
              </Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-slate-500">Loading upcoming arrivals...</p>
              ) : previewRows.length === 0 ? (
                <p className="text-sm text-slate-500">No arrivals scheduled in the current window.</p>
              ) : (
                <div className="space-y-3">
                  {previewRows.map((row) => (
                    <div
                      key={row._id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{row.hotelName}</p>
                          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                            {getChannelLabel(row)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">{getGuestName(row)}</p>
                        <p className="text-xs text-slate-500">
                          {formatDate(row.checkIn)} · {row.arrivalTime || "Arrival time missing"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${row.isCheckedIn ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {row.isCheckedIn ? "Checked in" : "Needs action"}
                        </div>
                        <Button asChild size="sm" className="bg-slate-900 hover:bg-slate-800">
                          <Link to={`/booking/${row._id}`}>
                            Update Booking
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-none">
            <CardHeader>
              <CardTitle className="text-xl text-slate-900">Sections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link
                to="/admin-portal/check-in"
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-4 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div>
                  <p className="font-semibold text-slate-900">Check-In Desk</p>
                  <p className="text-sm text-slate-600">Upcoming arrivals, WhatsApp, email, and check-in actions.</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </Link>

              <Link
                to="/admin-portal/self-checkins"
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-4 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div>
                  <p className="font-semibold text-slate-900">Self Check-In Submissions</p>
                  <p className="text-sm text-slate-600">Review guest self-check-in forms and uploaded ID files.</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </Link>

              {userRole === "admin" && (
                <Link
                  to="/manage-bookings"
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-4 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-semibold text-slate-900">Room Calendar</p>
                    <p className="text-sm text-slate-600">Open the Booking.com-style calendar view for each room.</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                </Link>
              )}

              {userRole === "admin" && (
                <Link
                  to="/booking-com-sync"
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-4 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-semibold text-slate-900">Sync Center</p>
                    <p className="text-sm text-slate-600">Review Booking.com sync health and last sync times.</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                </Link>
              )}

              {userRole === "admin" && (
                <Link
                  to="/scheduler-monitor"
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-4 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-semibold text-slate-900">Scheduler Monitor</p>
                    <p className="text-sm text-slate-600">Review enrichment scheduler runs with concise error codes.</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                </Link>
              )}

              {userRole === "admin" && (
                <Link
                  to="/traffic-insights"
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-4 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-semibold text-slate-900">Traffic Insights</p>
                    <p className="text-sm text-slate-600">Live visitor, device, API success-failure, and geo traffic telemetry.</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                </Link>
              )}

              <Link
                to="/booking-dashboard"
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-4 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div>
                  <p className="font-semibold text-slate-900">Dashboard</p>
                  <p className="text-sm text-slate-600">Existing booking analytics and occupancy trends.</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </Link>

            </CardContent>
          </Card>
        </section>
      </div>
      </main>
      </div>
    </div>
  );
};

export default AdminPortal;