import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "react-query";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
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
  reservationNumber?: string;
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
  checkInInfo?: {
    arrivalTime?: string;
    phone?: string;
    email?: string;
    nationality?: string;
    bookingChannel?: string;
    paymentDetails?: string;
    specialNotes?: string;
    documents?: string[];
    checkedInAt?: string;
  };
};

type CheckInFormData = {
  arrivalTime: string;
  phone: string;
  email: string;
  nationality: string;
  bookingChannel: string;
  paymentDetails: string;
  specialNotes: string;
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

const isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email);

const BookingCheckIn = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { showToast } = useAppContext();

  const [formData, setFormData] = useState<CheckInFormData>({
    arrivalTime: "",
    phone: "",
    email: "",
    nationality: "",
    bookingChannel: "",
    paymentDetails: "",
    specialNotes: "",
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

  useEffect(() => {
    if (!booking) return;

    setFormData((prev) => ({
      ...prev,
      arrivalTime: booking.checkInInfo?.arrivalTime || booking.arrivalTime || prev.arrivalTime,
      phone: booking.checkInInfo?.phone || booking.phone || "",
      email: booking.checkInInfo?.email || booking.email || "",
      nationality: booking.checkInInfo?.nationality || booking.nationality || "",
      bookingChannel: booking.checkInInfo?.bookingChannel || prev.bookingChannel,
      paymentDetails: booking.checkInInfo?.paymentDetails || prev.paymentDetails,
      specialNotes: booking.checkInInfo?.specialNotes || "",
    }));

    setExistingDocuments(booking.checkInInfo?.documents || []);
  }, [booking]);

  const submitCheckInMutation = useMutation(
    async () => {
      const payload = new FormData();
      payload.append("arrivalTime", formData.arrivalTime);
      payload.append("phone", formData.phone);
      payload.append("email", formData.email);
      payload.append("nationality", formData.nationality);
      payload.append("bookingChannel", formData.bookingChannel);
      payload.append("paymentDetails", formData.paymentDetails);
      payload.append("specialNotes", formData.specialNotes);
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

  const mailSubject = encodeURIComponent(
    `Palazzo Pinto Brindisi - ${booking.reservationNumber || "Booking"}`
  );
  const whatsappHref = `https://wa.me/${(formData.phone || "").replace(/\D/g, "")}`;
  const ms = new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime();
  const nights = Math.max(1, Math.ceil(ms / 86400000));
  const taxableDays = Math.min(nights, 7);
  const guestCount = booking.adultCount + booking.childCount;
  const cityTax = taxableDays * guestCount * 2.5;
  const totalWithCityTax = booking.totalCost + cityTax;

  const missingRequiredFields: string[] = [];
  if (!formData.arrivalTime.trim()) missingRequiredFields.push("arrival time");
  if (!formData.phone.trim()) missingRequiredFields.push("phone number");
  if (!formData.email.trim() || !isValidEmail(formData.email)) {
    missingRequiredFields.push("valid email");
  }
  if (!formData.nationality.trim()) missingRequiredFields.push("nationality");
  if (!formData.bookingChannel.trim()) missingRequiredFields.push("booking channel");
  if (!formData.paymentDetails.trim()) missingRequiredFields.push("payment details");
  const isFormValid = missingRequiredFields.length === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(-1)}
          className="h-10 w-10 rounded-full p-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Guest Check-in</h1>
          <p className="text-gray-600">Ref: {booking.reservationNumber || "N/A"}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary-600" />
            Booking Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-gray-600">Guest</p>
            <p className="font-semibold text-gray-900">
              {booking.firstName} {booking.lastName}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Stay</p>
            <p className="font-semibold text-gray-900">
              {formatFriendlyDate(booking.checkIn)} to {formatFriendlyDate(booking.checkOut)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 flex items-center gap-1">
              <Users className="h-4 w-4" /> Guests
            </p>
            <p className="font-semibold text-gray-900">
              {booking.adultCount} Adult{booking.adultCount > 1 ? "s" : ""}
              {booking.childCount > 0
                ? `, ${booking.childCount} Child${booking.childCount > 1 ? "ren" : ""}`
                : ""}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 flex items-center gap-1">
              <DollarSign className="h-4 w-4" /> Total Due Today
            </p>
            <p className="font-semibold text-gray-900">EUR {totalWithCityTax.toFixed(2)}</p>
            <p className="mt-1 text-xs text-gray-600">Room total: EUR {booking.totalCost.toFixed(2)}</p>
            <p className="text-xs text-gray-600">
              City tax: EUR {cityTax.toFixed(2)} ({taxableDays} day{taxableDays > 1 ? "s" : ""} x {guestCount} guest{guestCount > 1 ? "s" : ""} x EUR 2.50, max 7 days)
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 flex items-center gap-1">
              <MapPin className="h-4 w-4" /> City / Country
            </p>
            <p className="font-semibold text-gray-900">
              {booking.city || "N/A"} {booking.country ? `, ${booking.country}` : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Check-in Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-gray-700">Arrival Time *</label>
              <input
                type="time"
                value={formData.arrivalTime}
                onChange={(e) => setFormData((prev) => ({ ...prev, arrivalTime: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Phone className="h-4 w-4" /> Phone Number *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Mail className="h-4 w-4" /> Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
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
              <label className="text-sm font-semibold text-gray-700">Nationality *</label>
              <select
                value={formData.nationality}
                onChange={(e) => setFormData((prev) => ({ ...prev, nationality: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="">Select nationality</option>
                {NATIONALITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Globe className="h-4 w-4" /> Booking Channel *
              </label>
              <select
                value={formData.bookingChannel}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, bookingChannel: e.target.value }))
                }
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="">Select booking channel</option>
                {BOOKING_CHANNEL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">Payment Details *</label>
              <select
                value={formData.paymentDetails}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, paymentDetails: e.target.value }))
                }
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="">Select payment details</option>
                {PAYMENT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Special Notes</label>
            <textarea
              rows={3}
              value={formData.specialNotes}
              onChange={(e) => setFormData((prev) => ({ ...prev, specialNotes: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="Optional notes"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Guest Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {existingDocuments.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-sm font-semibold text-gray-700">Saved Documents</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {existingDocuments.map((url) => (
                  <div key={url} className="rounded-md border border-gray-200 p-2">
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

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button
          className="flex-1"
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
          {submitCheckInMutation.isLoading ? "Saving..." : "Save Check-in"}
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
