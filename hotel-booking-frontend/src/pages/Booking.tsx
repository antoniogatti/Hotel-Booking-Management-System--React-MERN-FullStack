import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryWithLoading } from "../hooks/useLoadingHooks";
import * as apiClient from "../api-client";
import useSearchContext from "../hooks/useSearchContext";
import { formatFriendlyDate } from "../lib/utils";

type BookingDetailsFormData = {
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
  termsAccepted: boolean;
};

const Booking = () => {
  const navigate = useNavigate();
  const { hotelId } = useParams();
  const search = useSearchContext();

  const savedDraft = (() => {
    const raw = sessionStorage.getItem("bookingDraft");
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as Partial<BookingDetailsFormData>;
    } catch {
      return null;
    }
  })();

  const {
    data: hotel,
    isLoading,
    isError,
  } = useQueryWithLoading(
    ["fetchHotelById", hotelId],
    () => apiClient.fetchHotelById(hotelId || ""),
    {
      enabled: !!hotelId,
      loadingMessage: "Loading booking details...",
    }
  );

  const { register, handleSubmit, watch, formState } = useForm<BookingDetailsFormData>({
    defaultValues: {
      firstName: savedDraft?.firstName || "",
      lastName: savedDraft?.lastName || "",
      email: savedDraft?.email || "",
      phone: savedDraft?.phone || "",
      city: savedDraft?.city || "",
      country: savedDraft?.country || "",
      nationality: savedDraft?.nationality || "",
      specialRequests: savedDraft?.specialRequests || "",
      coupon: savedDraft?.coupon || "",
      arrivalTime: savedDraft?.arrivalTime || "Morning",
      termsAccepted: savedDraft?.termsAccepted || false,
    },
  });

  const checkIn = search.checkIn;
  const checkOut = search.checkOut;
  const draftValues = watch();
  const nights = useMemo(() => {
    const diff = checkOut.getTime() - checkIn.getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [checkIn, checkOut]);

  useEffect(() => {
    sessionStorage.setItem("bookingDraft", JSON.stringify(draftValues));
  }, [draftValues]);

  if (isLoading) {
    return <div className="text-center py-10 text-gray-500">Loading booking page...</div>;
  }

  if (isError || !hotel || !hotelId) {
    return <div className="text-center py-10 text-gray-500">Unable to load booking details.</div>;
  }

  const onSubmit = (formValues: BookingDetailsFormData) => {
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut < checkIn) {
      return;
    }

    const checkoutState = {
      guestDetails: formValues,
      bookingDetails: {
        hotelId,
        hotelName: hotel.name,
        roomName: Array.isArray(hotel.type) && hotel.type.length > 0 ? hotel.type[0] : "Room",
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        adultCount: search.adultCount,
        childCount: search.childCount,
        nights,
        pricePerNight: hotel.pricePerNight,
        totalPrice: hotel.pricePerNight * nights,
      },
    };

    sessionStorage.setItem("checkoutState", JSON.stringify(checkoutState));
    navigate(`/hotel/${hotelId}/checkout`, {
      state: checkoutState,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <section className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="mb-6 rounded-md bg-sky-500 text-white text-sm p-3">
            Please fill the form below to continue with your booking request.
          </div>

          <h2 className="text-2xl font-semibold text-slate-700 mb-4">Billing Details</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">First Name</label>
                <input
                  {...register("firstName", {
                    required: "First name is required",
                    minLength: { value: 2, message: "First name is too short" },
                  })}
                  className="w-full border border-slate-300 rounded px-3 py-2"
                />
                {formState.errors.firstName && (
                  <p className="text-xs text-red-600 mt-1">{formState.errors.firstName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">Last Name</label>
                <input
                  {...register("lastName", {
                    required: "Last name is required",
                    minLength: { value: 2, message: "Last name is too short" },
                  })}
                  className="w-full border border-slate-300 rounded px-3 py-2"
                />
                {formState.errors.lastName && (
                  <p className="text-xs text-red-600 mt-1">{formState.errors.lastName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Enter a valid email address",
                    },
                  })}
                  className="w-full border border-slate-300 rounded px-3 py-2"
                />
                {formState.errors.email && (
                  <p className="text-xs text-red-600 mt-1">{formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">Phone</label>
                <input
                  {...register("phone", {
                    required: "Phone is required",
                    minLength: { value: 6, message: "Phone number is too short" },
                  })}
                  className="w-full border border-slate-300 rounded px-3 py-2"
                />
                {formState.errors.phone && (
                  <p className="text-xs text-red-600 mt-1">{formState.errors.phone.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">City</label>
                <input
                  {...register("city", { required: "City is required" })}
                  className="w-full border border-slate-300 rounded px-3 py-2"
                />
                {formState.errors.city && (
                  <p className="text-xs text-red-600 mt-1">{formState.errors.city.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">Country</label>
                <input
                  {...register("country", { required: "Country is required" })}
                  className="w-full border border-slate-300 rounded px-3 py-2"
                />
                {formState.errors.country && (
                  <p className="text-xs text-red-600 mt-1">{formState.errors.country.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">Nationality</label>
                <input
                  {...register("nationality", { required: "Nationality is required" })}
                  className="w-full border border-slate-300 rounded px-3 py-2"
                  placeholder="e.g. Italian"
                />
                {formState.errors.nationality && (
                  <p className="text-xs text-red-600 mt-1">{formState.errors.nationality.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">Special Requests</label>
              <textarea
                {...register("specialRequests")}
                rows={5}
                placeholder="Let us know if you have any special requests."
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Arrival Time</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(["Morning", "Afternoon", "Evening", "Night"] as const).map((option) => {
                  const selected = watch("arrivalTime") === option;
                  return (
                    <label
                      key={option}
                      className={`border rounded px-3 py-2 text-center text-sm cursor-pointer ${
                        selected ? "bg-emerald-50 border-emerald-400 text-emerald-800" : "bg-white border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        value={option}
                        className="sr-only"
                        {...register("arrivalTime")}
                      />
                      {option}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Coupon</label>
                <input
                  {...register("coupon")}
                  placeholder="Enter coupon code if you have one"
                  className="w-full border border-slate-300 rounded px-3 py-2"
                />
              </div>
              <button
                type="button"
                className="bg-[#ea836c] hover:bg-[#db755f] text-white px-6 py-2 rounded font-semibold"
              >
                Validate Code
              </button>
            </div>

            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                {...register("termsAccepted", {
                  required: "Please accept the terms and conditions",
                })}
                className="mt-0.5"
              />
              <span>
                I agree to the {" "}
                <Link to="/terms-conditions" className="text-[#ea836c] underline" target="_blank" rel="noreferrer">
                  Terms and Conditions
                </Link>
              </span>
            </label>
            {formState.errors.termsAccepted && (
              <p className="text-xs text-red-600">{formState.errors.termsAccepted.message}</p>
            )}

            {checkOut < checkIn && (
              <p className="text-sm text-red-600">
                Check-out date cannot be earlier than check-in date.
              </p>
            )}

            <button
              type="submit"
              disabled={checkOut < checkIn}
              className="w-full bg-[#ea836c] hover:bg-[#db755f] disabled:opacity-60 text-white font-semibold py-3 rounded"
            >
              Proceed to Checkout
            </button>
          </form>
        </section>

        <aside className="bg-white border border-slate-200 rounded-lg shadow-sm h-fit">
          <img
            src={hotel.imageUrls?.[0]}
            alt={hotel.name}
            className="w-full h-48 object-cover rounded-t-lg"
          />
          <div className="p-4 space-y-3">
            <h3 className="font-semibold text-slate-800">Booking Details</h3>
            <div className="text-sm text-slate-600 space-y-2">
              <p><strong>Check In:</strong> {formatFriendlyDate(checkIn)}</p>
              <p><strong>Check Out:</strong> {formatFriendlyDate(checkOut)}</p>
              <p><strong>Nights:</strong> {nights}</p>
              <p><strong>Guests:</strong> {search.adultCount} Adults, {search.childCount} Children</p>
              <p><strong>Room:</strong> {Array.isArray(hotel.type) && hotel.type.length > 0 ? hotel.type[0] : "Room"}</p>
            </div>
            <div className="border-t pt-3 text-sm text-slate-700 space-y-1">
              <p className="flex justify-between"><span>Price Summary</span><span>EUR {hotel.pricePerNight * nights}</span></p>
              <p className="flex justify-between font-semibold text-base"><span>Total Price</span><span>EUR {hotel.pricePerNight * nights}</span></p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Booking;
