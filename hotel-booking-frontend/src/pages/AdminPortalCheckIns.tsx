import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "react-query";
import { ArrowLeft, CalendarClock, CheckCircle2, Mail, MessageCircleMore, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useQueryWithLoading } from "../hooks/useLoadingHooks";
import * as apiClient from "../api-client";

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
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link to="/admin-portal" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-800">
              <ArrowLeft className="h-4 w-4" />
              Back to Admin Portal
            </Link>
            <h1 className="text-3xl font-bold text-slate-900">Check-In Desk</h1>
            <p className="mt-2 text-sm text-slate-600">
              Upcoming arrivals with room, arrival time, WhatsApp, email, and direct access to booking updates or the check-in procedure.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Room
              <select
                value={selectedHotelId}
                onChange={(event) => setSelectedHotelId(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
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
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
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
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All rows</option>
                <option value="needs-action">Needs check-in</option>
                <option value="checked-in">Already checked in</option>
              </select>
            </label>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Arrivals Today</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">{data?.summary.arrivalsToday || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Checked In Today</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">{data?.summary.checkedInToday || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Stays In House</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">{data?.summary.inHouseToday || 0}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
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
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
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
                            <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.isCheckedIn ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                              {row.isCheckedIn ? "Checked in" : "Pending check-in"}
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
                              <Link to={`/booking/${row._id}`}>
                                <Button variant="secondary" size="sm" className="w-full justify-start">
                                  Update booking
                                </Button>
                              </Link>
                              <Link to={`/hotel/${row.hotelId}/check-in/${row._id}`}>
                                <Button size="sm" className="w-full justify-start bg-[#ea836c] hover:bg-[#db755f]">
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Check-In procedure
                                </Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPortalCheckIns;