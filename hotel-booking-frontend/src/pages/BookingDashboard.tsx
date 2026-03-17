import { useEffect, useState } from "react";
import { useQuery } from "react-query";
import { Link, useNavigate } from "react-router-dom";
import * as apiClient from "../api-client";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useQueryWithLoading } from "../hooks/useLoadingHooks";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  XCircle,
  CheckCheck,
  RefreshCw,
  Globe,
  TrendingUp,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

type DashboardData = {
  year: number;
  month: number | null;
  hotelId: string | null;
  dateRange: {
    start: string;
    end: string;
  };
  hotels: Array<{
    hotelId: string;
    hotelName: string;
    city: string;
    country: string;
    totalBookings: number;
    statusCounts: {
      pending: number;
      confirmed: number;
      arrived: number;
      completed: number;
      cancelled: number;
      refunded: number;
    };
  }>;
  totals: {
    pending: number;
    confirmed: number;
    arrived: number;
    completed: number;
    cancelled: number;
    refunded: number;
    total: number;
  };
  occupancy: {
    bookedNights: number;
    availableNights: number;
    percentage: number;
  };
  topNationalities: Array<{
    nationality: string;
    count: number;
  }>;
  bookings: Array<{
    _id: string;
    hotelId: string;
    reservationNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    nationality: string;
    status: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    createdAt: string;
  }>;
};

