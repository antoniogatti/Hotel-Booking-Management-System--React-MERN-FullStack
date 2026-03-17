import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "react-query";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  CalendarDays,
  Check,
  Table2,
  X,
  Lock,
  Unlock,
  RefreshCw,
  LogIn,
} from "lucide-react";
import {
  BookingCalendarDayStatus,
  BookingCalendarResponseType,
} from "../../../shared/types";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useQueryWithLoading } from "../hooks/useLoadingHooks";
import useAppContext from "../hooks/useAppContext";
import * as apiClient from "../api-client";
import { formatFriendlyDate } from "../lib/utils";

type ViewMode = "calendar" | "table";

const STATUS_STYLES: Record<BookingCalendarDayStatus, string> = {
  Available: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Requested: "bg-amber-100 text-amber-800 border-amber-200",
  Booked: "bg-blue-100 text-blue-800 border-blue-200",
  Closed: "bg-rose-100 text-rose-800 border-rose-200",
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const formatDateLabel = (dateIso: string) => formatFriendlyDate(dateIso);

const toMonthLabel = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
};

const buildMonthDays = (month: string, calendarData?: BookingCalendarResponseType) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 0));
  const firstWeekday = (start.getUTCDay() + 6) % 7;

  const byDate = new Map((calendarData?.days || []).map((day) => [day.date, day]));
  const cells: Array<{
    date?: string;
    dayNumber?: number;
    status?: BookingCalendarDayStatus;
    requestedCount?: number;
    bookedCount?: number;
  }> = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({});
  }

  for (let day = 1; day <= end.getUTCDate(); day += 1) {
    const date = new Date(Date.UTC(year, monthNumber - 1, day));
    const dateKey = date.toISOString().slice(0, 10);
    const info = byDate.get(dateKey);

    cells.push({
      date: dateKey,
      dayNumber: day,
      status: info?.status || "Available",
      requestedCount: info?.requestedCount || 0,
      bookedCount: info?.bookedCount || 0,
    });
  }

  return cells;
};

