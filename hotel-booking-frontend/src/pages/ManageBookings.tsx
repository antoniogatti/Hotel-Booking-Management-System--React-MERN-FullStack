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
  Available: "bg-white text-slate-600 border-slate-200",
  Requested: "bg-[#f4c542] text-[#5b4300] border-[#f0bf2f]",
  Booked: "bg-[#4a6fae] text-white border-[#4a6fae]",
  Imported: "bg-[#3f67a8] text-white border-[#3f67a8]",
  Closed: "bg-[#e86a6a] text-white border-[#e86a6a]",
};

const BAR_STYLES = {
  booked: "bg-[#4a6fae] text-white shadow-[inset_0_-1px_0_rgba(255,255,255,0.15)]",
  imported: "bg-[#3f67a8] text-white shadow-[inset_0_-1px_0_rgba(255,255,255,0.12)]",
  requested: "bg-[#f4c542] text-[#5b4300] shadow-[inset_0_-1px_0_rgba(255,255,255,0.18)]",
} as const;

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BAR_ROW_HEIGHT = 32;
const BAR_VERTICAL_GAP = 6;

type CalendarCell = {
  date?: string;
  dayNumber?: number;
  status: BookingCalendarDayStatus;
  requestedCount: number;
  bookedCount: number;
  importedCount: number;
  closed: boolean;
  closedReason?: string;
  isCurrentMonth: boolean;
};

type CalendarWeek = {
  key: string;
  cells: CalendarCell[];
};

type CalendarBarTone = "booked" | "imported" | "requested";

type CalendarBar = {
  key: string;
  startCol: number;
  span: number;
  rowIndex: number;
  tone: CalendarBarTone;
  label: string;
  booking: BookingCalendarResponseType["bookings"][number];
  startRounded: boolean;
  endRounded: boolean;
};

const formatDateLabel = (dateIso: string) => formatFriendlyDate(dateIso);

const toMonthLabel = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
};

const buildCalendarWeeks = (month: string, calendarData?: BookingCalendarResponseType) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 0));
  const firstWeekday = (start.getUTCDay() + 6) % 7;

  const byDate = new Map((calendarData?.days || []).map((day) => [day.date, day]));
  const cells: CalendarCell[] = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({
      status: "Available",
      requestedCount: 0,
      bookedCount: 0,
      importedCount: 0,
      closed: false,
      isCurrentMonth: false,
    });
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
      importedCount: info?.importedCount || 0,
      closed: Boolean(info?.closed),
      closedReason: info?.closedReason,
      isCurrentMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({
      status: "Available",
      requestedCount: 0,
      bookedCount: 0,
      importedCount: 0,
      closed: false,
      isCurrentMonth: false,
    });
  }

  const weeks: CalendarWeek[] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push({
      key: `${month}-${index / 7}`,
      cells: cells.slice(index, index + 7),
    });
  }

  return weeks;
};

const getDateKey = (value: Date | string) => new Date(value).toISOString().slice(0, 10);

const subtractOneDayKey = (value: Date | string) => {
  const date = new Date(value);
  const previous = new Date(date.getTime() - 86400000);
  return previous.toISOString().slice(0, 10);
};

