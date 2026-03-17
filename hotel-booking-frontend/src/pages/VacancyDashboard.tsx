import { useEffect, useState } from "react";
import { useQuery } from "react-query";
import { useLocation, useNavigate } from "react-router-dom";
import * as apiClient from "../api-client";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useQueryWithLoading } from "../hooks/useLoadingHooks";
import {
  ArrowLeft,
  TrendingDown,
  Calendar,
  Target,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

type DashboardData = {
  year: number;
  month: number | null;
  hotelId: string | null;
  dateRange: {
    start: string;
    end: string;
  };
  occupancy: {
    bookedNights: number;
    availableNights: number;
    percentage: number;
  };
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

const VacancyDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Get params from location state or use defaults
  const state = location.state as any;
  const [selectedYear, setSelectedYear] = useState<number>(state?.year || currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(state?.month || currentMonth);
  const [selectedHotelId, setSelectedHotelId] = useState<string>(state?.hotelId || "");

  // Fetch available hotels
  const { data: rooms, isLoading: roomsLoading } = useQueryWithLoading(
    ["bookingManagementRooms"],
    apiClient.fetchBookingManagementRooms,
    {
      loadingMessage: "Loading hotels...",
    }
  );

  useEffect(() => {
    if (!selectedHotelId && rooms && rooms.length > 0) {
      setSelectedHotelId(rooms[0]._id);
    }
  }, [rooms, selectedHotelId]);

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dataLoading } = useQuery<DashboardData>(
    ["vacancyDashboard", selectedYear, selectedMonth, selectedHotelId],
    () =>
      apiClient.fetchBookingDashboardSummary({
        year: selectedYear,
        month: selectedMonth || undefined,
        hotelId: selectedHotelId || undefined,
      }),
    {
      enabled: Boolean(selectedYear),
    }
  );

  const isLoading = roomsLoading || dataLoading;

  // Generate available dates from the period
  const getAvailableDates = () => {
    if (!dashboardData) return [];

    const dateRange = dashboardData.dateRange;
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    // Get all booked dates
    const bookedDates = new Set<string>();
    dashboardData.bookings.forEach((booking) => {
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      
      for (
        let d = new Date(checkIn);
        d < checkOut;
        d.setDate(d.getDate() + 1)
      ) {
        bookedDates.add(d.toISOString().split("T")[0]);
      }
    });

    // Get all available dates
    const availableDates = [];
    for (
      let d = new Date(startDate);
      d < endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const dateStr = d.toISOString().split("T")[0];
      if (!bookedDates.has(dateStr)) {
        availableDates.push(new Date(d));
      }
    }

    return availableDates;
  };

  const availableDates = getAvailableDates();

  // Group available dates by month
  const groupByMonth = (dates: Date[]) => {
    const grouped: { [key: string]: Date[] } = {};
    dates.forEach((date) => {
      const monthKey = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      });
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(date);
    });
    return grouped;
  };

  const monthGroups = groupByMonth(availableDates);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-teal-600 hover:text-teal-700 font-semibold mb-4 transition"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Dashboard
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg">
              <TrendingDown className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">
              Vacancy Management Dashboard
            </h1>
          </div>
          <p className="text-gray-600">
            Identify available slots and optimize marketing strategies to reduce vacancy rates
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Year Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
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

            {/* Hotel Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hotel
              </label>
              <select
                value={selectedHotelId || ""}
                onChange={(e) => setSelectedHotelId(e.target.value)}
                disabled={!rooms || rooms.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">All Hotels</option>
                {rooms?.map((room) => (
                  <option key={room._id} value={room._id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading vacancy data...</p>
            </div>
          </div>
        ) : dashboardData ? (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Vacancy Rate Card */}
              <Card className="border-0 shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-emerald-100 text-sm font-medium uppercase tracking-wide">
                        Vacancy Rate
                      </p>
                      <p className="text-4xl font-bold mt-2">
                        {100 - dashboardData.occupancy.percentage}%
                      </p>
                    </div>
                    <TrendingDown className="h-12 w-12 opacity-30" />
                  </div>
                  <p className="text-emerald-100 text-sm">
                    {dashboardData.occupancy.availableNights} slots unfilled
                  </p>
                </div>
              </Card>

              {/* Available Nights Card */}
              <Card className="border-0 shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-blue-100 text-sm font-medium uppercase tracking-wide">
                        Available Slots
                      </p>
                      <p className="text-4xl font-bold mt-2">
                        {dashboardData.occupancy.availableNights}
                      </p>
                    </div>
                    <Calendar className="h-12 w-12 opacity-30" />
                  </div>
                  <p className="text-blue-100 text-sm">
                    Out of {dashboardData.occupancy.availableNights + dashboardData.occupancy.bookedNights} total
                  </p>
                </div>
              </Card>

              {/* Marketing Target Card */}
              <Card className="border-0 shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-orange-100 text-sm font-medium uppercase tracking-wide">
                        Marketing Priority
                      </p>
                      <p className="text-4xl font-bold mt-2">
                        {Math.round(
                          (dashboardData.occupancy.availableNights /
                            (dashboardData.occupancy.availableNights +
                              dashboardData.occupancy.bookedNights)) *
                            100
                        )}
                        %
                      </p>
                    </div>
                    <Target className="h-12 w-12 opacity-30" />
                  </div>
                  <p className="text-orange-100 text-sm">
                    Focus on filling these gaps
                  </p>
                </div>
              </Card>
            </div>

            {/* Available Dates by Month */}
            {Object.keys(monthGroups).length > 0 ? (
              <div className="space-y-6">
                {Object.entries(monthGroups).map(([monthKey, dates]) => (
                  <Card key={monthKey} className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-emerald-600" />
                        {monthKey} - {dates.length} Available Dates
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {dates.map((date, idx) => (
                          <div
                            key={idx}
                            className="p-3 border-2 border-emerald-200 bg-emerald-50 rounded-lg text-center hover:bg-emerald-100 transition cursor-pointer"
                          >
                            <p className="text-sm font-bold text-emerald-900">
                              {date.getDate()}
                            </p>
                            <p className="text-xs text-emerald-700">
                              {date.toLocaleDateString("en-US", { weekday: "short" })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-2 border-dashed border-gray-300 shadow-sm">
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">
                    No vacancies! All slots are booked for the selected period.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Marketing Insights */}
            <Card className="border-0 shadow-lg mt-8 bg-gradient-to-r from-purple-50 to-indigo-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-purple-600" />
                  Marketing Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-purple-600 text-white text-sm font-bold">
                      1
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Focus on High-Vacancy Periods</p>
                    <p className="text-sm text-gray-600">
                      Months with vacancy rates above 50% require targeted promotional campaigns.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-purple-600 text-white text-sm font-bold">
                      2
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Strategic Discounting</p>
                    <p className="text-sm text-gray-600">
                      Consider dynamic pricing for available dates to attract bookings and reduce vacancy.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-purple-600 text-white text-sm font-bold">
                      3
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Partner Marketing</p>
                    <p className="text-sm text-gray-600">
                      Reach out to OTAs and partners to push inventory during high-vacancy periods.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
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

export default VacancyDashboard;
