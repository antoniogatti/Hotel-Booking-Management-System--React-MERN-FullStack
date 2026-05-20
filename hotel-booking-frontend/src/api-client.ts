import axiosInstance, { getApiBaseUrl } from "./lib/api-client";
import { SignInFormData } from "./pages/SignIn";
import {
  HotelSearchResponse,
  HotelType,
  UserType,
  BookingType,
  BookingManagementRoomType,
  BookingCalendarResponseType,
} from "../../shared/types";
import { queryClient } from "./lib/query-client";

export { getApiBaseUrl };

export const DEFAULT_PROFILE_IMAGE = "/common/immagineprofilo.png";

type RegisterFormData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export const fetchCurrentUser = async (): Promise<UserType> => {
  const response = await axiosInstance.get("/api/users/me");
  return response.data;
};

const clearStoredAuth = () => {
  localStorage.removeItem("session_id");
  localStorage.removeItem("user_id");
  localStorage.removeItem("user_email");
  localStorage.removeItem("user_name");
  localStorage.removeItem("user_image");
  localStorage.removeItem("user_role");
};

const persistUserImage = (image?: string | null) => {
  localStorage.setItem("user_image", image || DEFAULT_PROFILE_IMAGE);
};

export const persistSessionToken = (token?: string | null) => {
  if (!token) {
    localStorage.removeItem("session_id");
    return;
  }

  localStorage.setItem("session_id", token);
};

export const register = async (formData: RegisterFormData) => {
  const response = await axiosInstance.post("/api/users/register", formData);
  return response.data;
};

export const signIn = async (formData: SignInFormData) => {
  const response = await axiosInstance.post("/api/auth/login", formData);

  persistSessionToken(response.data?.token);

  if (response.data?.userId) {
    localStorage.setItem("user_id", response.data.userId);
  }
  if (response.data?.user) {
    const { email, firstName, lastName, role, image } = response.data.user;
    if (email) localStorage.setItem("user_email", email);
    const name = [firstName, lastName].filter(Boolean).join(" ") || email;
    if (name) localStorage.setItem("user_name", name);
    if (role) localStorage.setItem("user_role", role);
    persistUserImage(image);
  }

  // Force validate token after successful login to update React Query cache
  try {
    await validateToken();

    // Invalidate and refetch the validateToken query to update the UI
    queryClient.invalidateQueries("validateToken");

    // Force a refetch to ensure the UI updates
    await queryClient.refetchQueries("validateToken");
  } catch {
    // Keep login flow resilient if the validation check is temporarily unavailable.
  }

  return response.data;
};

export const validateToken = async () => {
  try {
    const response = await axiosInstance.get("/api/auth/validate-token");

    if (response.data?.userId) {
      localStorage.setItem("user_id", response.data.userId);
    }
    if (response.data?.email) {
      localStorage.setItem("user_email", response.data.email);
    }
    if (response.data?.firstName || response.data?.lastName) {
      const name = [response.data.firstName, response.data.lastName]
        .filter(Boolean)
        .join(" ");
      if (name) {
        localStorage.setItem("user_name", name);
      }
    }
    persistUserImage(response.data?.image);
    if (response.data?.role) {
      localStorage.setItem("user_role", response.data.role);
    }

    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      clearStoredAuth();
      return null;
    }

    throw new Error("Token validation failed");
  }
};

export const signOut = async () => {
  const response = await axiosInstance.post("/api/auth/logout");

  clearStoredAuth();

  return response.data;
};

// Development utility to clear all browser storage
export const clearAllStorage = () => {
  // Clear localStorage
  localStorage.clear();
  // Clear sessionStorage
  sessionStorage.clear();
  // Clear cookies (by setting them to expire in the past)
  document.cookie.split(";").forEach((c) => {
    document.cookie = c
      .replace(/^ +/, "")
      .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });
};