const buildWeekBars = (
  week: CalendarWeek,
  bookings: BookingCalendarResponseType["bookings"]
): CalendarBar[] => {
  const segments: Omit<CalendarBar, "rowIndex">[] = [];

  bookings.forEach((booking) => {
    const occupiedIndices = week.cells
      .map((cell, index) => {
        if (!cell.date) {
          return null;
        }

        const cellTime = new Date(`${cell.date}T00:00:00.000Z`).getTime();
        const startTime = new Date(booking.checkIn).getTime();
        const endTime = new Date(booking.checkOut).getTime();

        return startTime <= cellTime && cellTime < endTime ? index : null;
      })
      .filter((value): value is number => value !== null);

    if (occupiedIndices.length === 0) {
      return;
    }

    const firstIndex = occupiedIndices[0];
    const lastIndex = occupiedIndices[occupiedIndices.length - 1];
    const firstDateKey = week.cells[firstIndex].date || "";
    const lastDateKey = week.cells[lastIndex].date || "";
    const bookingStartKey = getDateKey(booking.checkIn);
    const bookingLastNightKey = subtractOneDayKey(booking.checkOut);

    const tone: CalendarBarTone =
      booking.status === "Imported"
        ? "imported"
        : booking.status === "Requested"
          ? "requested"
          : "booked";

    const label =
      booking.status === "Imported"
        ? booking.sourceLabel || "Booking.com"
        : `${booking.firstName} ${booking.lastName}`.trim();

    segments.push({
      key: `${booking._id}-${week.key}`,
      startCol: firstIndex,
      span: occupiedIndices.length,
      tone,
      label,
      booking,
      startRounded: firstDateKey === bookingStartKey,
      endRounded: lastDateKey === bookingLastNightKey,
    });
  });

  segments.sort((left, right) => {
    if (left.startCol !== right.startCol) {
      return left.startCol - right.startCol;
    }
    return right.span - left.span;
  });

  const rowEndByIndex: number[] = [];

  return segments.map((segment) => {
    let rowIndex = rowEndByIndex.findIndex((endCol) => segment.startCol > endCol);

    if (rowIndex === -1) {
      rowIndex = rowEndByIndex.length;
      rowEndByIndex.push(segment.startCol + segment.span - 1);
    } else {
      rowEndByIndex[rowIndex] = segment.startCol + segment.span - 1;
    }

    return {
      ...segment,
      rowIndex,
    };
  });
};

