import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "react-query";
import { ArrowLeft, CalendarClock, CheckCircle2, Mail, MessageCircleMore, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useQueryWithLoading } from "../hooks/useLoadingHooks";
import * as apiClient from "../api-client";

const statusBadgeClass = (isCheckedIn: boolean) =>
  isCheckedIn
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700";

const statusLabel = (isCheckedIn: boolean) =>
  isCheckedIn ? "Checked in" : "Pending check-in";

const actionLinkClass =
  "inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors";

const formatDateTime = (value?: string) => {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatStayDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const getGuestName = (row: apiClient.UpcomingCheckInRow) => {
  const fullName = `${row.firstName} ${row.lastName}`.trim();
  return fullName || row.sourceLabel;
};

const getChannelLabel = (row: apiClient.UpcomingCheckInRow) =>
  row.sourceLabel || (row.source === "local" ? "Direct" : "Imported");

const getWhatsappHref = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
};

type CheckInStatusFilter = "all" | "needs-action" | "checked-in";
type HorizonFilter = "1" | "7" | "14" | "30" | "past";

const AdminPortalCheckIns = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedHotelId, setSelectedHotelId] = useState(searchParams.get("hotelId") || "");
  const [horizon, setHorizon] = useState<HorizonFilter>(() => {
    const requestedHorizon = searchParams.get("horizon");
    if (requestedHorizon === "past") {
      return "past";
    }

    const requestedDays = searchParams.get("days");
    return requestedDays === "7" || requestedDays === "14" || requestedDays === "30"
      ? requestedDays
      : "1";
  });
  const [statusFilter, setStatusFilter] = useState<CheckInStatusFilter>(() => {
    const requested = searchParams.get("status");
    return requested === "needs-action" || requested === "checked-in" ? requested : "all";
  });

  const { data: rooms } = useQueryWithLoading(
    ["bookingManagementRooms"],
    apiClient.fetchBookingManagementRooms,
    {
      loadingMessage: "Loading check-in desk...",
    }
  );

  const { data, isLoading } = useQuery(
    ["upcomingCheckIns", horizon, selectedHotelId],
    () =>
      apiClient.fetchUpcomingCheckIns({
        days: horizon === "past" ? undefined : Number(horizon),
        horizon: horizon === "past" ? "past" : "upcoming",
        hotelId: selectedHotelId || undefined,
      })
  );

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (selectedHotelId) nextParams.set("hotelId", selectedHotelId);
    if (horizon === "past") {
      nextParams.set("horizon", "past");
    } else {
      nextParams.set("days", horizon);
    }
    if (statusFilter !== "all") nextParams.set("status", statusFilter);
    setSearchParams(nextParams, { replace: true });
  }, [horizon, selectedHotelId, setSearchParams, statusFilter]);

  const rows = useMemo(() => {
    const baseRows = data?.rows || [];

    if (statusFilter === "needs-action") {
      return baseRows.filter((row) => !row.isCheckedIn);
    }

    if (statusFilter === "checked-in") {
      return baseRows.filter((row) => row.isCheckedIn);
    }

    return baseRows;
  }, [data, statusFilter]);

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link to="/admin-portal" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-800">
              <ArrowLeft className="h-4 w-4" />
              Back to Admin Portal
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Check-In Desk</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Upcoming arrivals with room, arrival time, WhatsApp, email, and direct access to booking updates or the check-in procedure.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:min-w-[32rem]">
            <label className="text-sm font-medium text-slate-700">
              Room
              <select
                value={selectedHotelId}
                onChange={(event) => setSelectedHotelId(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">All rooms</option>
                {rooms?.map((room) => (
                  <option key={room._id} value={room._id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Horizon
              <select
                value={horizon}
                onChange={(event) => setHorizon(event.target.value as HorizonFilter)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="1">Today</option>
                <option value="7">Next 7 days</option>
                <option value="14">Next 14 days</option>
                <option value="30">Next 30 days</option>
                <option value="past">All Past</option>
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as CheckInStatusFilter)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="all">All rows</option>
                <option value="needs-action">Needs check-in</option>
                <option value="checked-in">Already checked in</option>
              </select>
            </label>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Arrivals Today</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">{data?.summary.arrivalsToday || 0}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Checked In Today</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">{data?.summary.checkedInToday || 0}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl sm:col-span-2 xl:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Stays In House</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">{data?.summary.inHouseToday || 0}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate-900 sm:text-xl">
              <CalendarClock className="h-5 w-5 text-teal-600" />
              {horizon === "past" ? "Past bookings table" : "Upcoming arrivals table"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-slate-500">
                {horizon === "past" ? "Loading past bookings..." : "Loading arrivals..."}
              </p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-slate-500">
                {horizon === "past"
                  ? "No past bookings match the current filters."
                  : "No arrivals match the current filters."}
              </p>
            ) : (
              <>
                <div className="space-y-4 md:hidden">
                  {rows.map((row) => {
                    const whatsappHref = getWhatsappHref(row.phone);
                    return (
                      <article
                        key={row._id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-slate-900">{getGuestName(row)}</p>
                            <p className="mt-1 text-sm font-medium text-slate-700">{row.hotelName}</p>
                            <p className="truncate text-xs text-slate-500">{row.reservationNumber}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(row.isCheckedIn)}`}>
                            {statusLabel(row.isCheckedIn)}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {getChannelLabel(row)}
                          </span>
                          <span className="inline-flex rounded-full bg-[#eef7f6] px-2.5 py-1 text-xs font-semibold text-teal-700">
                            Arrival {row.arrivalTime || "Missing"}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-3 sm:grid-cols-2">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Stay</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{formatStayDate(row.checkIn)}</p>
                            <p className="text-sm text-slate-600">{formatStayDate(row.checkOut)}</p>
                            {row.checkedInAt && (
                              <p className="mt-1 text-xs text-slate-500">Checked in at {formatDateTime(row.checkedInAt)}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Location</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{row.hotelName}</p>
                            <p className="text-sm text-slate-600">
                              {row.hotelCity}{row.hotelCountry ? `, ${row.hotelCountry}` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Contact</p>
                          <div className="flex flex-wrap gap-2">
                            {row.phone ? (
                              <>
                                <a href={`tel:${row.phone}`} className={`${actionLinkClass} bg-teal-50 text-teal-700 hover:bg-teal-100`}>
                                  <Phone className="h-4 w-4" />
                                  Call
                                </a>
                                {whatsappHref && (
                                  <a
                                    href={whatsappHref}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`${actionLinkClass} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
                                  >
                                    <MessageCircleMore className="h-4 w-4" />
                                    WhatsApp
                                  </a>
                                )}
                              </>
                            ) : (
                              <span className="text-sm text-slate-400">No phone</span>
                            )}
                            {row.email ? (
                              <a
                                href={`mailto:${row.email}`}
                                className={`${actionLinkClass} bg-sky-50 text-sky-700 hover:bg-sky-100`}
                              >
                                <Mail className="h-4 w-4" />
                                Email guest
                              </a>
                            ) : (
                              <span className="text-sm text-slate-400">No email</span>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2">
                          <Button asChild variant="secondary" size="sm" className="w-full justify-center sm:justify-start">
                            <Link to={`/booking/${row._id}`}>
                              Update booking
                            </Link>
                          </Button>
                          <Button asChild size="sm" className="w-full justify-center bg-[#ea836c] hover:bg-[#db755f] sm:justify-start">
                            <Link to={`/hotel/${row.hotelId}/check-in/${row._id}`}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Check-In procedure
                            </Link>
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-[980px] divide-y divide-slate-200 text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3">Room</th>
                      <th className="px-3 py-3">Channel / Guest</th>
                      <th className="px-3 py-3">Stay</th>
                      <th className="px-3 py-3">Arrival</th>
                      <th className="px-3 py-3">Contact</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => {
                      const whatsappHref = getWhatsappHref(row.phone);
                      return (
                        <tr key={row._id} className="align-top">
                          <td className="px-3 py-4 text-slate-700">
                            <div className="font-semibold text-slate-900">{row.hotelName}</div>
                            <div className="text-xs text-slate-500">
                              {row.hotelCity}{row.hotelCountry ? `, ${row.hotelCountry}` : ""}
                            </div>
                          </td>
                          <td className="px-3 py-4 text-slate-700">
                            <div className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                              {getChannelLabel(row)}
                            </div>
                            <div className="mt-2 font-semibold text-slate-900">{getGuestName(row)}</div>
                            <div className="text-xs text-slate-500">{row.reservationNumber}</div>
                          </td>
                          <td className="px-3 py-4 text-slate-700">
                            <div className="font-semibold text-slate-900">{formatStayDate(row.checkIn)}</div>
                            <div>{formatStayDate(row.checkOut)}</div>
                            <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(row.isCheckedIn)}`}>
                              {statusLabel(row.isCheckedIn)}
                            </div>
                            {row.checkedInAt && (
                              <div className="mt-1 text-xs text-slate-500">{formatDateTime(row.checkedInAt)}</div>
                            )}
                          </td>
                          <td className="px-3 py-4 text-slate-700">
                            <div className="font-semibold text-slate-900">{row.arrivalTime || "Missing"}</div>
                            <div className="text-xs text-slate-500">Status: {row.isCheckedIn ? "Checked in" : "Awaiting check-in"}</div>
                          </td>
                          <td className="px-3 py-4 text-slate-700">
                            <div className="space-y-2">
                              {row.phone ? (
                                <div className="flex flex-wrap gap-2">
                                  <a href={`tel:${row.phone}`} className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-800">
                                    <Phone className="h-4 w-4" />
                                    Call
                                  </a>
                                  {whatsappHref && (
                                    <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800">
                                      <MessageCircleMore className="h-4 w-4" />
                                      WhatsApp
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">No phone</span>
                              )}
                              {row.email ? (
                                <a href={`mailto:${row.email}`} className="inline-flex items-center gap-1 text-sky-700 hover:text-sky-800">
                                  <Mail className="h-4 w-4" />
                                  Email guest
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400">No email</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex flex-col gap-2">
                              <Button asChild variant="secondary" size="sm" className="w-full justify-start">
                                <Link to={`/booking/${row._id}`}>
                                  Update booking
                                </Link>
                              </Button>
                              <Button asChild size="sm" className="w-full justify-start bg-[#ea836c] hover:bg-[#db755f]">
                                <Link to={`/hotel/${row.hotelId}/check-in/${row._id}`}>
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Check-In procedure
                                </Link>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPortalCheckIns;