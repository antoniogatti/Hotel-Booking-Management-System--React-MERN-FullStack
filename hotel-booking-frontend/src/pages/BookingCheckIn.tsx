import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "react-query";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Euro,
  FileText,
  Globe,
  Mail,
  MapPin,
  Phone,
  Save,
  Users,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { MobileFileUpload } from "../components/MobileFileUpload";
import useAppContext from "../hooks/useAppContext";
import axiosInstance from "../lib/api-client";
import { formatFriendlyDate } from "../lib/utils";

type BookingDetails = {
  _id: string;
  closedAt?: string | Date;
  hotelName?: string;
  hotelId?: string | { name?: string };
  reservationNumber?: string;
  isImported?: boolean;
  source?: "local" | "booking_com";
  sourceLabel?: string;
  status?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  city?: string;
  country?: string;
  adultCount: number;
  childCount: number;
  arrivalTime?: "Morning" | "Afternoon" | "Evening" | "Night";
  nationality?: string;
  checkIn: string;
  checkOut: string;
  totalCost: number;
  specialRequests?: string;
  summary?: string;
  externalUid?: string;
  checkInInfo?: {
    arrivalTime?: string;
    phone?: string;
    email?: string;
    nationality?: string;
    bookingChannel?: string;
    paymentDetails?: string;
    specialNotes?: string;
    breakfast?: {
      time?: string;
      savouryCount?: number;
      sweetCount?: number;
    };
    documents?: string[];
    checkedInAt?: string;
  };
  excelSync?: {
    paymentVia?: string;
  };
  oneNoteSync?: {
    lastSyncedAt?: string;
    matchedPageTitle?: string;
    matchedSectionName?: string;
    room?: string;
    guestName?: string;
    arrivalNote?: string;
    nationality?: string;
    phone?: string;
    whatsapp?: string;
    nights?: number;
    checkOutNote?: string;
    bookingSource?: string;
    paymentNote?: string;
    amountDueEUR?: number;
    notes?: string;
    rawLines?: string[];
  };
};

type CheckInFormData = {
  firstName: string;
  lastName: string;
  adultCount: number;
  childCount: number;
  specialRequests: string;
  arrivalTime: string;
  phone: string;
  email: string;
  nationality: string;
  bookingChannel: string;
  paymentDetails: string;
  specialNotes: string;
  breakfastTime: string;
  breakfastSavouryCount: number;
  breakfastSweetCount: number;
  documents: File[];
};

const BOOKING_CHANNEL_OPTIONS = [
  "Direct",
  "Booking.com",
  "Airbnb",
  "Expedia",
  "Vrbo",
  "Other",
];

const PAYMENT_OPTIONS = [
  "Card online",
  "Cash at check-in",
  "Bank transfer",
  "POS card on arrival",
  "Other",
];

const NATIONALITY_OPTIONS = [
  "Italian",
  "French",
  "German",
  "Spanish",
  "British",
  "American",
  "Other",
];

