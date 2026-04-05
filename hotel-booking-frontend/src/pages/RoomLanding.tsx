import { useParams, Link, Navigate } from "react-router-dom";
import FancyboxGallery from "../components/FancyboxGallery";
import { roomPageCatalog, type CustomRoomSlug } from "../../../shared/roomCatalog.ts";
import {
  Users,
  BedDouble,
  Maximize2,
  CalendarDays,
  Wifi,
  Wind,
  Coffee,
  Tv,
  Thermometer,
  UtensilsCrossed,
  CookingPot,
  Building2,
  Refrigerator,
  CalendarCheck,
  ExternalLink,
} from "lucide-react";

const getServiceIcon = (service: string) => {
  switch (service) {
    case "Wi-Fi":
      return Wifi;
    case "Hair Dryer":
      return Wind;
    case "Breakfast":
      return UtensilsCrossed;
    case "Coffee Maker":
      return Coffee;
    case "Mini Fridge":
    case "Fridge":
      return Refrigerator;
    case "TV":
      return Tv;
    case "Air Conditioner / Heater":
      return Thermometer;
    case "Kitchen":
      return CookingPot;
    default:
      return Building2;
  }
};

const RoomLanding = () => {
  const { roomSlug } = useParams<{ roomSlug: CustomRoomSlug }>();

  if (!roomSlug || !(roomSlug in roomPageCatalog)) {
    return <Navigate to="/" replace />;
  }

  const room = roomPageCatalog[roomSlug];

  return (
    <div className="mx-auto w-full max-w-[1380px] space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#2b4463]">{room.pageName}</h1>
        <p className="text-sm text-gray-500 mt-1">{room.subtitle}</p>
      </div>

      {/* Two-column: gallery + info / book widget */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">

        {/* LEFT column */}
        <div className="min-w-0 lg:col-span-8 xl:col-span-9 space-y-6">

          {/* Gallery */}
          <FancyboxGallery images={room.images} title={room.pageName} />

          {/* Stats bar */}
          <div className="grid grid-cols-2 lg:grid-cols-5 border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className="flex items-start gap-3 px-4 py-3">
              <Users className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider leading-none mb-1">
                  Max. Guests
                </p>
                <p className="text-sm font-semibold text-gray-800">
                  {room.maxAdults} Adults{room.maxChildren > 0 ? ` / ${room.maxChildren} Children` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 px-4 py-3 border-t border-l border-gray-200 lg:border-t-0">
              <CalendarDays className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider leading-none mb-1">
                  Booking Nights
                </p>
                <p className="text-sm font-semibold text-gray-800">{room.minimumNights} Min.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 px-4 py-3 border-t border-gray-200 lg:border-t-0 lg:border-l">
              <Building2 className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider leading-none mb-1">
                  Floor
                </p>
                <p className="text-sm font-semibold text-gray-800">{room.floorLabel}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 px-4 py-3 border-t border-l border-gray-200 lg:border-t-0">
              <BedDouble className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider leading-none mb-1">
                  Bed Type
                </p>
                <p className="text-sm font-semibold text-gray-800">{room.bedType}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 px-4 py-3 border-t border-gray-200 lg:border-t-0 lg:border-l">
              <Maximize2 className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider leading-none mb-1">
                  Area
                </p>
                <p className="text-sm font-semibold text-gray-800">{room.area}</p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line text-sm">
              {room.description}
            </p>
          </div>

          {/* Services */}
          <div className="border border-gray-200 rounded-lg bg-white p-5">
            <h3 className="text-base font-semibold text-[#2b4463] mb-4">Room Services</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {room.services.map((service: string) => (
                (() => {
                  const Icon = getServiceIcon(service);

                  return (
                    <div
                      key={service}
                      className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-2.5 text-sm text-gray-700 min-h-[52px]"
                    >
                      <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-white text-gray-500 ring-1 ring-gray-200">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="leading-snug">{service}</span>
                    </div>
                  );
                })()
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT column: Book Now card */}
        <aside className="w-full lg:col-span-4 xl:col-span-3 lg:sticky lg:top-6">
          <div className="border border-gray-200 rounded-lg bg-white p-5 space-y-4">
            <h3 className="text-base font-semibold text-[#2b4463]">Book This Room</h3>
            <p className="text-sm text-gray-500">
              Check availability and complete your booking in a few easy steps.
            </p>
            <Link
              to="/search"
              className="flex items-center justify-center gap-2 w-full rounded-md bg-[#2b4463] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1e3250] transition-colors"
            >
              <CalendarCheck className="w-4 h-4" />
              Check Availability
            </Link>
            <a
              href={room.originalUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-md border border-gray-200 px-4 py-3 text-sm font-semibold text-[#2b4463] hover:border-[#2b4463] transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View Original Room Page
            </a>
            <p className="text-xs text-gray-400 text-center">
              No credit card required to check availability
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default RoomLanding;
