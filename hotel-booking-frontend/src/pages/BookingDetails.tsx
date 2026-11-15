import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "react-query";
import * as apiClient from "../api-client";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Clock,
  CheckCircle2,
  CheckCheck,
  Mail,
  Phone,
  Calendar,
  FileText,
  AlertCircle,
  X,
  Check,
  Edit,
  Save,
  ArrowLeft,
  Flag,
  User,
} from "lucide-react";
import { BookingType } from "../../../shared/types";

interface BookingDetailsResponse extends Omit<BookingType, "status"> {
  hotelId: any;
  hotelName?: string;
  status?: BookingType["status"] | "imported";
  isImported?: boolean;
  summary?: string;
  source?: "local" | "booking_com";
  sourceLabel?: string;
}

const BookingDetails = () => {
    // Mutations for close/open booking
    const closeBookingMutation = useMutation(
      () => apiClient.closeBooking(bookingId || ""),
      {
        onSuccess: () => {
          queryClient.invalidateQueries(["bookingDetails", bookingId]);
        },
      }
    );
    const openBookingMutation = useMutation(
      () => apiClient.openBooking(bookingId || ""),
      {
        onSuccess: () => {
          queryClient.invalidateQueries(["bookingDetails", bookingId]);
        },
      }
    );
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [saveError, setSaveError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<BookingDetailsResponse>>({});

  // Fetch booking details
  const { data: booking, isLoading, error, isError } = useQuery<BookingDetailsResponse>(
    ["bookingDetails", bookingId],
    () => apiClient.fetchBooking(bookingId || ""),
    {
      enabled: !!bookingId,
    }
  );

  useEffect(() => {
    if (booking) {
      setFormData(booking);
    }
  }, [booking]);

  // Status configuration
  const statusConfig = {
    pending: {
      label: "Pending",
      color: "amber",
      icon: Clock,
      badge: "bg-amber-100 text-amber-900",
    },
    confirmed: {
      label: "Confirmed",
      color: "blue",
      icon: CheckCircle2,
      badge: "bg-blue-100 text-blue-900",
    },
    arrived: {
      label: "Arrived",
      color: "purple",
      icon: CheckCheck,
      badge: "bg-purple-100 text-purple-900",
    },
    completed: {
      label: "Completed",
      color: "green",
      icon: CheckCircle2,
      badge: "bg-green-100 text-green-900",
    },
    cancelled: {
      label: "Cancelled",
      color: "red",
      icon: X,
      badge: "bg-red-100 text-red-900",
    },
    refunded: {
      label: "Refunded",
      color: "orange",
      icon: Flag,
      badge: "bg-orange-100 text-orange-900",
    },
    imported: {
      label: "Imported",
      color: "slate",
      icon: Calendar,
      badge: "bg-slate-100 text-slate-900",
    },
  };

  const currentStatus =
    booking?.status && booking.status in statusConfig
      ? (booking.status as keyof typeof statusConfig)
      : "pending";
  const config = statusConfig[currentStatus];
  const StatusIcon = config.icon;

  // Mutations
  const updateBookingMutation = useMutation(
    (data: apiClient.BookingDetailsUpdatePayload) =>
      apiClient.updateBookingDetails(bookingId || "", data),
    {
      onSuccess: () => {
        setSaveError(null);
        queryClient.invalidateQueries(["bookingDetails", bookingId]);
        setIsEditing(false);
      },
      onError: (mutationError: any) => {
        setSaveError(
          mutationError?.response?.data?.message ||
            mutationError?.response?.data?.reason ||
            "Unable to save booking changes"
        );
      },
    }
  );

  const makeDecisionMutation = useMutation(
    (data: { action: "confirm" | "reject"; reason?: string }) =>
      apiClient.processRequestedBooking({
        bookingId: bookingId || "",
        action: data.action,
        reason: data.reason,
      }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["bookingDetails", bookingId]);
        setShowRejectModal(false);
        setShowConfirmModal(false);
      },
    }
  );

  const handleGuestCountChange = (field: "adultCount" | "childCount", value: string) => {
    const nextValue = Number(value);

    setFormData({
      ...formData,
      [field]: Number.isNaN(nextValue) ? 0 : Math.max(0, nextValue),
    });
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/booking-dashboard");
  };

  const getWhatsAppUrl = (phone?: string) => {
    const normalized = String(phone || "").replace(/[^\d+]/g, "");
    const waNumber = normalized.startsWith("+") ? normalized.slice(1) : normalized;

    if (!waNumber) {
      return null;
    }

    return `https://wa.me/${waNumber}`;
  };

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const roomName = booking?.hotelName || "";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f6f8] py-8 px-4 text-slate-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading booking details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div className="min-h-screen bg-[#f5f6f8] py-8 px-4 text-slate-900">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-teal-600 hover:text-teal-700 mb-8"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Dashboard
          </button>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-8">
              <div className="flex items-center gap-3 text-red-700">
                <AlertCircle className="h-6 w-6" />
                <p>{error instanceof Error ? error.message : "Failed to load booking details"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] py-8 px-4 text-slate-900 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-teal-600 hover:text-teal-700 mb-4"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Dashboard
          </button>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="mb-2 text-3xl font-semibold tracking-tight text-slate-950">
                Booking #{booking.reservationNumber}
              </h1>
              {roomName && (
                <div className="mb-3 inline-flex items-center rounded-md bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                  Room: {roomName}
                </div>
              )}
              <p className="text-gray-600">
                Reservation Number: {booking.reservationNumber}
              </p>
              {booking.closedAt && (
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                  <X className="h-4 w-4" /> Booking Closed
                </div>
              )}
            </div>
            <div className="text-right">
              <div className={`px-4 py-2 rounded-lg font-semibold ${config.badge}`}>
                <div className="flex items-center gap-2">
                  <StatusIcon className="h-5 w-5" />
                  {config.label}
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Created {formatDate(booking.createdAt)}
              </p>
            </div>
          </div>

          {/* Action Menu Bar */}
          <div className="mt-6 flex flex-wrap gap-3 items-center border-b pb-4 mb-4">

            {/* Close/Open button */}
            {!booking.closedAt ? (
              <button
                onClick={() => closeBookingMutation.mutate()}
                disabled={closeBookingMutation.isLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X className="h-4 w-4" />
                {closeBookingMutation.isLoading ? "Closing..." : "Close"}
              </button>
            ) : (
              <button
                onClick={() => openBookingMutation.mutate()}
                disabled={openBookingMutation.isLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check className="h-4 w-4" />
                {openBookingMutation.isLoading ? "Opening..." : "Open"}
              </button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Guest Information */}
          <Card className="border border-slate-200 shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-teal-600" />
                  Guest Information
                </CardTitle>
                {!isEditing && (
                  <button
                    onClick={() => {
                      setSaveError(null);
                      setIsEditing(true);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-teal-600 hover:bg-teal-50 rounded-lg transition"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {saveError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {saveError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.firstName || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, firstName: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{booking.firstName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.lastName || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, lastName: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{booking.lastName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={formData.email || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{booking.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone
                  </label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={formData.phone || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  ) : (
                    <div className="space-y-1">
                      <p className="text-gray-900 font-medium">{booking.phone || "-"}</p>
                      {getWhatsAppUrl(booking.phone) && (
                        <a
                          href={getWhatsAppUrl(booking.phone) || undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-sm font-medium text-emerald-700 hover:text-emerald-800"
                        >
                          Open in WhatsApp
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nationality
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.nationality || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, nationality: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{booking.nationality || "-"}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Guests
                  </label>
                  {isEditing ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500">
                          Adults
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.adultCount ?? 0}
                          onChange={(e) => handleGuestCountChange("adultCount", e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500">
                          Children
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.childCount ?? 0}
                          onChange={(e) => handleGuestCountChange("childCount", e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-900 font-medium">
                      {booking.adultCount} Adult{booking.adultCount !== 1 ? "s" : ""},{" "}
                      {booking.childCount} Child{booking.childCount !== 1 ? "ren" : ""}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking Information */}
          <Card className="border border-slate-200 shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-teal-600" />
                  Booking Details
                </CardTitle>

              </div>
            </CardHeader>
            <CardContent>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Check-in
                  </label>
                  <p className="text-gray-900 font-medium">{formatDate(booking.checkIn)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Check-out
                  </label>
                  <p className="text-gray-900 font-medium">
                    {formatDate(booking.checkOut)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Cost
                  </label>
                  <p className="text-gray-900 font-bold text-lg">
                    €{booking.totalCost?.toFixed(2) || "0.00"}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Via
                  </label>
                  <p className="text-gray-900 font-medium">
                    {booking.checkInInfo?.paymentDetails || "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Special Requests */}
          {booking.specialRequests && (
            <Card className="border border-slate-200 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-teal-600" />
                  Special Requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <textarea
                    value={formData.specialRequests || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, specialRequests: e.target.value })
                    }
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                ) : (
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {booking.specialRequests}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Status-Specific Actions */}
          {booking.status === "pending" && (
            <Card className="border border-slate-200 bg-white shadow-none">
              <CardHeader>
                <CardTitle className="text-amber-900">Pending Confirmation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-amber-800 mb-4">
                  This booking request is awaiting your confirmation. Please review the details
                  and confirm or reject the request.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    disabled={makeDecisionMutation.isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    Confirm Booking
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={makeDecisionMutation.isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Reject Request
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {booking.status === "confirmed" && (
            <Card className="border border-slate-200 bg-white shadow-none">
              <CardHeader>
                <CardTitle className="text-blue-900">Ready for Check-in</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-blue-800 mb-4">
                  Guest has confirmed their booking. You can now manage the check-in process.
                </p>
                <button
                  onClick={() => {
                    const selectedHotelId =
                      typeof booking.hotelId === "object"
                        ? booking.hotelId?._id
                        : booking.hotelId;
                    if (selectedHotelId) {
                      navigate(`/hotel/${selectedHotelId}/check-in/${bookingId}`);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Process Check-in
                </button>
              </CardContent>
            </Card>
          )}

          {booking.status === "cancelled" && booking.cancellationReason && (
            <Card className="border-red-200 bg-red-50 border-2">
              <CardHeader>
                <CardTitle className="text-red-900">Cancellation Reason</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-red-800">{booking.cancellationReason}</p>
              </CardContent>
            </Card>
          )}

          {["arrived", "completed"].includes(currentStatus) && (
            <Card className="border border-slate-200 shadow-none">
              <CardHeader>
                <CardTitle>Status Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 bg-green-600 rounded-full"></div>
                    <p className="text-gray-800">
                      Booking confirmed on {formatDate(booking.updatedAt)}
                    </p>
                  </div>
                  {booking.status === "arrived" && (
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 bg-blue-600 rounded-full"></div>
                      <p className="text-gray-800">Guest has arrived</p>
                    </div>
                  )}
                  {booking.status === "completed" && (
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 bg-green-600 rounded-full"></div>
                      <p className="text-gray-800">
                        Booking completed on {formatDate(booking.updatedAt)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Edit Actions */}
          {isEditing && (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSaveError(null);
                  updateBookingMutation.mutate({
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    email: formData.email,
                    phone: formData.phone,
                    nationality: formData.nationality,
                    specialRequests: formData.specialRequests,
                    adultCount: formData.adultCount ?? booking.adultCount,
                    childCount: formData.childCount ?? booking.childCount,
                  });
                }}
                disabled={updateBookingMutation.isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Save Changes
              </button>
              <button
                onClick={() => {
                  setSaveError(null);
                  setFormData(booking);
                  setIsEditing(false);
                }}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Reject Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Reject Booking Request</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Rejection (optional)
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Provide a reason for rejecting this booking..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      makeDecisionMutation.mutate({
                        action: "reject",
                        reason: rejectReason,
                      });
                    }}
                    disabled={makeDecisionMutation.isLoading}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => setShowRejectModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Confirm Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Confirm Booking</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-700">
                  Are you sure you want to confirm this booking? The guest will receive a
                  confirmation email.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      makeDecisionMutation.mutate({ action: "confirm" });
                    }}
                    disabled={makeDecisionMutation.isLoading}
                    className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingDetails;
