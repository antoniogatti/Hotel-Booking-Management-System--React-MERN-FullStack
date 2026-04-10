import { Link } from "react-router-dom";
import { useQuery } from "react-query";
import {
  ArrowRight,
  BedDouble,
  CalendarClock,
  Clock3,
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.14),_transparent_35%),linear-gradient(180deg,#f8fbfb_0%,#eef5f4_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700">
                <Shield className="h-4 w-4" />
                Admin Portal
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">Operations at a glance</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                One landing page for sync status, arrivals, and active stays. The focus is front-desk work, not room management.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/admin-portal/check-in">
                <Button className="bg-[#ea836c] hover:bg-[#db755f]">
                  <CalendarClock className="mr-2 h-4 w-4" />
                  Open Check-In Desk
                </Button>
              </Link>
              {userRole === "admin" && (
                <Link to="/booking-com-sync">
                  <Button variant="secondary">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Open Sync Center
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Link to="/booking-com-sync#sync-errors" className="block transition-transform hover:-translate-y-0.5">
            <Card className="border-0 shadow-lg shadow-slate-200/60 hover:shadow-xl hover:shadow-slate-200/80">
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
            <Card className="border-0 shadow-lg shadow-slate-200/60 hover:shadow-xl hover:shadow-slate-200/80">
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
            <Card className="border-0 shadow-lg shadow-slate-200/60 hover:shadow-xl hover:shadow-slate-200/80">
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
            <Card className="border-0 shadow-lg shadow-slate-200/60 hover:shadow-xl hover:shadow-slate-200/80">
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
          <Card className="overflow-hidden border-0 shadow-lg shadow-orange-200/40">
            <div className="bg-[linear-gradient(135deg,#fff1eb_0%,#ffe4d6_100%)]">
              <CardHeader className="border-b border-orange-200/70 pb-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-2xl text-slate-900">Today&apos;s arrivals</CardTitle>
                    <p className="mt-1 text-sm text-slate-700">
                      Immediate front-desk queue for guests arriving today.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-sm">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Today</p>
                      <p className="text-3xl font-bold text-slate-900">{todayRows.length}</p>
                    </div>
                    <div className="h-10 w-px bg-orange-200" />
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
                  <div className="rounded-2xl border border-dashed border-orange-200 bg-white/70 px-4 py-6 text-sm text-slate-600">
                    No new arrivals scheduled for today.
                  </div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {todayRows.map((row) => (
                      <div
                        key={row._id}
                        className="rounded-2xl border border-orange-200 bg-white/90 p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold text-slate-900">{getGuestName(row)}</p>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                {getChannelLabel(row)}
                              </span>
                            </div>
                            <p className="mt-1 text-sm font-medium text-slate-700">{row.hotelName}</p>
                            <p className="text-xs text-slate-500">
                              Arrival time: {row.arrivalTime || "Missing"}
                            </p>
                          </div>
                          <div
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${row.isCheckedIn ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}
                          >
                            {row.isCheckedIn ? "Checked in" : "Arriving today"}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link to={`/hotel/${row.hotelId}/check-in/${row._id}`}>
                            <Button size="sm" className="bg-[#ea836c] hover:bg-[#db755f]">
                              Start check-in
                            </Button>
                          </Link>
                          <Link to="/admin-portal/check-in">
                            <Button size="sm" variant="secondary">
                              Update Booking
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </div>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-0 shadow-lg shadow-slate-200/60">
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
                      className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{row.hotelName}</p>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
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
                        <Link to={`/booking/${row._id}`}>
                          <Button size="sm" className="bg-slate-900 hover:bg-slate-800">
                            Update Booking
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg shadow-slate-200/60">
            <CardHeader>
              <CardTitle className="text-xl text-slate-900">Sections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link
                to="/admin-portal/check-in"
                className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 transition hover:border-teal-300 hover:bg-teal-50/60"
              >
                <div>
                  <p className="font-semibold text-slate-900">Check-In Desk</p>
                  <p className="text-sm text-slate-600">Upcoming arrivals, WhatsApp, email, and check-in actions.</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </Link>

              <Link
                to="/booking-dashboard"
                className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 transition hover:border-teal-300 hover:bg-teal-50/60"
              >
                <div>
                  <p className="font-semibold text-slate-900">Booking Overview</p>
                  <p className="text-sm text-slate-600">Existing booking analytics and occupancy trends.</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </Link>

              {userRole === "admin" && (
                <Link
                  to="/manage-bookings"
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 transition hover:border-teal-300 hover:bg-teal-50/60"
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
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 transition hover:border-teal-300 hover:bg-teal-50/60"
                >
                  <div>
                    <p className="font-semibold text-slate-900">Sync Center</p>
                    <p className="text-sm text-slate-600">Review Booking.com sync health and last sync times.</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                </Link>
              )}

            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default AdminPortal;