export const addMyHotel = async (hotelFormData: FormData) => {
  const response = await axiosInstance.post("/api/my-hotels", hotelFormData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const fetchMyHotels = async (): Promise<HotelType[]> => {
  const response = await axiosInstance.get("/api/my-hotels");
  return response.data;
};

export const fetchMyHotelById = async (hotelId: string): Promise<HotelType> => {
  const response = await axiosInstance.get(`/api/my-hotels/${hotelId}`);
  return response.data;
};

export const updateMyHotelById = async (hotelFormData: FormData) => {
  const hotelId = hotelFormData.get("hotelId");
  const response = await axiosInstance.put(
    `/api/my-hotels/${hotelId}`,
    hotelFormData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return response.data;
};

export type SearchParams = {
  destination?: string;
  checkIn?: string;
  checkOut?: string;
  adultCount?: string;
  childCount?: string;
  page?: string;
  facilities?: string[];
  types?: string[];
  stars?: string[];
  maxPrice?: string;
  sortOption?: string;
};

export const searchHotels = async (
  searchParams: SearchParams
): Promise<HotelSearchResponse> => {
  const queryParams = new URLSearchParams();

  // Only add destination if it's not empty
  if (searchParams.destination && searchParams.destination.trim() !== "") {
    queryParams.append("destination", searchParams.destination.trim());
  }

  if (searchParams.checkIn) {
    queryParams.append("checkIn", searchParams.checkIn);
  }

  if (searchParams.checkOut) {
    queryParams.append("checkOut", searchParams.checkOut);
  }

  if (searchParams.adultCount) {
    queryParams.append("adultCount", searchParams.adultCount);
  }

  if (searchParams.childCount) {
    queryParams.append("childCount", searchParams.childCount);
  }

  if (searchParams.page) {
    queryParams.append("page", searchParams.page);
  }

  if (searchParams.maxPrice) {
    queryParams.append("maxPrice", searchParams.maxPrice);
  }

  if (searchParams.sortOption) {
    queryParams.append("sortOption", searchParams.sortOption);
  }

  searchParams.facilities?.forEach((facility) =>
    queryParams.append("facilities", facility)
  );

  searchParams.types?.forEach((type) => queryParams.append("types", type));
  searchParams.stars?.forEach((star) => queryParams.append("stars", star));

  const response = await axiosInstance.get(`/api/rooms/search?${queryParams}`);
  return response.data;
};

export const fetchHotels = async (): Promise<HotelType[]> => {
  const response = await axiosInstance.get("/api/rooms");
  return response.data;
};

export const fetchHotelById = async (hotelId: string): Promise<HotelType> => {
  const response = await axiosInstance.get(`/api/rooms/${hotelId}`);
  return response.data;
};

export const fetchHotelBookings = async (
  hotelId: string
): Promise<BookingType[]> => {
  const response = await axiosInstance.get(`/api/bookings/hotel/${hotelId}`);
  return response.data;
};

export const fetchBooking = async (bookingId: string): Promise<any> => {
  const response = await axiosInstance.get(`/api/bookings/${bookingId}`);
  return response.data;
};

export type BookingDetailsUpdatePayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  nationality?: string;
  specialRequests?: string;
  adultCount?: number;
  childCount?: number;
};

export const updateBookingDetails = async (
  bookingId: string,
  payload: BookingDetailsUpdatePayload
) => {
  const response = await axiosInstance.put(`/api/bookings/${bookingId}`, payload);
  return response.data;
};

export const syncBookingFromExcel = async (bookingId: string) => {
  const response = await axiosInstance.post(`/api/bookings/${bookingId}/sync-excel`);
  return response.data;
};

export const syncBookingFromOneNote = async (bookingId: string) => {
  const response = await axiosInstance.post(`/api/bookings/${bookingId}/sync-onenote`);
  return response.data;
};

export const fetchBookingManagementRooms = async (): Promise<
  BookingManagementRoomType[]
> => {
  const response = await axiosInstance.get("/api/bookings/rooms");
  return response.data;
};

export const fetchRoomBookingCalendar = async (
  hotelId: string,
  month: string
): Promise<BookingCalendarResponseType> => {
  const response = await axiosInstance.get(
    `/api/bookings/calendar/${hotelId}?month=${encodeURIComponent(month)}`
  );
  return response.data;
};

export const saveBookingComRoomConfig = async (payload: {
  hotelId: string;
  importUrl: string;
  syncEnabled: boolean;
  exportEnabled: boolean;
}) => {
  const response = await axiosInstance.put(
    `/api/integrations/booking-com/rooms/${payload.hotelId}/config`,
    {
      importUrl: payload.importUrl,
      syncEnabled: payload.syncEnabled,
      exportEnabled: payload.exportEnabled,
    }
  );
  return response.data;
};

export const regenerateBookingComExportToken = async (hotelId: string) => {
  const response = await axiosInstance.post(
    `/api/integrations/booking-com/rooms/${hotelId}/export-token/regenerate`
  );
  return response.data;
};

export const syncBookingComCalendars = async (payload?: { hotelId?: string }) => {
  const response = await axiosInstance.post("/api/integrations/booking-com/sync", {
    hotelId: payload?.hotelId,
  });
  return response.data;
};

export const updateRoomDayStatus = async (payload: {
  hotelId: string;
  date: string;
  status: "closed" | "available";
  note?: string;
}) => {
  const response = await axiosInstance.post(
    `/api/bookings/calendar/${payload.hotelId}/day-status`,
    {
      date: payload.date,
      status: payload.status,
      note: payload.note,
    }
  );
  return response.data;
};

export const processRequestedBooking = async (payload: {
  bookingId: string;
  action: "confirm" | "reject";
  reason?: string;
}) => {
  const response = await axiosInstance.post(
    `/api/bookings/${payload.bookingId}/decision`,
    {
      action: payload.action,
      reason: payload.reason,
    }
  );
  return response.data;
};

// Business Insights API functions (public endpoints - no auth required)
export const fetchBusinessInsightsDashboard = async () => {
  const response = await axiosInstance.get("/api/business-insights/dashboard");
  return response.data;
};

export const fetchBusinessInsightsForecast = async () => {
  const response = await axiosInstance.get("/api/business-insights/forecast");
  return response.data;
};

export const fetchBusinessInsightsPerformance = async () => {
  const response = await axiosInstance.get("/api/business-insights/system-stats");
  return response.data;
};

export const fetchBookingDashboardSummary = async (filters?: {
  year?: number;
  month?: number;
  hotelId?: string;
  status?: string;
}) => {
  const params = new URLSearchParams();
  if (filters?.year) params.append("year", String(filters.year));
  if (filters?.month) params.append("month", String(filters.month));
  if (filters?.hotelId) params.append("hotelId", filters.hotelId);
  if (filters?.status) params.append("status", filters.status);

  const response = await axiosInstance.get(
    `/api/bookings/dashboard/summary?${params.toString()}`
  );
  return response.data;
};

export type UpcomingCheckInRow = {
  _id: string;
  hotelId: string;
  hotelName: string;
  hotelCity: string;
  hotelCountry: string;
  reservationNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  status: string;
  source: string;
  sourceLabel: string;
  checkIn: string;
  checkOut: string;
  arrivalTime: string;
  checkedInAt?: string;
  isCheckedIn: boolean;
  isImported: boolean;
};

export type UpcomingCheckInsResponse = {
  range: {
    start: string;
    end: string;
    days: number;
  };
  summary: {
    arrivalsToday: number;
    upcomingArrivals: number;
    inHouseToday: number;
    checkedInToday: number;
    sync: {
      totalRooms: number;
      enabledRooms: number;
      issueRooms: number;
      lastSuccessfulSyncAt: string | null;
    };
  };
  rows: UpcomingCheckInRow[];
};

export const fetchUpcomingCheckIns = async (filters?: {
  days?: number;
  hotelId?: string;
  horizon?: "upcoming" | "past";
}): Promise<UpcomingCheckInsResponse> => {
  const params = new URLSearchParams();
  if (filters?.days) params.append("days", String(filters.days));
  if (filters?.hotelId) params.append("hotelId", filters.hotelId);
  if (filters?.horizon) params.append("horizon", filters.horizon);

  const response = await axiosInstance.get(
    `/api/bookings/dashboard/upcoming-check-ins?${params.toString()}`
  );
  return response.data;
};

export type ContactFormPayload = {
  name: string;
  email: string;
  phone?: string;
  message: string;
  privacyAccepted: boolean;
};

export type BookingRequestPayload = {
  hotelId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  nationality: string;
  specialRequests?: string;
  arrivalTime: "Morning" | "Afternoon" | "Evening" | "Night";
  coupon?: string;
  adultCount: number;
  childCount: number;
  checkIn: string;
  checkOut: string;
  totalCost: number;
  nights: number;
  roomName: string;
  hotelName: string;
};

export type BookingRequestResponse = {
  message: string;
  bookingId: string;
  reservationNumber: string;
  emailsSent?: boolean;
  warning?: string;
};

export type HotelAvailabilityResponse = {
  available: boolean;
  message?: string;
  reason?: string;
  minimumNights?: number;
  conflict?: {
    bookingId?: string;
    reservationNumber?: string;
    status?: string;
  };
};

export const submitContactForm = async (payload: ContactFormPayload) => {
  const response = await axiosInstance.post("/api/contact", payload);
  return response.data;
};

export const submitBookingRequest = async (
  payload: BookingRequestPayload
): Promise<BookingRequestResponse> => {
  const response = await axiosInstance.post(
    `/api/rooms/${payload.hotelId}/booking-request`,
    payload
  );
  return response.data;
};

export const checkHotelAvailability = async (params: {
  hotelId: string;
  checkIn: string;
  checkOut: string;
  adultCount: number;
  childCount: number;
}): Promise<HotelAvailabilityResponse> => {
  const queryParams = new URLSearchParams({
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    adultCount: String(params.adultCount),
    childCount: String(params.childCount),
  });

  const response = await axiosInstance.get(
    `/api/rooms/${params.hotelId}/availability?${queryParams.toString()}`
  );

  return response.data;
};

export const closeBooking = async (bookingId: string) => {
  const response = await axiosInstance.patch(`/api/bookings/${bookingId}/close`);
  return response.data;
};

export const openBooking = async (bookingId: string) => {
  const response = await axiosInstance.patch(`/api/bookings/${bookingId}/open`);
  return response.data;
};
