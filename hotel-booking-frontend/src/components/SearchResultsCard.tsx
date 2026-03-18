import { Link } from "react-router-dom";
import { HotelType } from "../../../shared/types";
import {
  Wifi,
  Car,
  Waves,
  Dumbbell,
  Sparkles,
  UtensilsCrossed,
  Coffee,
  Plane,
  Building2,
  ChevronRight,
} from "lucide-react";

type Props = {
  hotel: HotelType;
  viewMode?: "list" | "grid";
};

const SearchResultsCard = ({ hotel, viewMode = "list" }: Props) => {
  const detailPath = `/detail/${hotel._id}`;

  const getFacilityIcon = (facility: string) => {
    const iconMap: Record<string, React.ElementType> = {
      "Free WiFi": Wifi,
      "Free Parking": Car,
      "Swimming Pool": Waves,
      "Fitness Center": Dumbbell,
      Spa: Sparkles,
      Restaurant: UtensilsCrossed,
      "Bar/Lounge": Coffee,
      "Airport Shuttle": Plane,
    };
    return iconMap[facility] || Building2;
  };

  if (viewMode === "grid") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        {/* Image */}
        <Link to={detailPath} className="block relative overflow-hidden h-52 flex-shrink-0">
          <img
            src={hotel.imageUrls[0]}
            alt={hotel.name}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          />
          <div className="absolute bottom-0 right-0 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-tl-lg text-sm font-bold text-[#2b4463]">
            €{hotel.pricePerNight}<span className="text-xs font-normal text-gray-500"> /night</span>
          </div>
        </Link>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1">
          <Link
            to={detailPath}
            className="text-base font-bold text-[#2b4463] hover:text-[#ea836c] transition-colors leading-snug mb-2"
          >
            {hotel.name}
          </Link>

          <p className="text-sm text-gray-500 line-clamp-3 flex-1 mb-3">
            {hotel.description}
          </p>

          {/* Facility icons */}
          {hotel.facilities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {hotel.facilities.slice(0, 5).map((facility) => {
                const Icon = getFacilityIcon(facility);
                return (
                  <span
                    key={facility}
                    title={facility}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="mt-auto space-y-2">
            <Link
              to={detailPath}
              className="block w-full text-center bg-[#ea836c] hover:bg-[#d9725d] text-white text-sm font-semibold py-2 rounded-lg transition-colors tracking-wide uppercase"
            >
              Book Now
            </Link>
            <Link
              to={detailPath}
              className="flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-[#ea836c] transition-colors"
            >
              Availability &amp; Details <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── List view (default) ──
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col sm:flex-row">
      {/* Image */}
      <Link
        to={detailPath}
        className="relative flex-shrink-0 overflow-hidden h-52 sm:h-auto sm:w-52"
      >
        <img
          src={hotel.imageUrls[0]}
          alt={hotel.name}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
        />
      </Link>

      {/* Main content */}
      <div className="flex flex-1 flex-col sm:flex-row min-w-0">
        {/* Text */}
        <div className="flex-1 p-4 min-w-0">
          <Link
            to={detailPath}
            className="text-lg font-bold text-[#2b4463] hover:text-[#ea836c] transition-colors leading-snug block mb-1.5"
          >
            {hotel.name}
          </Link>

          <p className="text-sm text-gray-500 line-clamp-4 mb-3">
            {hotel.description}
          </p>

          {/* Facility icons */}
          {hotel.facilities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {hotel.facilities.slice(0, 6).map((facility) => {
                const Icon = getFacilityIcon(facility);
                return (
                  <span
                    key={facility}
                    title={facility}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Price + actions panel */}
        <div className="flex sm:flex-col items-center sm:items-stretch justify-between sm:justify-center gap-3 px-4 pb-4 sm:py-4 sm:w-40 sm:border-l sm:border-gray-100 flex-shrink-0">
          <div className="text-center">
            <span className="text-2xl font-extrabold text-[#2b4463]">€{hotel.pricePerNight}</span>
            <p className="text-xs text-gray-400 leading-none">per night</p>
          </div>

          <div className="space-y-2 w-full">
            <Link
              to={detailPath}
              className="block w-full text-center bg-[#ea836c] hover:bg-[#d9725d] text-white text-xs font-semibold py-2 rounded-lg transition-colors tracking-wide uppercase"
            >
              Book Now
            </Link>
            <Link
              to={detailPath}
              className="flex items-center justify-center gap-0.5 text-xs text-gray-500 hover:text-[#ea836c] transition-colors"
            >
              Availability &amp; Details <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchResultsCard;