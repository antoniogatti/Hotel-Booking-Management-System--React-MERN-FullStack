import { useSearchParams } from "react-router-dom";
import useSearchContext from "../hooks/useSearchContext";
import { useQueryWithLoading } from "../hooks/useLoadingHooks";
import * as apiClient from "../api-client";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import SearchResultsCard from "../components/SearchResultsCard";
import Pagination from "../components/Pagination";
import HotelTypesFilter from "../components/HotelTypesFilter";
import FacilitiesFilter from "../components/FacilitiesFilter";
import PriceFilter from "../components/PriceFilter";
import { siteConfig } from "../config/siteConfig";
import { LayoutList, LayoutGrid } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const fmtDate = (d: Date): string =>
  d.toLocaleDateString("en-GB"); // "dd/mm/yyyy"

// forwardRef wrapper needed by react-datepicker customInput
const DateRangeBtn = React.forwardRef<
  HTMLButtonElement,
  { value?: string; onClick?: React.MouseEventHandler<HTMLButtonElement> }
>(({ value, onClick }, ref) => {
  const parts = (value || "").split(" - ");
  const start = parts[0] || "—";
  const end = parts[1] || "—";
  return (
    <button
      ref={ref}
      onClick={onClick}
      type="button"
      className="w-full flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:border-[#ea836c] transition-colors"
    >
      <span className="font-medium">{start}</span>
      <span className="text-gray-400 flex-shrink-0">→</span>
      <span className="font-medium">{end}</span>
    </button>
  );
});

const Search = () => {
  const isSinglePropertyMode = siteConfig.singlePropertyMode;
  const [urlSearchParams] = useSearchParams();
  const search = useSearchContext();
  const [page, setPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortOption, setSortOption] = useState<string>("");

  const minDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, []);

  // Sync URL params to search context when navigating with query string
  useEffect(() => {
    const destination = urlSearchParams.get("destination");
    const checkIn = urlSearchParams.get("checkIn");
    const checkOut = urlSearchParams.get("checkOut");
    const adultCount = urlSearchParams.get("adultCount");
    const childCount = urlSearchParams.get("childCount");
    if (checkIn && checkOut) {
      search.saveSearchValues(
        isSinglePropertyMode ? "" : destination || "",
        new Date(checkIn),
        new Date(checkOut),
        parseInt(adultCount || "1", 10),
        parseInt(childCount || "0", 10)
      );
    }
  }, [isSinglePropertyMode, urlSearchParams.toString()]);

  const [selectedHotelTypes, setSelectedHotelTypes] = useState<string[]>([]);
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [selectedPrice, setSelectedPrice] = useState<number | undefined>();

  const searchParams = {
    destination: search.destination?.trim() || "",
    checkIn: search.checkIn.toISOString(),
    checkOut: search.checkOut.toISOString(),
    adultCount: search.adultCount.toString(),
    childCount: search.childCount.toString(),
    page: page.toString(),
    stars: [],
    types: isSinglePropertyMode ? [] : selectedHotelTypes,
    facilities: isSinglePropertyMode ? [] : selectedFacilities,
    maxPrice: isSinglePropertyMode ? undefined : selectedPrice?.toString(),
    sortOption,
  };

  const { data: hotelData } = useQueryWithLoading(
    ["searchHotels", searchParams],
    () => apiClient.searchHotels(searchParams),
    { loadingMessage: "Searching for perfect rooms..." }
  );

  const minPrice = useMemo(() => {
    if (!hotelData?.data?.length) return null;
    return Math.min(...hotelData.data.map((h: { pricePerNight: number }) => h.pricePerNight));
  }, [hotelData]);

  const handleAdultChange = useCallback(
    (delta: number) => {
      const next = Math.max(1, search.adultCount + delta);
      search.saveSearchValues(
        search.destination, search.checkIn, search.checkOut, next, search.childCount
      );
      setPage(1);
    },
    [search]
  );

  const handleChildChange = useCallback(
    (delta: number) => {
      const next = Math.max(0, search.childCount + delta);
      search.saveSearchValues(
        search.destination, search.checkIn, search.checkOut, search.adultCount, next
      );
      setPage(1);
    },
    [search]
  );

  const handleDateChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates;
    if (start && end) {
      search.saveSearchValues(
        search.destination, start, end, search.adultCount, search.childCount
      );
      setPage(1);
    } else if (start) {
      // Partial selection — update context start only (keeps end until full range)
      search.saveSearchValues(
        search.destination, start, search.checkOut, search.adultCount, search.childCount
      );
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 max-w-7xl mx-auto">
      {/* LEFT: Booking Details sidebar */}
      <aside className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 h-fit lg:sticky lg:top-6">
        <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-3 mb-4">
          Booking Details
        </h2>

        {/* Date range picker */}
        <div className="mb-4">
          <DatePicker
            selected={search.checkIn}
            onChange={handleDateChange}
            selectsRange
            startDate={search.checkIn}
            endDate={search.checkOut}
            minDate={minDate}
            monthsShown={2}
            shouldCloseOnSelect={false}
            dateFormat="dd/MM/yyyy"
            filterDate={(date) => date >= minDate}
            customInput={<DateRangeBtn />}
            popperPlacement="bottom-start"
          />
        </div>

        {/* Guests summary */}
        <div className="text-sm font-medium text-gray-500 mb-1">
          Guests {search.adultCount + search.childCount}
        </div>

        {/* Adults counter */}
        <div className="flex items-center justify-between py-3 border-t border-gray-100">
          <div>
            <div className="text-sm font-medium text-gray-700">Adults</div>
            <div className="text-xs text-gray-400">Ages 18+</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAdultChange(-1)}
              disabled={search.adultCount <= 1}
              className="w-7 h-7 rounded border border-gray-300 text-gray-600 flex items-center justify-center hover:border-[#ea836c] hover:text-[#ea836c] disabled:opacity-40 disabled:cursor-not-allowed text-base leading-none"
            >
              −
            </button>
            <span className="w-5 text-center text-sm font-semibold tabular-nums">
              {search.adultCount}
            </span>
            <button
              onClick={() => handleAdultChange(1)}
              className="w-7 h-7 rounded border border-gray-300 text-gray-600 flex items-center justify-center hover:border-[#ea836c] hover:text-[#ea836c] text-base leading-none"
            >
              +
            </button>
          </div>
        </div>

        {/* Children counter */}
        <div className="flex items-center justify-between py-3 border-t border-gray-100">
          <div>
            <div className="text-sm font-medium text-gray-700">Children</div>
            <div className="text-xs text-gray-400">Ages 4 – 18</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleChildChange(-1)}
              disabled={search.childCount <= 0}
              className="w-7 h-7 rounded border border-gray-300 text-gray-600 flex items-center justify-center hover:border-[#ea836c] hover:text-[#ea836c] disabled:opacity-40 disabled:cursor-not-allowed text-base leading-none"
            >
              −
            </button>
            <span className="w-5 text-center text-sm font-semibold tabular-nums">
              {search.childCount}
            </span>
            <button
              onClick={() => handleChildChange(1)}
              className="w-7 h-7 rounded border border-gray-300 text-gray-600 flex items-center justify-center hover:border-[#ea836c] hover:text-[#ea836c] text-base leading-none"
            >
              +
            </button>
          </div>
        </div>

        {/* Non-singleProperty filters */}
        {!isSinglePropertyMode && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-5">
            <h3 className="text-sm font-semibold text-gray-700">Filter by:</h3>
            <HotelTypesFilter
              selectedHotelTypes={selectedHotelTypes}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedHotelTypes((prev) =>
                  e.target.checked ? [...prev, v] : prev.filter((t) => t !== v)
                );
              }}
            />
            <FacilitiesFilter
              selectedFacilities={selectedFacilities}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedFacilities((prev) =>
                  e.target.checked ? [...prev, v] : prev.filter((f) => f !== v)
                );
              }}
            />
            <PriceFilter
              selectedPrice={selectedPrice}
              onChange={(val?: number) => setSelectedPrice(val)}
            />
          </div>
        )}
      </aside>

      {/* RIGHT: Results */}
      <div className="flex flex-col gap-5">
        {/* Header bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <span className="text-sm text-gray-700">
            {hotelData ? (
              <>
                You found{" "}
                <strong className="text-gray-900">{hotelData.pagination.total}</strong>{" "}
                {isSinglePropertyMode ? "rooms" : "hotels"}
                {minPrice !== null && (
                  <>
                    {" "}from{" "}
                    <strong className="text-gray-900">€{minPrice}</strong>
                  </>
                )}
              </>
            ) : null}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 hidden sm:inline">View</span>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                className={`p-2 ${viewMode === "list" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-700"}`}
                onClick={() => setViewMode("list")}
                aria-label="List view"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                className={`p-2 ${viewMode === "grid" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-700"}`}
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            <select
              value={sortOption}
              onChange={(e) => { setSortOption(e.target.value); setPage(1); }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#ea836c]"
            >
              <option value="">Sort by: Default</option>
              <option value="pricePerNightAsc">Price: Low to High</option>
              <option value="pricePerNightDesc">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Empty state */}
        {hotelData?.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="text-gray-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No {isSinglePropertyMode ? "rooms" : "hotels"} found
            </h3>
            <p className="text-gray-500 max-w-md">
              {isSinglePropertyMode ? (
                "Try changing your dates or guest count."
              ) : (
                <>
                  We couldn't find any hotels
                  {search.destination ? ` in ${search.destination}` : ""} matching your criteria.
                </>
              )}
            </p>
            {!isSinglePropertyMode &&
              (selectedHotelTypes.length > 0 || selectedFacilities.length > 0 || selectedPrice) && (
                <button
                  onClick={() => {
                    setSelectedHotelTypes([]);
                    setSelectedFacilities([]);
                    setSelectedPrice(undefined);
                    setSortOption("");
                  }}
                  className="mt-6 text-sm text-[#ea836c] hover:text-[#d9725d] font-medium"
                >
                  Clear all filters
                </button>
              )}
          </div>
        ) : (
          <>
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 gap-5"
                  : "flex flex-col gap-4"
              }
            >
              {hotelData?.data.map(
                (hotel: import("../../../shared/types").HotelType) => (
                  <SearchResultsCard key={hotel._id} hotel={hotel} viewMode={viewMode} />
                )
              )}
            </div>
            <Pagination
              page={hotelData?.pagination.page || 1}
              pages={hotelData?.pagination.pages || 1}
              onPageChange={(p) => setPage(p)}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default Search;