const extractTimeValue = (value?: string) => {
  if (!value) {
    return "";
  }

  if (/^\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  const match = value.match(/(\d{1,2})[:.](\d{2})/);
  if (!match) {
    return "";
  }

  const hours = match[1].padStart(2, "0");
  const minutes = match[2];
  return `${hours}:${minutes}`;
};

const withCurrentOption = (options: string[], currentValue: string) => {
  if (!currentValue || options.includes(currentValue)) {
    return options;
  }

  return [currentValue, ...options];
};

const formatSyncDate = (value?: string) => {
  if (!value) {
    return "Not synced yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not synced yet";
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email);

const BookingCheckIn = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { showToast } = useAppContext();
  const [isOneNoteOpen, setIsOneNoteOpen] = useState(false);

  const [formData, setFormData] = useState<CheckInFormData>({
    firstName: "",
    lastName: "",
    adultCount: 1,
    childCount: 0,
    specialRequests: "",
    arrivalTime: "",
    phone: "",
    email: "",
    nationality: "",
    bookingChannel: "",
    paymentDetails: "",
    specialNotes: "",
    breakfastTime: "",
    breakfastSavouryCount: 0,
    breakfastSweetCount: 0,
    documents: [],
  });
  const [existingDocuments, setExistingDocuments] = useState<string[]>([]);

  const { data: booking, isLoading } = useQuery<BookingDetails>(
    ["booking", bookingId],
    async () => {
      const response = await axiosInstance.get(`/api/bookings/${bookingId}`);
      return response.data as BookingDetails;
    },
    {
      enabled: Boolean(bookingId),
      onError: () => {
        showToast({ title: "Failed to load booking details", type: "ERROR" });
      },
    }
  );

  const isImportedBooking = Boolean(booking?.isImported || booking?.source === "booking_com" || booking?.status === "imported");
  const guestDisplayName = `${formData.firstName} ${formData.lastName}`.trim() || (isImportedBooking ? "Booking.com imported booking" : "Guest details not available");

  useEffect(() => {
    if (!booking) return;

    const oneNoteArrivalTime = extractTimeValue(booking.oneNoteSync?.arrivalNote);

    setFormData((prev) => ({
      ...prev,
      firstName: booking.firstName || "",
      lastName: booking.lastName || "",
      adultCount: booking.adultCount || 1,
      childCount: booking.childCount || 0,
      specialRequests: booking.specialRequests || "",
      arrivalTime:
        extractTimeValue(booking.checkInInfo?.arrivalTime) ||
        oneNoteArrivalTime ||
        extractTimeValue(booking.arrivalTime) ||
        prev.arrivalTime,
      phone: booking.checkInInfo?.phone || booking.phone || booking.oneNoteSync?.phone || "",
      email: booking.checkInInfo?.email || booking.email || "",
      nationality:
        booking.checkInInfo?.nationality ||
        booking.nationality ||
        booking.oneNoteSync?.nationality ||
        "",
      bookingChannel:
        booking.checkInInfo?.bookingChannel ||
        booking.oneNoteSync?.bookingSource ||
        (booking.source === "booking_com" ? "Booking.com" : prev.bookingChannel),
      paymentDetails:
        booking.checkInInfo?.paymentDetails ||
        booking.oneNoteSync?.paymentNote ||
        booking.excelSync?.paymentVia ||
        prev.paymentDetails,
      specialNotes: booking.checkInInfo?.specialNotes || "",
      breakfastTime: booking.checkInInfo?.breakfast?.time || "",
      breakfastSavouryCount: booking.checkInInfo?.breakfast?.savouryCount || 0,
      breakfastSweetCount: booking.checkInInfo?.breakfast?.sweetCount || 0,
    }));

    setExistingDocuments(booking.checkInInfo?.documents || []);
  }, [booking]);

  const submitCheckInMutation = useMutation(
    async () => {
      const payload = new FormData();
      payload.append("firstName", formData.firstName);
      payload.append("lastName", formData.lastName);
      payload.append("adultCount", String(formData.adultCount));
      payload.append("childCount", String(formData.childCount));
      payload.append("specialRequests", formData.specialRequests);
      payload.append("arrivalTime", formData.arrivalTime);
      payload.append("phone", formData.phone);
      payload.append("email", formData.email);
      payload.append("nationality", formData.nationality);
      payload.append("bookingChannel", formData.bookingChannel);
      payload.append("paymentDetails", formData.paymentDetails);
      payload.append("specialNotes", formData.specialNotes);
      payload.append("breakfastTime", formData.breakfastTime);
      payload.append("breakfastSavouryCount", String(formData.breakfastSavouryCount));
      payload.append("breakfastSweetCount", String(formData.breakfastSweetCount));
      existingDocuments.forEach((url) => payload.append("existingDocuments", url));
      formData.documents.forEach((doc) => payload.append("documents", doc));

      return axiosInstance.post(`/api/bookings/${bookingId}/check-in`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    {
      onSuccess: () => {
        showToast({ title: "Check-in submitted successfully", type: "SUCCESS" });
        navigate(-1);
      },
      onError: (error: any) => {
        const message = error?.response?.data?.message || "Failed to submit check-in";
        showToast({ title: message, type: "ERROR" });
      },
    }
  );


  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">Loading booking details...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">Booking not found</p>
      </div>
    );
  }

  if (booking.closedAt) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-600 font-semibold">This booking is closed and cannot be checked in.</p>
      </div>
    );
  }

  const mailSubject = encodeURIComponent(
    `Palazzo Pinto Brindisi - ${booking.reservationNumber || "Booking"}`
  );
  const hotelName = booking.hotelName || (typeof booking.hotelId === "object" ? booking.hotelId?.name || "" : "");
  const normalizedHotelName = hotelName.toLowerCase();
  const supportsBreakfast = normalizedHotelName.includes("malvasia") || normalizedHotelName.includes("verdeca");
  const breakfastTotal = formData.breakfastSavouryCount + formData.breakfastSweetCount;
  const whatsappHref = `https://wa.me/${(formData.phone || "").replace(/\D/g, "")}`;
  const ms = new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime();
  const nights = Math.max(1, Math.ceil(ms / 86400000));
  const taxableDays = Math.min(nights, 7);
  const guestCount = Math.max(1, formData.adultCount + formData.childCount);
  const cityTax = taxableDays * guestCount * 2.5;
  const currentTotalCost = Math.max(0, Number(booking.totalCost || 0));
  const totalWithCityTax = currentTotalCost + cityTax;
  const bookingChannelOptions = withCurrentOption(BOOKING_CHANNEL_OPTIONS, formData.bookingChannel);
  const paymentOptions = withCurrentOption(PAYMENT_OPTIONS, formData.paymentDetails);
  const nationalityOptions = withCurrentOption(NATIONALITY_OPTIONS, formData.nationality);
  const inputClass =
    "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500";
  const selectClass = inputClass;
  const labelClass = "text-sm font-semibold text-gray-700";
  const detailBlockClass = "rounded-2xl bg-slate-50 p-4";

  const missingRequiredFields: string[] = [];
  if (isImportedBooking && !formData.firstName.trim()) missingRequiredFields.push("guest first name");
  if (isImportedBooking && !formData.lastName.trim()) missingRequiredFields.push("guest last name");
  if (isImportedBooking && formData.adultCount + formData.childCount < 1) {
    missingRequiredFields.push("guest count");
  }
  if (formData.email.trim() && !isValidEmail(formData.email)) {
    missingRequiredFields.push("valid email");
  }
  if (supportsBreakfast && breakfastTotal > guestCount) {
    missingRequiredFields.push(`breakfast total must not exceed ${guestCount} guests`);
  }
  if (supportsBreakfast && breakfastTotal > 0 && !formData.breakfastTime) {
    missingRequiredFields.push("breakfast time");
  }
  const isFormValid = missingRequiredFields.length === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-3 py-4 sm:space-y-6 sm:px-4 md:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(-1)}
          className="h-10 w-10 rounded-full p-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
            Guest Check-in{hotelName ? ` - ${hotelName}` : ""}
          </h1>
          <p className="break-all text-sm text-gray-600 sm:text-base">Ref: {booking.reservationNumber || "N/A"}</p>
        </div>
      </div>

      <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary-600" />
            Booking Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className={detailBlockClass}>
            <p className="text-sm text-gray-600">Guest</p>
            <p className="font-semibold text-gray-900">
              {guestDisplayName}
            </p>
          </div>
          <div className={detailBlockClass}>
            <p className="text-sm text-gray-600">Stay</p>
            <p className="font-semibold text-gray-900">
              {formatFriendlyDate(booking.checkIn)} to {formatFriendlyDate(booking.checkOut)}
            </p>
          </div>
          <div className={detailBlockClass}>
            <p className="text-sm text-gray-600 flex items-center gap-1">
              <Users className="h-4 w-4" /> Guests
            </p>
            <p className="font-semibold text-gray-900">
              {formData.adultCount} Adult{formData.adultCount > 1 ? "s" : ""}
              {formData.childCount > 0
                ? `, ${formData.childCount} Child${formData.childCount > 1 ? "ren" : ""}`
                : ""}
            </p>
          </div>
          <div className={detailBlockClass}>
            <p className="text-sm text-gray-600 flex items-center gap-1">
              <Euro className="h-4 w-4" /> Total Due Today
            </p>
            <p className="text-lg font-semibold text-gray-900">€{totalWithCityTax.toFixed(2)}</p>
            <p className="mt-1 text-xs text-gray-600">Room total: €{currentTotalCost.toFixed(2)}</p>
            <p className="mt-1 text-xs leading-5 text-gray-600">
              City tax: €{cityTax.toFixed(2)} ({taxableDays} day{taxableDays > 1 ? "s" : ""} x {guestCount} guest{guestCount > 1 ? "s" : ""} x €2.50, max 7 days)
            </p>
          </div>
          <div className={`${detailBlockClass} sm:col-span-2 xl:col-span-1`}>
            <p className="text-sm text-gray-600 flex items-center gap-1">
              <MapPin className="h-4 w-4" /> City / Country
            </p>
            <p className="font-semibold text-gray-900">
              {booking.city || "N/A"} {booking.country ? `, ${booking.country}` : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      {(booking.oneNoteSync || booking.excelSync) && (
        <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <button
              type="button"
              onClick={() => setIsOneNoteOpen((current) => !current)}
              className="flex w-full items-center justify-between gap-4 text-left"
              aria-expanded={isOneNoteOpen}
            >
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-cyan-600" />
                  OneNote Details
                </CardTitle>
                <p className="mt-2 text-sm text-gray-600">
                  Synced notes and extracted booking details used to prefill the check-in form.
                </p>
              </div>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${isOneNoteOpen ? "rotate-180" : ""}`}
              />
            </button>
          </CardHeader>
          {isOneNoteOpen && (
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className={detailBlockClass}>
                <p className="text-sm text-gray-600">Last OneNote Sync</p>
                <p className="font-semibold text-gray-900">{formatSyncDate(booking.oneNoteSync?.lastSyncedAt)}</p>
              </div>
              <div className={detailBlockClass}>
                <p className="text-sm text-gray-600">Matched Page</p>
                <p className="font-semibold text-gray-900">{booking.oneNoteSync?.matchedPageTitle || "-"}</p>
              </div>
              <div className={detailBlockClass}>
                <p className="text-sm text-gray-600">Arrival</p>
                <p className="font-semibold text-gray-900">{booking.oneNoteSync?.arrivalNote || booking.checkInInfo?.arrivalTime || "-"}</p>
              </div>
              <div className={detailBlockClass}>
                <p className="text-sm text-gray-600">Nationality</p>
                <p className="font-semibold text-gray-900">{booking.oneNoteSync?.nationality || booking.nationality || "-"}</p>
              </div>
              <div className={detailBlockClass}>
                <p className="text-sm text-gray-600">Booking Channel</p>
                <p className="font-semibold text-gray-900">{booking.oneNoteSync?.bookingSource || booking.checkInInfo?.bookingChannel || booking.sourceLabel || "-"}</p>
              </div>
              <div className={detailBlockClass}>
                <p className="text-sm text-gray-600">Payment</p>
                <p className="font-semibold text-gray-900">
                  {booking.oneNoteSync?.paymentNote || booking.excelSync?.paymentVia || booking.checkInInfo?.paymentDetails || "-"}
                </p>
              </div>
              <div className={detailBlockClass}>
                <p className="text-sm text-gray-600">Phone / WhatsApp</p>
                <p className="font-semibold break-words text-gray-900">
                  {booking.oneNoteSync?.phone || booking.phone || "-"}
                  {booking.oneNoteSync?.whatsapp ? ` · ${booking.oneNoteSync.whatsapp}` : ""}
                </p>
              </div>
              <div className={detailBlockClass}>
                <p className="text-sm text-gray-600">Amount Due</p>
                <p className="font-semibold text-gray-900">
                  {typeof booking.oneNoteSync?.amountDueEUR === "number"
                    ? `EUR ${booking.oneNoteSync.amountDueEUR.toFixed(2)}`
                    : `EUR ${currentTotalCost.toFixed(2)}`}
                </p>
              </div>
              {booking.oneNoteSync?.notes && (
                <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
                  <p className="text-sm text-gray-600">Notes</p>
                  <p className="whitespace-pre-wrap text-gray-800">{booking.oneNoteSync.notes}</p>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Check-in Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isImportedBooking && (
            <div className="grid grid-cols-1 gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:grid-cols-2">
              <div className="text-sm leading-6 text-blue-900 sm:col-span-2">
                This reservation was imported from Booking.com. The guest-name fields below are intentionally separate from the import source so you can enter the real guest details manually.
              </div>
              <div>
                <label className={labelClass}>Guest First Name *</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Guest Last Name *</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Adults *</label>
                <input
                  type="number"
                  min={0}
                  value={formData.adultCount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, adultCount: Number(e.target.value) || 0 }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Children</label>
                <input
                  type="number"
                  min={0}
                  value={formData.childCount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, childCount: Number(e.target.value) || 0 }))}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Special Requests</label>
                <textarea
                  rows={2}
                  value={formData.specialRequests}
                  onChange={(e) => setFormData((prev) => ({ ...prev, specialRequests: e.target.value }))}
                  className={inputClass}
                  placeholder="Optional guest requests or notes"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Arrival Time</label>
              <input
                type="time"
                value={formData.arrivalTime}
                onChange={(e) => setFormData((prev) => ({ ...prev, arrivalTime: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={`flex items-center gap-2 ${labelClass}`}>
                <Phone className="h-4 w-4" /> Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                className={inputClass}
              />
              {formData.phone && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-primary-600"
                >
                  Open WhatsApp
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={`flex items-center gap-2 ${labelClass}`}>
                <Mail className="h-4 w-4" /> Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                className={inputClass}
              />
              {formData.email && (
                <a
                  href={`mailto:${formData.email}?subject=${mailSubject}`}
                  className="mt-1 inline-block text-xs text-primary-600"
                >
                  Send Email
                </a>
              )}
            </div>
            <div>
              <label className={labelClass}>Nationality</label>
              <select
                value={formData.nationality}
                onChange={(e) => setFormData((prev) => ({ ...prev, nationality: e.target.value }))}
                className={selectClass}
              >
                <option value="">Select nationality</option>
                {nationalityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={`flex items-center gap-2 ${labelClass}`}>
                <Globe className="h-4 w-4" /> Booking Channel
              </label>
              <select
                value={formData.bookingChannel}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, bookingChannel: e.target.value }))
                }
                className={selectClass}
              >
                <option value="">Select booking channel</option>
                {bookingChannelOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Payment Details</label>
              <select
                value={formData.paymentDetails}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, paymentDetails: e.target.value }))
                }
                className={selectClass}
              >
                <option value="">Select payment details</option>
                {paymentOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {supportsBreakfast ? (
            <div className="space-y-4 rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
              <div>
                <label className={labelClass}>Breakfast Time</label>
                <input
                  type="time"
                  value={formData.breakfastTime}
                  onChange={(e) => setFormData((prev) => ({ ...prev, breakfastTime: e.target.value }))}
                  className={`${inputClass} sm:max-w-xs`}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Savoury</label>
                  <input
                    type="number"
                    min={0}
                    max={guestCount}
                    value={formData.breakfastSavouryCount}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        breakfastSavouryCount: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Sweet</label>
                  <input
                    type="number"
                    min={0}
                    max={guestCount}
                    value={formData.breakfastSweetCount}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        breakfastSweetCount: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className={inputClass}
                  />
                </div>
              </div>
              <p className="text-xs text-amber-800">
                Total breakfasts selected: {breakfastTotal} / {guestCount} guests.
              </p>
            </div>
          ) : (
            <div>
              <label className={labelClass}>Special Notes</label>
              <textarea
                rows={3}
                value={formData.specialNotes}
                onChange={(e) => setFormData((prev) => ({ ...prev, specialNotes: e.target.value }))}
                className={inputClass}
                placeholder="Optional notes"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Guest Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {existingDocuments.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-sm font-semibold text-gray-700">Saved Documents</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {existingDocuments.map((url) => (
                  <div key={url} className="rounded-xl border border-gray-200 p-2">
                    <a href={url} target="_blank" rel="noreferrer" className="block">
                      <img
                        src={url}
                        alt="Saved guest document"
                        className="h-24 w-full rounded object-cover"
                      />
                    </a>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() =>
                        setExistingDocuments((prev) => prev.filter((item) => item !== url))
                      }
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <MobileFileUpload
            label="Documents"
            description="Tap to upload or take a photo"
            accept="image/*"
            multiple={true}
            onFilesChange={(files) => setFormData((prev) => ({ ...prev, documents: files }))}
          />
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button variant="secondary" className="w-full sm:flex-1" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button
          className="w-full sm:flex-1"
          onClick={() => {
            if (!isFormValid) {
              showToast({
                title: `Please fill required fields: ${missingRequiredFields.join(", ")}`,
                type: "ERROR",
              });
              return;
            }

            submitCheckInMutation.mutate();
          }}
          disabled={submitCheckInMutation.isLoading || !isFormValid}
        >
          <Save className="mr-2 h-4 w-4" />
          {submitCheckInMutation.isLoading ? "Saving..." : isImportedBooking ? "Save Details and Check-in" : "Save Check-in"}
        </Button>
      </div>
      {!isFormValid && (
        <p className="text-sm text-rose-600">
          Required fields: {missingRequiredFields.join(", ")}.
        </p>
      )}
    </div>
  );
};

export default BookingCheckIn;
