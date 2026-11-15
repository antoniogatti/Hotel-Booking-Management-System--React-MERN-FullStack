import { Link } from "react-router-dom";
import { useQuery } from "react-query";
import {
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

  const traffic = useQuery(
    ["traffic-insights-dashboard", 7],
    () => apiClient.fetchTrafficInsightsDashboard(7),
    { enabled: userRole === "admin", retry: false }
  );

  const syncSummary = upcomingData?.summary.sync;
  const syncTone = syncSummary?.issueRooms ? "text-amber-700" : "text-emerald-700";
  const todayRows = (upcomingData?.rows || []).filter((row) => isToday(row.checkIn));
  const previewRows = upcomingData?.rows.slice(0, 5) || [];

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-9">
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

        {userRole === "admin" && (
          <section aria-labelledby="traffic-overview-heading" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="traffic-overview-heading" className="text-xl font-semibold text-slate-900">Traffic insights</h2>
                <p className="mt-1 text-sm text-slate-500">Public website and API activity over the last 24 hours.</p>
              </div>
              <Link to="/traffic-insights" className="text-sm font-semibold text-teal-700 hover:text-teal-800">
                View traffic dashboard
              </Link>
            </div>
            {traffic.isLoading ? (
              <p role="status" className="mt-5 text-sm text-slate-500">Loading traffic insights...</p>
            ) : traffic.isError ? (
              <div role="alert" className="mt-5 flex flex-wrap items-center gap-3 text-sm text-rose-700">
                <span>Unable to load traffic insights. Check the traffic dashboard for details.</span>
                <Button variant="outline" size="sm" onClick={() => traffic.refetch()}>Retry traffic insights</Button>
              </div>
            ) : traffic.data && (
              <dl className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                  ["Page views", traffic.data.metrics.pageViews24h],
                  ["Unique visitors", traffic.data.metrics.uniqueVisitors24h],
                  ["API requests", traffic.data.metrics.requestCount24h],
                  ["Failed requests", traffic.data.metrics.failedRequests24h],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-4">
                    <dt className="text-sm text-slate-600">{label}</dt>
                    <dd className="mt-1 text-2xl font-semibold text-slate-900">{value.toLocaleString()}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        )}

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

        <section>
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

        </section>
    </div>
  );
};

export default AdminPortal;