const ManageBookings = () => {
  const { showToast } = useAppContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const todayKey = new Date().toISOString().slice(0, 10);

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
      const message = error?.response?.data?.message || "Unable to update day status";
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

  const calendarWeeks = useMemo(
    () => buildCalendarWeeks(selectedMonth, calendarData),
    [selectedMonth, calendarData]
  );

  const weekBars = useMemo(
    () => calendarWeeks.map((week) => buildWeekBars(week, calendarData?.bookings || [])),
    [calendarWeeks, calendarData?.bookings]
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
  const importedCount =
    calendarData?.bookings.filter((booking) => booking.status === "Imported").length || 0;

  const isBookingComManagedRoom = Boolean(
    rooms?.find((room) => room._id === selectedRoomId)?.bookingComIcal?.syncEnabled
  );

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

    if (isBookingComManagedRoom) {
      showToast({
        title:
          "Manual day closures are disabled for Booking.com-managed rooms. Use Booking.com availability or the export feed instead.",
        type: "ERROR",
      });
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
        <p className="text-gray-600">Booking.com-style room calendar and request handling by room.</p>
      </div>

      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Building2 className="h-5 w-5 text-primary-600" />
            Room Scope
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="text-sm font-semibold text-gray-700">Room</label>
            <select
              className="mt-1 w-full rounded-md border border-[#d9dee7] bg-white px-3 py-2"
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
              className="mt-1 w-full rounded-md border border-[#d9dee7] bg-white px-3 py-2"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <Button
              variant="secondary"
              className="w-full border border-[#d9dee7] bg-white text-slate-700 hover:bg-slate-50"
              onClick={refreshCalendar}
              disabled={calendarLoading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="border-[#e5e7eb] bg-white shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Current Month</p>
            <p className="text-lg font-bold text-gray-900">{toMonthLabel(selectedMonth)}</p>
          </CardContent>
        </Card>
        <Card className="border-[#e5e7eb] bg-white shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Requested</p>
            <p className="text-lg font-bold text-[#b07d00]">{requestedCount}</p>
          </CardContent>
        </Card>
        <Card className="border-[#e5e7eb] bg-white shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Booked</p>
            <p className="text-lg font-bold text-[#4a6fae]">{bookedCount}</p>
          </CardContent>
        </Card>
        <Card className="border-[#e5e7eb] bg-white shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Imported</p>
            <p className="text-lg font-bold text-[#3f67a8]">{importedCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#e5e7eb] bg-white shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Button
            variant={viewMode === "calendar" ? "default" : "secondary"}
            onClick={() => setViewMode("calendar")}
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            Calendar View
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "secondary"}
            onClick={() => setViewMode("table")}
          >
            <Table2 className="mr-2 h-4 w-4" />
            Table View
          </Button>

          <div className="ml-auto flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
            <span className="flex items-center gap-2">
              <span className="h-3 w-10 rounded-full bg-[#4a6fae]" />
              Booked
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-10 rounded-full bg-[#3f67a8]" />
              Imported
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-10 rounded-full bg-[#f4c542]" />
              Requested
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-10 rounded-full bg-[#e86a6a]" />
              Closed
            </span>
          </div>
        </CardContent>
      </Card>

      {viewMode === "calendar" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="border-[#e5e7eb] bg-white shadow-sm xl:col-span-2">
            <CardHeader>
              <CardTitle>{calendarData?.room?.name || "Room Calendar"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-7 border-b border-[#edf0f4] bg-white">
                {WEEKDAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="border-r border-[#edf0f4] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#6b7280] last:border-r-0"
                  >
                    {label}
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {calendarWeeks.map((week, weekIndex) => {
                  const bars = weekBars[weekIndex] || [];
                  const barAreaHeight = bars.length
                    ? bars.length * BAR_ROW_HEIGHT + (bars.length - 1) * BAR_VERTICAL_GAP + 10
                    : 10;

                  return (
                    <div
                      key={week.key}
                      className="overflow-hidden rounded-lg border border-[#edf0f4] bg-white"
                    >
                      <div className="relative" style={{ paddingTop: `${barAreaHeight}px` }}>
                        <div className="pointer-events-none absolute inset-x-0 top-0 px-2">
                          {bars.map((bar) => {
                            const left = `${(bar.startCol / 7) * 100}%`;
                            const width = `${(bar.span / 7) * 100}%`;
                            const top = bar.rowIndex * (BAR_ROW_HEIGHT + BAR_VERTICAL_GAP);

                            return (
                              <button
                                key={bar.key}
                                type="button"
                                onClick={() => setSelectedDay(getDateKey(bar.booking.checkIn))}
                                className={`pointer-events-auto absolute flex h-7 items-center truncate px-3 text-[11px] font-semibold ${BAR_STYLES[bar.tone]} ${
                                  bar.startRounded ? "rounded-l-full" : "rounded-l-sm"
                                } ${bar.endRounded ? "rounded-r-full" : "rounded-r-sm"}`}
                                style={{
                                  left: `calc(${left} + 6px)`,
                                  width: `calc(${width} - 12px)`,
                                  top,
                                }}
                                title={bar.label}
                              >
                                <span className="truncate">{bar.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-7">
                          {week.cells.map((cell, cellIndex) => {
                            if (!cell.date || !cell.isCurrentMonth) {
                              return (
                                <div
                                  key={`${week.key}-empty-${cellIndex}`}
                                  className="h-[112px] border-r border-t border-[#edf0f4] bg-[#fafbfc] last:border-r-0"
                                />
                              );
                            }

                            const isSelected = selectedDay === cell.date;
                            const isPast = cell.date < todayKey;
                            const isToday = cell.date === todayKey;
                            const isClosed = cell.status === "Closed";
                            const dayBars = bars.filter(
                              (bar) =>
                                cellIndex >= bar.startCol &&
                                cellIndex < bar.startCol + bar.span
                            );
                            const hasBars = dayBars.length > 0;

                            return (
                              <button
                                key={cell.date}
                                onClick={() => setSelectedDay(cell.date || selectedDay)}
                                className={`relative h-[112px] border-r border-t px-3 py-2 text-left transition-colors last:border-r-0 ${
                                  isToday
                                    ? "border-[#d93025]"
                                    : "border-[#edf0f4]"
                                } ${
                                  isSelected
                                    ? "bg-[#d8eaf8]"
                                    : isPast
                                      ? "bg-[#f3f4f6]"
                                      : "bg-white"
                                }`}
                              >
                                {isClosed && (
                                  <span className="absolute inset-x-0 top-0 h-2 bg-[#e86a6a]" />
                                )}

                                <div className="flex h-full flex-col justify-between">
                                  <div className="flex items-start justify-between">
                                    <span className={`text-sm font-semibold ${isPast ? "text-[#8a9099]" : "text-[#2f343a]"}`}>
                                      {cell.dayNumber}
                                    </span>
                                    {isSelected && (
                                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#4a6fae] shadow-sm">
                                        Selected
                                      </span>
                                    )}
                                  </div>

                                  <div className={`space-y-1 text-[11px] ${isPast ? "text-[#8a9099]" : "text-[#5f6368]"}`}>
                                    {isClosed && <p className="font-semibold text-[#c84d4d]">Closed</p>}
                                    {!isClosed && !hasBars && cell.status === "Available" && <p>Available</p>}
                                    {!isClosed && !hasBars && cell.requestedCount > 0 && (
                                      <p>{cell.requestedCount} request</p>
                                    )}
                                    {!isClosed && hasBars && cell.importedCount > 0 && (
                                      <p>{cell.importedCount} imported</p>
                                    )}
                                    {!isClosed && hasBars && cell.bookedCount > 0 && (
                                      <p>{cell.bookedCount} booked</p>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#e5e7eb] bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Day Control</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Selected Day</p>
                <p className="font-semibold text-gray-900">{formatDateLabel(selectedDay)}</p>
              </div>
              <div>
                <p className="mb-2 text-sm text-gray-600">Current Status</p>
                <Badge className={STATUS_STYLES[selectedDayInfo?.status || "Available"]}>
                  {selectedDayInfo?.status || "Available"}
                </Badge>
              </div>

              {isBookingComManagedRoom && (
                <div className="rounded-md border border-[#d8eaf8] bg-[#f4f9fd] p-3 text-sm text-[#355f8e]">
                  Booking.com import is the active source of truth for this room. Imported dates block availability and manual local closures are disabled.
                </div>
              )}

              {!isBookingComManagedRoom &&
                selectedDayInfo?.status !== "Requested" &&
                selectedDayInfo?.status !== "Booked" &&
                selectedDayInfo?.status !== "Imported" && (
                  <>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Close Day Reason</label>
                      <textarea
                        className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm"
                        rows={3}
                        placeholder="Write why this day is closed..."
                        value={closeReason}
                        onChange={(e) => setCloseReason(e.target.value)}
                      />
                      <p className="mt-1 text-xs text-gray-500">Required when setting a day to Closed.</p>
                    </div>
                    <div className="space-y-2">
                      <Button
                        className="w-full"
                        variant="destructive"
                        onClick={() => setSelectedDayClosed(true)}
                        disabled={selectedDayInfo?.status === "Closed" || updateDayMutation.isLoading}
                      >
                        <Lock className="mr-2 h-4 w-4" />
                        Mark As Closed
                      </Button>
                      <Button
                        className="w-full"
                        variant="secondary"
                        onClick={() => setSelectedDayClosed(false)}
                        disabled={selectedDayInfo?.status !== "Closed" || updateDayMutation.isLoading}
                      >
                        <Unlock className="mr-2 h-4 w-4" />
                        Reopen Day
                      </Button>
                    </div>
                  </>
                )}

              {(selectedDayInfo?.status === "Requested" ||
                selectedDayInfo?.status === "Booked" ||
                selectedDayInfo?.status === "Imported") && (
                <div className="border-t border-gray-200 pt-2">
                  <h3 className="mb-2 text-sm font-semibold text-gray-900">Entries on Selected Day</h3>
                  <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                    {selectedDayBookings.length > 0 ? (
                      selectedDayBookings.map((booking) => (
                        <div key={booking._id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900">
                              {booking.firstName} {booking.lastName}
                            </p>
                            <Badge className={STATUS_STYLES[booking.status]}>{booking.status}</Badge>
                          </div>
                          {booking.sourceLabel && (
                            <p className="mt-1 text-xs font-medium text-[#3f67a8]">Source: {booking.sourceLabel}</p>
                          )}
                          <p className="mt-1 text-xs text-gray-700">{booking.email}</p>
                          {booking.phone && <p className="text-xs text-gray-700">{booking.phone}</p>}
                          <p className="mt-1 text-xs text-gray-700">Ref: {booking.reservationNumber || "N/A"}</p>
                          <p className="text-xs text-gray-700">
                            Stay: {formatDateLabel(String(booking.checkIn))} to {" "}
                            {formatDateLabel(String(booking.checkOut))}
                          </p>
                          {booking.summary && <p className="mt-1 text-xs text-gray-700">{booking.summary}</p>}
                          {booking.externalUid && (
                            <p className="mt-1 text-xs text-gray-700">UID: {booking.externalUid}</p>
                          )}
                          {booking.dtStamp && (
                            <p className="text-xs text-gray-700">Updated: {formatDateLabel(String(booking.dtStamp))}</p>
                          )}
                          <p className="mt-1 text-xs font-semibold text-gray-900">
                            {booking.status === "Imported" ? "Imported block" : `EUR ${booking.totalCost}`}
                          </p>

                          {booking.status === "Requested" && (
                            <div className="mt-2 flex items-center gap-2">
                              <Button
                                size="sm"
                                className="h-8"
                                onClick={() => handleConfirm(booking._id)}
                                disabled={bookingDecisionMutation.isLoading}
                              >
                                <Check className="mr-1 h-3.5 w-3.5" />
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-8"
                                onClick={() => handleReject(booking._id)}
                                disabled={bookingDecisionMutation.isLoading}
                              >
                                <X className="mr-1 h-3.5 w-3.5" />
                                Reject
                              </Button>
                            </div>
                          )}

                          {booking.status === "Booked" && (
                            <div className="mt-2">
                              <Button
                                size="sm"
                                className="h-8 w-full"
                                onClick={() =>
                                  navigate(`/hotel/${selectedRoomId}/check-in/${booking._id}`)
                                }
                              >
                                <LogIn className="mr-1 h-3.5 w-3.5" />
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
                <div className="border-t border-gray-200 pt-2">
                  <h3 className="mb-1 text-sm font-semibold text-gray-900">Closed Reason</h3>
                  <p className="whitespace-pre-wrap text-sm text-gray-700">{selectedDayInfo.closedReason}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-[#e5e7eb] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Booking Requests and Reservations</CardTitle>
          </CardHeader>
          <CardContent>
            {calendarData?.bookings && calendarData.bookings.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-600">
                      <th className="px-2 py-3">Reference</th>
                      <th className="px-2 py-3">Source</th>
                      <th className="px-2 py-3">Guest</th>
                      <th className="px-2 py-3">Stay</th>
                      <th className="px-2 py-3">Status</th>
                      <th className="px-2 py-3">Total</th>
                      <th className="px-2 py-3">Details</th>
                      <th className="px-2 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calendarData.bookings.map((booking) => (
                      <tr key={booking._id} className="border-b border-gray-100 text-sm">
                        <td className="px-2 py-3 font-mono text-xs text-gray-700">
                          {booking.reservationNumber || "N/A"}
                        </td>
                        <td className="px-2 py-3">
                          <Badge
                            className={
                              booking.status === "Imported"
                                ? STATUS_STYLES.Imported
                                : "bg-slate-100 text-slate-800 border-slate-200"
                            }
                          >
                            {booking.sourceLabel || "Local"}
                          </Badge>
                        </td>
                        <td className="px-2 py-3">
                          <p className="font-semibold text-gray-900">
                            {booking.firstName} {booking.lastName}
                          </p>
                          <p className="text-xs text-gray-600">{booking.email}</p>
                        </td>
                        <td className="px-2 py-3">
                          <p className="text-gray-900">{formatDateLabel(String(booking.checkIn))}</p>
                          <p className="text-xs text-gray-600">to {formatDateLabel(String(booking.checkOut))}</p>
                        </td>
                        <td className="px-2 py-3">
                          <Badge className={STATUS_STYLES[booking.status]}>{booking.status}</Badge>
                        </td>
                        <td className="px-2 py-3 font-semibold text-gray-900">
                          {booking.status === "Imported" ? "Imported block" : `EUR ${booking.totalCost}`}
                        </td>
                        <td className="px-2 py-3">
                          {booking.status === "Imported" ? (
                            <div className="space-y-1 text-xs text-gray-600">
                              {booking.summary && <p>{booking.summary}</p>}
                              {booking.externalUid && <p>UID: {booking.externalUid}</p>}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">Standard booking</span>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          {booking.status === "Requested" ? (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                className="h-8"
                                onClick={() => handleConfirm(booking._id)}
                                disabled={bookingDecisionMutation.isLoading}
                              >
                                <Check className="mr-1 h-3.5 w-3.5" />
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-8"
                                onClick={() => handleReject(booking._id)}
                                disabled={bookingDecisionMutation.isLoading}
                              >
                                <X className="mr-1 h-3.5 w-3.5" />
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