const ManageBookings = () => {
  const { showToast } = useAppContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().slice(0, 10));
  const [closeReason, setCloseReason] = useState("");

  const { data: rooms, isLoading: roomsLoading } = useQueryWithLoading(
    ["bookingManagementRooms"],
    apiClient.fetchBookingManagementRooms,
    {
      loadingMessage: "Loading managed rooms...",
    }
  );

  useEffect(() => {
    if (!selectedRoomId && rooms && rooms.length > 0) {
      setSelectedRoomId(rooms[0]._id);
    }
  }, [rooms, selectedRoomId]);

  const {
    data: calendarData,
    isLoading: calendarLoading,
    refetch,
  } = useQueryWithLoading(
    ["bookingRoomCalendar", selectedRoomId, selectedMonth],
    () => apiClient.fetchRoomBookingCalendar(selectedRoomId, selectedMonth),
    {
      enabled: Boolean(selectedRoomId),
      loadingMessage: "Loading room booking calendar...",
    }
  );

  const refreshCalendar = async () => {
    await queryClient.invalidateQueries(["bookingRoomCalendar", selectedRoomId, selectedMonth]);
    await refetch();
  };

  const updateDayMutation = useMutation(apiClient.updateRoomDayStatus, {
    onSuccess: async () => {
      showToast({ title: "Day status updated", type: "SUCCESS" });
      await refreshCalendar();
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        "Unable to update day status";
      showToast({ title: message, type: "ERROR" });
    },
  });

  const bookingDecisionMutation = useMutation(apiClient.processRequestedBooking, {
    onSuccess: async (result: any) => {
      const warningText = result?.warning ? ` ${result.warning}` : "";
      showToast({ title: `Booking updated.${warningText}`.trim(), type: "SUCCESS" });
      await refreshCalendar();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || "Unable to process request";
      showToast({ title: message, type: "ERROR" });
    },
  });

  const calendarCells = useMemo(
    () => buildMonthDays(selectedMonth, calendarData),
    [selectedMonth, calendarData]
  );

  const selectedDayInfo = useMemo(
    () => calendarData?.days.find((day) => day.date === selectedDay),
    [calendarData, selectedDay]
  );

  useEffect(() => {
    if (selectedDayInfo?.status === "Closed") {
      setCloseReason(selectedDayInfo.closedReason || "");
    } else {
      setCloseReason("");
    }
  }, [selectedDayInfo?.status, selectedDayInfo?.closedReason, selectedDay]);

  const selectedDayBookings = useMemo(() => {
    if (!calendarData?.bookings) {
      return [];
    }

    const target = new Date(`${selectedDay}T00:00:00.000Z`).getTime();

    return calendarData.bookings.filter((booking) => {
      const checkIn = new Date(booking.checkIn).getTime();
      const checkOut = new Date(booking.checkOut).getTime();
      return checkIn <= target && target < checkOut;
    });
  }, [calendarData?.bookings, selectedDay]);

  const requestedCount =
    calendarData?.bookings.filter((booking) => booking.status === "Requested").length || 0;
  const bookedCount =
    calendarData?.bookings.filter((booking) => booking.status === "Booked").length || 0;

  const handleConfirm = (bookingId: string) => {
    bookingDecisionMutation.mutate({ bookingId, action: "confirm" });
  };

  const handleReject = (bookingId: string) => {
    const reason = window.prompt("Optional reason for rejection:", "");
    bookingDecisionMutation.mutate({
      bookingId,
      action: "reject",
      reason: reason || undefined,
    });
  };

  const setSelectedDayClosed = (close: boolean) => {
    if (!selectedRoomId || !selectedDay) {
      return;
    }

    const reason = closeReason.trim();
    if (close && !reason) {
      showToast({
        title: "Please add a reason before closing this day",
        type: "ERROR",
      });
      return;
    }

    updateDayMutation.mutate({
      hotelId: selectedRoomId,
      date: selectedDay,
      status: close ? "closed" : "available",
      note: close ? reason : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">Manage Bookings</h1>
        <p className="text-gray-600">
          Backoffice booking calendar and request handling by room.
        </p>
      </div>

      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Building2 className="h-5 w-5 text-primary-600" />
            Room Scope
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label className="text-sm font-semibold text-gray-700">Room</label>
            <select
              className="w-full mt-1 px-3 py-2 rounded-md border border-gray-300"
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              disabled={roomsLoading || !rooms || rooms.length === 0}
            >
              {rooms?.map((room) => (
                <option key={room._id} value={room._id}>
                  {room.name} - {room.city}, {room.country}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Month</label>
            <input
              type="month"
              className="w-full mt-1 px-3 py-2 rounded-md border border-gray-300"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <Button
              variant="secondary"
              className="w-full"
              onClick={refreshCalendar}
              disabled={calendarLoading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Current Month</p>
            <p className="text-lg font-bold text-gray-900">{toMonthLabel(selectedMonth)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Requested</p>
            <p className="text-lg font-bold text-amber-700">{requestedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Booked</p>
            <p className="text-lg font-bold text-blue-700">{bookedCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          <Button
            variant={viewMode === "calendar" ? "default" : "secondary"}
            onClick={() => setViewMode("calendar")}
          >
            <CalendarDays className="h-4 w-4 mr-2" />
            Calendar View
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "secondary"}
            onClick={() => setViewMode("table")}
          >
            <Table2 className="h-4 w-4 mr-2" />
            Table View
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {(["Available", "Requested", "Booked", "Closed"] as BookingCalendarDayStatus[]).map(
              (status) => (
                <Badge key={status} className={STATUS_STYLES[status]}>
                  {status}
                </Badge>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {viewMode === "calendar" ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>{calendarData?.room?.name || "Room Calendar"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2 mb-2">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="text-xs font-bold text-gray-600 text-center py-1">
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {calendarCells.map((cell, index) => {
                  if (!cell.date) {
                    return <div key={`empty-${index}`} className="h-20 rounded-md bg-gray-50" />;
                  }

                  const isSelected = selectedDay === cell.date;
                  const status = cell.status || "Available";

                  return (
                    <button
                      key={cell.date}
                      onClick={() => setSelectedDay(cell.date!)}
                      className={`h-20 rounded-md border p-2 text-left transition-all ${
                        isSelected ? "ring-2 ring-primary-500 border-primary-500" : "border-gray-200"
                      } ${status === "Closed" ? "bg-rose-50" : "bg-white"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-900">{cell.dayNumber}</span>
                      </div>
                      <div className="mt-1">
                        <Badge className={`${STATUS_STYLES[status]} text-[10px] px-2 py-0.5`}>
                          {status}
                        </Badge>
                      </div>
                      {(cell.requestedCount || cell.bookedCount) && (
                        <p className="mt-1 text-[10px] text-gray-600">
                          {cell.requestedCount ? `${cell.requestedCount} req` : ""}
                          {cell.requestedCount && cell.bookedCount ? " · " : ""}
                          {cell.bookedCount ? `${cell.bookedCount} booked` : ""}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Day Control</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Selected Day</p>
                <p className="font-semibold text-gray-900">{formatDateLabel(selectedDay)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Current Status</p>
                <Badge className={STATUS_STYLES[selectedDayInfo?.status || "Available"]}>
                  {selectedDayInfo?.status || "Available"}
                </Badge>
              </div>
              {selectedDayInfo?.status !== "Requested" &&
                selectedDayInfo?.status !== "Booked" && (
                <>
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Close Day Reason</label>
                    <textarea
                      className="w-full mt-1 rounded-md border border-gray-300 p-2 text-sm"
                      rows={3}
                      placeholder="Write why this day is closed..."
                      value={closeReason}
                      onChange={(e) => setCloseReason(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Required when setting a day to Closed.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      variant="destructive"
                      onClick={() => setSelectedDayClosed(true)}
                      disabled={selectedDayInfo?.status === "Closed" || updateDayMutation.isLoading}
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      Mark As Closed
                    </Button>
                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={() => setSelectedDayClosed(false)}
                      disabled={selectedDayInfo?.status !== "Closed" || updateDayMutation.isLoading}
                    >
                      <Unlock className="h-4 w-4 mr-2" />
                      Reopen Day
                    </Button>
                  </div>
                </>
              )}

              {(selectedDayInfo?.status === "Requested" ||
                selectedDayInfo?.status === "Booked") && (
                <div className="pt-2 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Bookings on Selected Day
                  </h3>
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {selectedDayBookings.length > 0 ? (
                      selectedDayBookings.map((booking) => (
                        <div
                          key={booking._id}
                          className="rounded-md border border-gray-200 p-3 bg-gray-50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900">
                              {booking.firstName} {booking.lastName}
                            </p>
                            <Badge className={STATUS_STYLES[booking.status]}>
                              {booking.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-700 mt-1">{booking.email}</p>
                          {booking.phone && (
                            <p className="text-xs text-gray-700">{booking.phone}</p>
                          )}
                          <p className="text-xs text-gray-700 mt-1">
                            Ref: {booking.reservationNumber || "N/A"}
                          </p>
                          <p className="text-xs text-gray-700">
                            Stay: {formatDateLabel(String(booking.checkIn))} to {" "}
                            {formatDateLabel(String(booking.checkOut))}
                          </p>
                          <p className="text-xs font-semibold text-gray-900 mt-1">
                            EUR {booking.totalCost}
                          </p>

                          {booking.status === "Requested" && (
                            <div className="mt-2 flex items-center gap-2">
                              <Button
                                size="sm"
                                className="h-8"
                                onClick={() => handleConfirm(booking._id)}
                                disabled={bookingDecisionMutation.isLoading}
                              >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-8"
                                onClick={() => handleReject(booking._id)}
                                disabled={bookingDecisionMutation.isLoading}
                              >
                                <X className="h-3.5 w-3.5 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}

                          {booking.status === "Booked" && (
                            <div className="mt-2">
                              <Button
                                size="sm"
                                className="w-full h-8"
                                onClick={() =>
                                  navigate(
                                    `/hotel/${selectedRoomId}/check-in/${booking._id}`
                                  )
                                }
                              >
                                <LogIn className="h-3.5 w-3.5 mr-1" />
                                Check-in
                              </Button>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-600">No bookings found for this day.</p>
                    )}
                  </div>
                </div>
              )}

              {selectedDayInfo?.status === "Closed" && selectedDayInfo.closedReason && (
                <div className="pt-2 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Closed Reason</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedDayInfo.closedReason}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Booking Requests and Reservations</CardTitle>
          </CardHeader>
          <CardContent>
            {calendarData?.bookings && calendarData.bookings.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-600">
                      <th className="py-3 px-2">Reference</th>
                      <th className="py-3 px-2">Guest</th>
                      <th className="py-3 px-2">Stay</th>
                      <th className="py-3 px-2">Status</th>
                      <th className="py-3 px-2">Total</th>
                      <th className="py-3 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calendarData.bookings.map((booking) => (
                      <tr key={booking._id} className="border-b border-gray-100 text-sm">
                        <td className="py-3 px-2 font-mono text-xs text-gray-700">
                          {booking.reservationNumber || "N/A"}
                        </td>
                        <td className="py-3 px-2">
                          <p className="font-semibold text-gray-900">
                            {booking.firstName} {booking.lastName}
                          </p>
                          <p className="text-xs text-gray-600">{booking.email}</p>
                        </td>
                        <td className="py-3 px-2">
                          <p className="text-gray-900">{formatDateLabel(String(booking.checkIn))}</p>
                          <p className="text-xs text-gray-600">to {formatDateLabel(String(booking.checkOut))}</p>
                        </td>
                        <td className="py-3 px-2">
                          <Badge className={STATUS_STYLES[booking.status]}>{booking.status}</Badge>
                        </td>
                        <td className="py-3 px-2 font-semibold text-gray-900">EUR {booking.totalCost}</td>
                        <td className="py-3 px-2">
                          {booking.status === "Requested" ? (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                className="h-8"
                                onClick={() => handleConfirm(booking._id)}
                                disabled={bookingDecisionMutation.isLoading}
                              >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-8"
                                onClick={() => handleReject(booking._id)}
                                disabled={bookingDecisionMutation.isLoading}
                              >
                                <X className="h-3.5 w-3.5 mr-1" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">No action</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-600">No bookings in this room and month.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ManageBookings;