const BookingDashboard = () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const navigate = useNavigate();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(currentMonth);
  const [selectedHotelId, setSelectedHotelId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<string>("checkIn");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Fetch available hotels
  const { data: rooms, isLoading: roomsLoading } = useQueryWithLoading(
    ["bookingManagementRooms"],
    apiClient.fetchBookingManagementRooms,
    {
      loadingMessage: "Loading rooms...",
    }
  );

  useEffect(() => {
    if (!selectedHotelId && rooms && rooms.length > 0) {
      setSelectedHotelId(rooms[0]._id);
    }
  }, [rooms, selectedHotelId]);

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dataLoading } = useQuery<DashboardData>(
    ["bookingDashboardSummary", selectedYear, selectedMonth, selectedHotelId, selectedStatus],
    () =>
      apiClient.fetchBookingDashboardSummary({
        year: selectedYear,
        month: selectedMonth || undefined,
        hotelId: selectedHotelId || undefined,
        status: selectedStatus || undefined,
      }),
    {
      enabled: Boolean(selectedYear),
    }
  );

  const isLoading = roomsLoading || dataLoading;

  // Status configuration
  const statusConfig = {
    pending: {
      color: "from-amber-500 to-amber-600",
      bgColor: "bg-amber-100",
      textColor: "text-amber-900",
      borderColor: "border-amber-300",
      icon: Clock,
      label: "Pending",
      lightBg: "bg-amber-50",
    },
    confirmed: {
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-100",
      textColor: "text-blue-900",
      borderColor: "border-blue-300",
      icon: CheckCircle2,
      label: "Confirmed",
      lightBg: "bg-blue-50",
    },
    arrived: {
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-100",
      textColor: "text-purple-900",
      borderColor: "border-purple-300",
      icon: CheckCheck,
      label: "Arrived",
      lightBg: "bg-purple-50",
    },
    completed: {
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-100",
      textColor: "text-green-900",
      borderColor: "border-green-300",
      icon: CheckCircle2,
      label: "Completed",
      lightBg: "bg-green-50",
    },
    cancelled: {
      color: "from-red-500 to-red-600",
      bgColor: "bg-red-100",
      textColor: "text-red-900",
      borderColor: "border-red-300",
      icon: XCircle,
      label: "Cancelled",
      lightBg: "bg-red-50",
    },
    refunded: {
      color: "from-orange-500 to-orange-600",
      bgColor: "bg-orange-100",
      textColor: "text-orange-900",
      borderColor: "border-orange-300",
      icon: RefreshCw,
      label: "Refunded",
      lightBg: "bg-orange-50",
    },
  };

  // Sorting function
  const sortBookings = (bookings: DashboardData["bookings"]) => {
    const sorted = [...bookings];
    sorted.sort((a, b) => {
      let aValue: any = a[sortColumn as keyof typeof a];
      let bValue: any = b[sortColumn as keyof typeof b];

      // Handle date comparisons
      if (sortColumn === "checkIn" || sortColumn === "checkOut") {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      // Handle numeric comparisons
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      // Handle string comparisons
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      return sortDirection === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
    return sorted;
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg shadow-lg">
              <BarChart3 className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Booking Dashboard</h1>
              <p className="text-gray-600 text-sm mt-1">
                Real-time analytics and occupancy insights
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Year Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Month
              </label>
              <select
                value={selectedMonth || ""}
                onChange={(e) =>
                  setSelectedMonth(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
              >
                <option value="">All Months</option>
                {months.map((month) => (
                  <option key={month} value={month}>
                    {new Date(2024, month - 1).toLocaleDateString("en-US", {
                      month: "long",
                    })}
                  </option>
                ))}
              </select>
            </div>

            {/* Room Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Room
              </label>
              <select
                value={selectedHotelId || ""}
                onChange={(e) => setSelectedHotelId(e.target.value)}
                disabled={!rooms || rooms.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">All Rooms</option>
                {rooms?.map((room) => (
                  <option key={room._id} value={room._id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter Info */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status Filter
              </label>
              <div className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 flex items-center h-10 text-sm text-gray-700 font-medium">
                {selectedStatus
                  ? statusConfig[selectedStatus as keyof typeof statusConfig].label
                  : "Click a card below"}
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading dashboard data...</p>
            </div>
          </div>
        ) : dashboardData ? (
          <>
            {/* Occupancy, Availability and Nationalities Top Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
              {/* Occupancy Card */}
              {dashboardData.occupancy && (
                <Card className="border-0 shadow-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-teal-500 via-teal-600 to-teal-700 p-8 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-teal-100 font-medium mb-2 text-sm uppercase tracking-wide">
                          Occupancy Rate
                        </p>
                        <p className="text-5xl font-bold mb-2">
                          {dashboardData.occupancy.percentage}%
                        </p>
                        <p className="text-teal-100 text-sm">
                          {dashboardData.occupancy.bookedNights} of{" "}
                          {dashboardData.occupancy.availableNights} nights booked
                        </p>
                      </div>
                      <div className="relative w-40 h-40 flex-shrink-0">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                          <circle
                            cx="60"
                            cy="60"
                            r="50"
                            fill="none"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth="10"
                          />
                          <circle
                            cx="60"
                            cy="60"
                            r="50"
                            fill="none"
                            stroke="white"
                            strokeWidth="10"
                            strokeDasharray={`${
                              3.14 * 100 * (dashboardData.occupancy.percentage / 100)
                            } 314`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-3xl font-bold text-white">
                            {dashboardData.occupancy.percentage}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Available Slots - Vacancy Card */}
              {dashboardData.occupancy && (
                <div
                  onClick={() =>
                    navigate("/vacancy-management", {
                      state: {
                        year: selectedYear,
                        month: selectedMonth,
                        hotelId: selectedHotelId,
                      },
                    })
                  }
                  className="cursor-pointer transition-transform duration-300 hover:scale-105"
                >
                  <Card className="border-0 shadow-lg overflow-hidden h-full">
                    <div className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 p-8 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-emerald-100 font-medium mb-2 text-sm uppercase tracking-wide">
                            Vacancy Rate
                          </p>
                          <p className="text-5xl font-bold mb-2">
                            {100 - dashboardData.occupancy.percentage}%
                          </p>
                          <p className="text-emerald-100 text-sm">
                            {dashboardData.occupancy.availableNights} of{" "}
                            {dashboardData.occupancy.availableNights +
                              dashboardData.occupancy.bookedNights}{" "}
                            slots available
                          </p>
                        </div>
                        <div className="relative w-40 h-40 flex-shrink-0">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                            <circle
                              cx="60"
                              cy="60"
                              r="50"
                              fill="none"
                              stroke="rgba(255,255,255,0.2)"
                              strokeWidth="10"
                            />
                            <circle
                              cx="60"
                              cy="60"
                              r="50"
                              fill="none"
                              stroke="white"
                              strokeWidth="10"
                              strokeDasharray={`${
                                3.14 *
                                100 *
                                ((100 - dashboardData.occupancy.percentage) / 100)
                              } 314`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-white">
                              {100 - dashboardData.occupancy.percentage}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Top 5 Nationalities */}
              {dashboardData.topNationalities && dashboardData.topNationalities.length > 0 && (
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg">
                        <Globe className="h-5 w-5 text-white" />
                      </div>
                      Top 5 Guest Nationalities
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-5">
                      {dashboardData.topNationalities.map((item, idx) => (
                        <div key={idx}>
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-indigo-600">
                                #{idx + 1}
                              </span>
                              <span className="font-semibold text-gray-800">
                                {item.nationality}
                              </span>
                            </div>
                            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 font-bold rounded-full text-sm">
                              {item.count} bookings
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-indigo-400 to-indigo-600 h-3 rounded-full transition-all duration-500"
                              style={{
                                width: `${
                                  (item.count / dashboardData.topNationalities[0].count) * 100
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Status Cards Grid - Clickable */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {Object.entries(statusConfig).map(([status, config]) => {
                const count = dashboardData.totals[status as keyof typeof dashboardData.totals];
                const Icon = config.icon;
                const isSelected = selectedStatus === status;

                return (
                  <div
                    key={status}
                    onClick={() =>
                      setSelectedStatus(isSelected ? "" : status)
                    }
                    className={`cursor-pointer transition-all duration-300 transform hover:scale-105 ${
                      isSelected ? "ring-2 ring-offset-2 ring-teal-500" : ""
                    }`}
                  >
                    <Card className={`border-2 shadow-lg h-full hover:shadow-xl ${
                      isSelected ? "border-teal-500" : `border-transparent ${config.lightBg}`
                    }`}>
                      <CardContent className="pt-6">
                        <div
                          className={`rounded-xl p-4 mb-4 bg-gradient-to-br ${config.color} shadow-md`}
                        >
                          <Icon className="h-8 w-8 text-white" />
                        </div>
                        <p className={`text-sm font-semibold ${config.textColor} mb-1 uppercase tracking-wide`}>
                          {config.label}
                        </p>
                        <p className={`text-4xl font-bold ${config.textColor}`}>
                          {count}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>

            {/* Bookings Table - Shows when status selected */}
            {selectedStatus && dashboardData.bookings.length > 0 && (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                    Booking Details -{" "}
                    {statusConfig[selectedStatus as keyof typeof statusConfig].label}
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-2">
                    Showing {dashboardData.bookings.length} booking
                    {dashboardData.bookings.length !== 1 ? "s" : ""}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-gray-200 bg-gray-50">
                          <th
                            className="text-left px-4 py-4 font-bold text-gray-800 cursor-pointer hover:bg-gray-100 transition"
                            onClick={() => {
                              if (sortColumn === "reservationNumber") {
                                setSortDirection(
                                  sortDirection === "asc" ? "desc" : "asc"
                                );
                              } else {
                                setSortColumn("reservationNumber");
                                setSortDirection("asc");
                              }
                            }}
                          >
                            <div className="flex items-center gap-2">
                              Reference
                              {sortColumn === "reservationNumber" &&
                                (sortDirection === "asc" ? (
                                  <ArrowUp className="h-4 w-4" />
                                ) : (
                                  <ArrowDown className="h-4 w-4" />
                                ))}
                            </div>
                          </th>
                          <th
                            className="text-left px-4 py-4 font-bold text-gray-800 cursor-pointer hover:bg-gray-100 transition"
                            onClick={() => {
                              if (sortColumn === "firstName") {
                                setSortDirection(
                                  sortDirection === "asc" ? "desc" : "asc"
                                );
                              } else {
                                setSortColumn("firstName");
                                setSortDirection("asc");
                              }
                            }}
                          >
                            <div className="flex items-center gap-2">
                              Guest
                              {sortColumn === "firstName" &&
                                (sortDirection === "asc" ? (
                                  <ArrowUp className="h-4 w-4" />
                                ) : (
                                  <ArrowDown className="h-4 w-4" />
                                ))}
                            </div>
                          </th>
                          <th
                            className="text-left px-4 py-4 font-bold text-gray-800 cursor-pointer hover:bg-gray-100 transition"
                            onClick={() => {
                              if (sortColumn === "nationality") {
                                setSortDirection(
                                  sortDirection === "asc" ? "desc" : "asc"
                                );
                              } else {
                                setSortColumn("nationality");
                                setSortDirection("asc");
                              }
                            }}
                          >
                            <div className="flex items-center gap-2">
                              Nationality
                              {sortColumn === "nationality" &&
                                (sortDirection === "asc" ? (
                                  <ArrowUp className="h-4 w-4" />
                                ) : (
                                  <ArrowDown className="h-4 w-4" />
                                ))}
                            </div>
                          </th>
                          <th
                            className="text-left px-4 py-4 font-bold text-gray-800 cursor-pointer hover:bg-gray-100 transition"
                            onClick={() => {
                              if (sortColumn === "email") {
                                setSortDirection(
                                  sortDirection === "asc" ? "desc" : "asc"
                                );
                              } else {
                                setSortColumn("email");
                                setSortDirection("asc");
                              }
                            }}
                          >
                            <div className="flex items-center gap-2">
                              Email
                              {sortColumn === "email" &&
                                (sortDirection === "asc" ? (
                                  <ArrowUp className="h-4 w-4" />
                                ) : (
                                  <ArrowDown className="h-4 w-4" />
                                ))}
                            </div>
                          </th>
                          <th
                            className="text-left px-4 py-4 font-bold text-gray-800 cursor-pointer hover:bg-gray-100 transition"
                            onClick={() => {
                              if (sortColumn === "phone") {
                                setSortDirection(
                                  sortDirection === "asc" ? "desc" : "asc"
                                );
                              } else {
                                setSortColumn("phone");
                                setSortDirection("asc");
                              }
                            }}
                          >
                            <div className="flex items-center gap-2">
                              Phone
                              {sortColumn === "phone" &&
                                (sortDirection === "asc" ? (
                                  <ArrowUp className="h-4 w-4" />
                                ) : (
                                  <ArrowDown className="h-4 w-4" />
                                ))}
                            </div>
                          </th>
                          <th
                            className="text-left px-4 py-4 font-bold text-gray-800 cursor-pointer hover:bg-gray-100 transition"
                            onClick={() => {
                              if (sortColumn === "checkIn") {
                                setSortDirection(
                                  sortDirection === "asc" ? "desc" : "asc"
                                );
                              } else {
                                setSortColumn("checkIn");
                                setSortDirection("asc");
                              }
                            }}
                          >
                            <div className="flex items-center gap-2">
                              Check-in
                              {sortColumn === "checkIn" &&
                                (sortDirection === "asc" ? (
                                  <ArrowUp className="h-4 w-4" />
                                ) : (
                                  <ArrowDown className="h-4 w-4" />
                                ))}
                            </div>
                          </th>
                          <th
                            className="text-left px-4 py-4 font-bold text-gray-800 cursor-pointer hover:bg-gray-100 transition"
                            onClick={() => {
                              if (sortColumn === "checkOut") {
                                setSortDirection(
                                  sortDirection === "asc" ? "desc" : "asc"
                                );
                              } else {
                                setSortColumn("checkOut");
                                setSortDirection("asc");
                              }
                            }}
                          >
                            <div className="flex items-center gap-2">
                              Check-out
                              {sortColumn === "checkOut" &&
                                (sortDirection === "asc" ? (
                                  <ArrowUp className="h-4 w-4" />
                                ) : (
                                  <ArrowDown className="h-4 w-4" />
                                ))}
                            </div>
                          </th>
                          <th
                            className="text-left px-4 py-4 font-bold text-gray-800 cursor-pointer hover:bg-gray-100 transition"
                            onClick={() => {
                              if (sortColumn === "guests") {
                                setSortDirection(
                                  sortDirection === "asc" ? "desc" : "asc"
                                );
                              } else {
                                setSortColumn("guests");
                                setSortDirection("asc");
                              }
                            }}
                          >
                            <div className="flex items-center gap-2">
                              Guests
                              {sortColumn === "guests" &&
                                (sortDirection === "asc" ? (
                                  <ArrowUp className="h-4 w-4" />
                                ) : (
                                  <ArrowDown className="h-4 w-4" />
                                ))}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortBookings(dashboardData.bookings).map((booking) => (
                          <tr key={booking._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-4 font-mono font-bold">
                              <Link
                                to={`/booking/${booking._id}`}
                                className="text-teal-600 hover:text-teal-700 hover:underline"
                              >
                                {booking.reservationNumber}
                              </Link>
                            </td>
                            <td className="px-4 py-4 font-medium text-gray-900">
                              {booking.firstName} {booking.lastName}
                            </td>
                            <td className="px-4 py-4 text-gray-700">
                              {booking.nationality}
                            </td>
                            <td className="px-4 py-4 text-gray-700 text-xs">
                              {booking.email}
                            </td>
                            <td className="px-4 py-4 text-gray-700 text-xs">
                              {booking.phone}
                            </td>
                            <td className="px-4 py-4 text-gray-700">
                              {formatDate(booking.checkIn)}
                            </td>
                            <td className="px-4 py-4 text-gray-700">
                              {formatDate(booking.checkOut)}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="px-3 py-1 bg-teal-100 text-teal-800 font-semibold rounded-full">
                                {booking.guests}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedStatus && dashboardData.bookings.length === 0 && (
              <Card className="border-0 shadow-lg">
                <CardContent className="py-12 text-center">
                  <p className="text-gray-600">
                    No bookings found for{" "}
                    {statusConfig[selectedStatus as keyof typeof statusConfig].label}{" "}
                    status
                  </p>
                </CardContent>
              </Card>
            )}

            {!selectedStatus && (
              <Card className="border-2 border-dashed border-gray-300 shadow-sm">
                <CardContent className="py-12 text-center">
                  <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">
                    Click on a status card above to view booking details
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-600">No data available for the selected period</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingDashboard;
