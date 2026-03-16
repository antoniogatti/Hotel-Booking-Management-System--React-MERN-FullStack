import { useMemo, useState } from "react";
import { AxiosError } from "axios";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation } from "react-query";
import * as apiClient from "../api-client";
import useAppContext from "../hooks/useAppContext";

type CheckoutState = {
  guestDetails: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    city: string;
    country: string;
    specialRequests?: string;
    arrivalTime: "Morning" | "Afternoon" | "Evening" | "Night";
    coupon?: string;
    termsAccepted: boolean;
  };
  bookingDetails: {
    hotelId: string;
    hotelName: string;
    roomName: string;
    checkIn: string;
    checkOut: string;
    adultCount: number;
    childCount: number;
    nights: number;
    pricePerNight: number;
    totalPrice: number;
  };
};

const Checkout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { hotelId } = useParams();
  const { showToast } = useAppContext();
  const [reservationNumber, setReservationNumber] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const persistedState = (() => {
    const raw = sessionStorage.getItem("checkoutState");
    if (!raw) {
      return undefined;
    }

    try {
      return JSON.parse(raw) as CheckoutState;
    } catch {
      return undefined;
    }
  })();

  const state = (location.state as CheckoutState | undefined) || persistedState;

  const { mutate: sendRequest, isLoading } = useMutation(
    apiClient.submitBookingRequest,
    {
      onSuccess: (data) => {
        setSubmissionError(null);
        setReservationNumber(data.reservationNumber);
        sessionStorage.removeItem("checkoutState");
        sessionStorage.removeItem("bookingDraft");
        showToast({
          title: data.emailsSent === false ? "Booking Saved" : "Booking Request Sent",
          description:
            data.emailsSent === false
              ? `Booking reference ${data.reservationNumber}. Your request was saved, but email delivery is currently delayed.`
              : `Booking reference ${data.reservationNumber}. We sent a confirmation email to you and your request to the admin.`,
          type: data.emailsSent === false ? "INFO" : "SUCCESS",
        });
      },
      onError: (error) => {
        const axiosError = error as AxiosError<{ message?: string; reservationNumber?: string }>;
        const responseMessage = axiosError.response?.data?.message;
        const duplicateReservationNumber = axiosError.response?.data?.reservationNumber;

        if (axiosError.response?.status === 409 && duplicateReservationNumber) {
          setReservationNumber(duplicateReservationNumber);
          setSubmissionError(
            `${responseMessage || "A duplicate booking request was already submitted."} Existing booking reference: ${duplicateReservationNumber}.`
          );
          showToast({
            title: "Booking Already Submitted",
            description: `Existing booking reference ${duplicateReservationNumber}.`,
            type: "INFO",
          });
          return;
        }

        setSubmissionError(responseMessage || "We could not send your booking request right now. Please try again in a few moments.");
        showToast({
          title: "Unable to Send Request",
          description: responseMessage || "Please try again in a few moments.",
          type: "ERROR",
        });
      },
    }
  );

  if (!state?.guestDetails || !state?.bookingDetails) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold text-slate-800 mb-3">Missing booking details</h1>
        <p className="text-slate-600 mb-6">Please complete your details first.</p>
        <button
          type="button"
          onClick={() => navigate(`/hotel/${hotelId}/booking`)}
          className="bg-[#ea836c] hover:bg-[#db755f] text-white px-5 py-2 rounded"
        >
          Back to Booking Details
        </button>
      </div>
    );
  }

  const { guestDetails, bookingDetails } = state;

  const formattedDates = useMemo(() => {
    const checkIn = new Date(bookingDetails.checkIn);
    const checkOut = new Date(bookingDetails.checkOut);
    return {
      checkIn: checkIn.toLocaleDateString(),
      checkOut: checkOut.toLocaleDateString(),
    };
  }, [bookingDetails.checkIn, bookingDetails.checkOut]);

  const handleSendBookingRequest = () => {
    sendRequest({
      hotelId: bookingDetails.hotelId,
      firstName: guestDetails.firstName,
      lastName: guestDetails.lastName,
      email: guestDetails.email,
      phone: guestDetails.phone,
      city: guestDetails.city,
      country: guestDetails.country,
      specialRequests: guestDetails.specialRequests,
      arrivalTime: guestDetails.arrivalTime,
      coupon: guestDetails.coupon,
      adultCount: bookingDetails.adultCount,
      childCount: bookingDetails.childCount,
      checkIn: bookingDetails.checkIn,
      checkOut: bookingDetails.checkOut,
      totalCost: bookingDetails.totalPrice,
      nights: bookingDetails.nights,
      roomName: bookingDetails.roomName,
      hotelName: bookingDetails.hotelName,
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">Booking Details</h1>
      <p className="text-slate-600 mb-8">Please review your request before sending it.</p>

      <section className="bg-white border border-slate-200 rounded-lg p-6 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-slate-700">
          <div className="space-y-3">
            <p><strong>Full Name:</strong> {guestDetails.firstName} {guestDetails.lastName}</p>
            <p><strong>Email:</strong> {guestDetails.email}</p>
            <p><strong>Phone:</strong> {guestDetails.phone}</p>
          </div>
          <div className="space-y-3">
            <p><strong>Room:</strong> {bookingDetails.roomName}</p>
            <p><strong>Check In/Out:</strong> {formattedDates.checkIn}{" -> "}{formattedDates.checkOut}</p>
            <p><strong>Arrival:</strong> {guestDetails.arrivalTime}</p>
          </div>
          <div className="space-y-3">
            <p><strong>Guests:</strong> {bookingDetails.adultCount} Adults, {bookingDetails.childCount} Children</p>
            <p><strong>Location:</strong> {guestDetails.city}, {guestDetails.country}</p>
            <p><strong>Total Price:</strong> EUR {bookingDetails.totalPrice}</p>
          </div>
        </div>

        {guestDetails.specialRequests && (
          <div className="mt-6 border-t pt-4">
            <p className="text-sm text-slate-500 mb-1">Special Requests</p>
            <p className="text-slate-700">{guestDetails.specialRequests}</p>
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-slate-800">Booking Request</h2>
          <p className="text-slate-600 mt-1">
            Thanks for your booking request. Our staff will contact you soon for confirmation.
          </p>
        </div>

        {submissionError && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {submissionError}
          </div>
        )}

        {reservationNumber && (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">Your booking request has been sent successfully.</p>
            <p className="text-lg font-semibold text-emerald-900 mt-1">
              Booking Reference: {reservationNumber}
            </p>
            <p className="text-sm text-emerald-700 mt-2">
              Please keep this reference for cancellation, modification, or support requests.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSendBookingRequest}
          disabled={isLoading || !!reservationNumber}
          className="w-full bg-[#ea836c] hover:bg-[#db755f] disabled:opacity-70 text-white font-semibold py-3 rounded"
        >
          {isLoading ? "Sending..." : reservationNumber ? "Booking Request Sent" : "Send Booking Request"}
        </button>

        {reservationNumber && (
          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-full mt-3 border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold py-3 rounded"
          >
            Return Home
          </button>
        )}
      </section>
    </div>
  );
};

export default Checkout;
