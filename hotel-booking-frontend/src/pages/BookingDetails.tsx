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

interface BookingDetailsResponse extends BookingType {
  hotelId: any;
}

const BookingDetails = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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
  };

  const currentStatus = (booking?.status || "pending") as keyof typeof statusConfig;
  const config = statusConfig[currentStatus];
  const StatusIcon = config.icon;

  // Mutations
  const updateBookingMutation = useMutation(
    (data: any) =>
      fetch(`/api/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((res) => res.json()),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["bookingDetails", bookingId]);
        setIsEditing(false);
      },
    }
  );

  const makeDecisionMutation = useMutation(
    (data: { action: "confirm" | "reject"; reason?: string }) =>
      fetch(`/api/bookings/${bookingId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((res) => res.json()),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["bookingDetails", bookingId]);
        setShowRejectModal(false);
        setShowConfirmModal(false);
      },
    }
  );

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate("/booking-dashboard")}
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/booking-dashboard")}
            className="flex items-center gap-2 text-teal-600 hover:text-teal-700 mb-4"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Dashboard
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Booking #{booking.reservationNumber}
              </h1>
              <p className="text-gray-600">
                Reservation Number: {booking.reservationNumber}
              </p>
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
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Guest Information */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-teal-600" />
                  Guest Information
                </CardTitle>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-teal-600 hover:bg-teal-50 rounded-lg transition"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
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
                    <p className="text-gray-900 font-medium">{booking.phone || "-"}</p>
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
                  <p className="text-gray-900 font-medium">
                    {booking.adultCount} Adult{booking.adultCount !== 1 ? "s" : ""},{" "}
                    {booking.childCount} Child{booking.childCount !== 1 ? "ren" : ""}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking Information */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-teal-600" />
                Booking Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hotel
                  </label>
                  <p className="text-gray-900 font-medium">
                    {typeof booking.hotelId === "object"
                      ? booking.hotelId.name
                      : "N/A"}
                  </p>
                </div>

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
                    £{booking.totalCost?.toFixed(2) || "0.00"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Special Requests */}
          {booking.specialRequests && (
            <Card className="border-0 shadow-lg">
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
            <Card className="border-amber-200 bg-amber-50 border-2">
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
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
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
            <Card className="border-blue-200 bg-blue-50 border-2">
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
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
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
            <Card className="border-0 shadow-lg">
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
                  updateBookingMutation.mutate(formData);
                }}
                disabled={updateBookingMutation.isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Save Changes
              </button>
              <button
                onClick={() => setIsEditing(false)}
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
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
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
