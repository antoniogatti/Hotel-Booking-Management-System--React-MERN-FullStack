import { useParams } from "react-router-dom";
import { useQueryWithLoading } from "../hooks/useLoadingHooks";
import * as apiClient from "./../api-client";
import GuestInfoForm from "../forms/GuestInfoForm/GuestInfoForm";
import FancyboxGallery from "../components/FancyboxGallery";
import { Badge } from "../components/ui/badge";
import {
  Clock,
  Car,
  Wifi,
  Waves,
  Dumbbell,
  Sparkles,
  Plane,
  Building2,
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{hotel.name}</h1>

        {/* Hotel Stats */}
        {((hotel.totalBookings && hotel.totalBookings > 0) ||
          (hotel.totalRevenue && hotel.totalRevenue > 0) ||
          hotel.isFeatured) && (
          <div className="flex gap-4 mt-4">
            {hotel.totalBookings && hotel.totalBookings > 0 && (
              <Badge variant="outline">{hotel.totalBookings} bookings</Badge>
            )}
            {hotel.totalRevenue && hotel.totalRevenue > 0 && (
              <Badge variant="outline">
                {hotel.totalRevenue.toLocaleString()} revenue
              </Badge>
            )}
            {/* Rating Badge - Always show with appropriate message */}
            <Badge variant="outline" className="text-gray-600">
              {hotel.averageRating && hotel.averageRating > 0
                ? `${hotel.averageRating.toFixed(1)} avg rating`
                : "Rating feature not yet implemented"}
            </Badge>
            {hotel.isFeatured && (
              <Badge className="bg-yellow-100 text-yellow-800">Featured</Badge>
            )}
          </div>
        )}

        {/* Hotel Types */}
        {hotel.type && hotel.type.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {hotel.type.map((type, index) => (
              <Badge
                key={index}
                variant="outline"
                className="bg-blue-50 text-blue-700 border-blue-200"
              >
                {type}
              </Badge>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr] mt-6">
          <div className="h-fit">
            <GuestInfoForm
              pricePerNight={hotel.pricePerNight}
              hotelId={hotel._id}
            />
          </div>
        </div>

        {/* Room Highlights */}
        {isFuocorosa && (
          <div className="mt-6 border border-slate-300 rounded-lg p-4 bg-white">
            <h3 className="text-xl font-semibold mb-3">Fuocorosa Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Max. Guests
                </p>
                <p className="text-base font-semibold text-slate-900">
                  4 Adults / 0 Children
                </p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Booking Nights
                </p>
                <p className="text-base font-semibold text-slate-900">1 Min.</p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Bed Type
                </p>
                <p className="text-base font-semibold text-slate-900">Queen bed</p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Area
                </p>
                <p className="text-base font-semibold text-slate-900">60 m²</p>
              </div>
            </div>
          </div>
        )}

        {/* Hotel Description */}
        {(hotel.description || isFuocorosa) && (
          <div className="mt-6">
            <h3 className="text-xl font-semibold mb-3">
              {isFuocorosa ? "Fuocorosa Overview" : "About This Hotel"}
            </h3>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
              {isFuocorosa ? fuocorosaDescription : hotel.description}
            </p>
          </div>
        )}
      </div>

      {/* Policies + Facilities */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {hotel.policies && (
          <div className="border border-slate-300 rounded-lg p-4">
            <h3 className="text-xl font-semibold mb-3">Hotel Policies</h3>
            <div className="space-y-4">
              {(hotel.policies.checkInTime || hotel.policies.checkOutTime) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {hotel.policies.checkInTime && (
                    <div className="flex items-center gap-2 rounded-md bg-slate-50 p-2.5">
                      <Clock className="w-4 h-4 text-gray-600" />
                      <span>
                        <strong>Check-in:</strong> {hotel.policies.checkInTime}
                      </span>
                    </div>
                  )}
                  {hotel.policies.checkOutTime && (
                    <div className="flex items-center gap-2 rounded-md bg-slate-50 p-2.5">
                      <Clock className="w-4 h-4 text-gray-600" />
                      <span>
                        <strong>Check-out:</strong> {hotel.policies.checkOutTime}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {hotel.policies.cancellationPolicy && (
                <div>
                  <strong>Cancellation:</strong> {hotel.policies.cancellationPolicy}
                </div>
              )}
              {hotel.policies.petPolicy && (
                <div>
                  <strong>Pet Policy:</strong> {hotel.policies.petPolicy}
                </div>
              )}
              {hotel.policies.smokingPolicy && (
                <div>
                  <strong>Smoking:</strong> {hotel.policies.smokingPolicy}
                </div>
              )}
            </div>
          </div>
        )}

        <div
          className={`border border-slate-300 rounded-lg p-4 ${
            !hotel.policies ? "xl:col-span-2" : ""
          }`}
        >
          <h3 className="text-xl font-semibold mb-3">Room Facilities</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {hotel.facilities.map((facility) => (
              <div
                key={facility}
                className="flex items-center gap-2 rounded-md bg-slate-50 p-2.5"
              >
                <div className="w-4 h-4 text-green-600">{getFacilityIcon(facility)}</div>
                <span>{facility}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gallery - keep last in page */}
      <div className="space-y-3">
        <h3 className="text-2xl font-semibold">Gallery</h3>
        <FancyboxGallery images={hotel.imageUrls} title={hotel.name} />
      </div>
    </div>
  );
};

export default Detail;
