import { useParams } from "react-router-dom";
import { useQueryWithLoading } from "../hooks/useLoadingHooks";
import * as apiClient from "./../api-client";
import GuestInfoForm from "../forms/GuestInfoForm/GuestInfoForm";
import FancyboxGallery from "../components/FancyboxGallery";
import {
  Clock,
  Car,
  Wifi,
  Waves,
  Dumbbell,
  Sparkles,
  Plane,
  Building2,
  Users,
  BedDouble,
  Maximize2,
  CalendarDays,
} from "lucide-react";

const Detail = () => {
  const { hotelId } = useParams();

  const {
    data: hotel,
    isLoading,
    isError,
  } = useQueryWithLoading(
    ["fetchHotelById", hotelId],
    () => apiClient.fetchHotelById(hotelId || ""),
    {
      enabled: !!hotelId,
      loadingMessage: "Loading hotel details...",
    }
  );

  if (isLoading) {
    return (
      <div className="text-center text-lg text-gray-500 py-10">
        Loading room details...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center text-lg text-gray-500 py-10">
        Unable to load this room right now. Please try again.
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="text-center text-lg text-gray-500 py-10">
        No hotel found.
      </div>
    );
  }

  const isFuocorosa = hotel.name.toLowerCase().includes("fuocorosa");
  const fuocorosaDescription =
    "In the comfort of a spacious and well-furnished apartment, everyone can find their ideal space to dedicate precious time to themselves. In our FUOCOROSA apartment, with its contemporary style and authentic furnishings, you will find all the comforts needed for a perfect vacation. FUOCOROSA is located entirely on the ground floor with no stairs, making it easily accessible for everyone. The apartment includes a fully equipped kitchen, perfect for preparing delicious meals independently. The cozy dining room and the living room with a comfortable sofa bed offer ideal spaces for relaxing and socializing, comfortably accommodating up to four people. The bedroom features a large double bed, ensuring a restful sleep. The private bathroom is equipped with a shower, soft towels, a hairdryer, and a courtesy kit, ensuring a total comfort experience. Our guests can take advantage of modern appliances such as the refrigerator, dishwasher, washing machine, and iron, making the stay even more convenient. A TV completes the list of comforts that this cozy apartment offers, ensuring moments of entertainment and relaxation.";

  const getFacilityIcon = (facility: string) => {
    switch (facility) {
      case "Free WiFi":
        return <Wifi className="w-4 h-4" />;
      case "Parking":
        return <Car className="w-4 h-4" />;
      case "Airport Shuttle":
        return <Plane className="w-4 h-4" />;
      case "Outdoor Pool":
        return <Waves className="w-4 h-4" />;
      case "Spa":
        return <Sparkles className="w-4 h-4" />;
      case "Fitness Center":
        return <Dumbbell className="w-4 h-4" />;
      case "Family Rooms":
      case "Non-Smoking Rooms":
      default:
        return <Building2 className="w-4 h-4" />;
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1380px] space-y-8">
      {/* Two-column: content LEFT / booking widget RIGHT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">

        {/* LEFT column */}
        <div className="min-w-0 lg:col-span-8 xl:col-span-9">
          <h1 className="text-2xl font-bold text-[#2b4463] mb-4">{hotel.name}</h1>

          {/* Gallery: hero image + thumbnail strip */}
          <FancyboxGallery images={hotel.imageUrls} title={hotel.name} />

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 border border-gray-200 divide-x divide-gray-200 rounded-b-lg bg-white -mt-px">
            <div className="flex items-start gap-3 px-4 py-3">
              <Users className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider leading-none mb-1">
                  Max. Guests
                </p>
                <p className="text-sm font-semibold text-gray-800">
                  {hotel.adultCount} Adults / {hotel.childCount} Children
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 px-4 py-3">
              <CalendarDays className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider leading-none mb-1">
                  Booking Nights
                </p>
                <p className="text-sm font-semibold text-gray-800">1 Min.</p>
              </div>
            </div>

            {isFuocorosa ? (
              <>
                <div className="flex items-start gap-3 px-4 py-3">
                  <BedDouble className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider leading-none mb-1">
                      Bed Type
                    </p>
                    <p className="text-sm font-semibold text-gray-800">Queen bed</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-4 py-3">
                  <Maximize2 className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider leading-none mb-1">
                      Area
                    </p>
                    <p className="text-sm font-semibold text-gray-800">60 m²</p>
                  </div>
                </div>
              </>
            ) : (
              hotel.type && hotel.type.length > 0 && (
                <div className="flex items-start gap-3 px-4 py-3 col-span-2">
                  <BedDouble className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider leading-none mb-1">
                      Room Type
                    </p>
                    <p className="text-sm font-semibold text-gray-800">
                      {hotel.type.join(", ")}
                    </p>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Description */}
          {(hotel.description || isFuocorosa) && (
            <div className="mt-6">
              <p className="text-gray-700 leading-relaxed whitespace-pre-line text-sm">
                {isFuocorosa ? fuocorosaDescription : hotel.description}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT column: booking widget + decorative photo */}
        <aside className="w-full lg:col-span-4 xl:col-span-3 lg:sticky lg:top-6">
          <GuestInfoForm
            pricePerNight={hotel.pricePerNight}
            hotelId={hotel._id}
          />
        </aside>
      </div>

      {/* Policies + Facilities (full width below) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {hotel.policies && (
          <div className="border border-gray-200 rounded-lg bg-white p-5">
            <h3 className="text-base font-semibold text-[#2b4463] mb-4">Hotel Policies</h3>
            <div className="space-y-3">
              {(hotel.policies.checkInTime || hotel.policies.checkOutTime) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {hotel.policies.checkInTime && (
                    <div className="flex items-center gap-2 rounded-md bg-slate-50 p-2.5 text-sm">
                      <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span>
                        <strong>Check-in:</strong> {hotel.policies.checkInTime}
                      </span>
                    </div>
                  )}
                  {hotel.policies.checkOutTime && (
                    <div className="flex items-center gap-2 rounded-md bg-slate-50 p-2.5 text-sm">
                      <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span>
                        <strong>Check-out:</strong> {hotel.policies.checkOutTime}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {hotel.policies.cancellationPolicy && (
                <p className="text-sm text-gray-700">
                  <strong>Cancellation:</strong> {hotel.policies.cancellationPolicy}
                </p>
              )}
              {hotel.policies.petPolicy && (
                <p className="text-sm text-gray-700">
                  <strong>Pet Policy:</strong> {hotel.policies.petPolicy}
                </p>
              )}
              {hotel.policies.smokingPolicy && (
                <p className="text-sm text-gray-700">
                  <strong>Smoking:</strong> {hotel.policies.smokingPolicy}
                </p>
              )}
            </div>
          </div>
        )}

        <div className={`border border-gray-200 rounded-lg bg-white p-5 ${!hotel.policies ? "xl:col-span-2" : ""}`}>
          <h3 className="text-base font-semibold text-[#2b4463] mb-4">Room Facilities</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {hotel.facilities.map((facility) => (
              <div
                key={facility}
                className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-gray-700"
              >
                <span className="text-gray-500">{getFacilityIcon(facility)}</span>
                <span>{facility}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Detail;