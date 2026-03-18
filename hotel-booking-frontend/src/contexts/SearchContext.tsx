import React, { useState } from "react";

const getStartOfToday = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const parseStoredDate = (value: string | null, fallback: Date): Date => {
  if (!value) return new Date(fallback);

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
};

const normalizeDateRange = (checkIn: Date, checkOut: Date) => {
  const today = getStartOfToday();
  const normalizedCheckIn = checkIn < today ? today : checkIn;
  const normalizedCheckOut = checkOut < normalizedCheckIn ? normalizedCheckIn : checkOut;

  return {
    checkIn: normalizedCheckIn,
    checkOut: normalizedCheckOut,
  };
};

export type SearchContext = {
  destination: string;
  checkIn: Date;
  checkOut: Date;
  adultCount: number;
  childCount: number;
  hotelId: string;
  saveSearchValues: (
    destination: string,
    checkIn: Date,
    checkOut: Date,
    adultCount: number,
    childCount: number,
    hotelId?: string
  ) => void;
  clearSearchValues: () => void;
};

export const SearchContext = React.createContext<SearchContext | undefined>(
  undefined
);

type SearchContextProviderProps = {
  children: React.ReactNode;
};

export const SearchContextProvider = ({
  children,
}: SearchContextProviderProps) => {
  const today = getStartOfToday();
  const initialCheckIn = parseStoredDate(sessionStorage.getItem("checkIn"), today);
  const initialCheckOut = parseStoredDate(
    sessionStorage.getItem("checkOut"),
    initialCheckIn
  );
  const initialRange = normalizeDateRange(initialCheckIn, initialCheckOut);

  const [destination, setDestination] = useState<string>(
    () => sessionStorage.getItem("destination") || ""
  );
  const [checkIn, setCheckIn] = useState<Date>(() => initialRange.checkIn);
  const [checkOut, setCheckOut] = useState<Date>(() => initialRange.checkOut);
  const [adultCount, setAdultCount] = useState<number>(() =>
    parseInt(sessionStorage.getItem("adultCount") || "1")
  );
  const [childCount, setChildCount] = useState<number>(() =>
    parseInt(sessionStorage.getItem("childCount") || "0")
  );
  const [hotelId, setHotelId] = useState<string>(
    () => sessionStorage.getItem("hotelId") || ""
  );

  const saveSearchValues = (
    destination: string,
    checkIn: Date,
    checkOut: Date,
    adultCount: number,
    childCount: number,
    hotelId?: string
  ) => {
    const normalizedRange = normalizeDateRange(checkIn, checkOut);

    setDestination(destination);
    setCheckIn(normalizedRange.checkIn);
    setCheckOut(normalizedRange.checkOut);
    setAdultCount(adultCount);
    setChildCount(childCount);
    if (hotelId) {
      setHotelId(hotelId);
    }

    sessionStorage.setItem("destination", destination);
    sessionStorage.setItem("checkIn", normalizedRange.checkIn.toISOString());
    sessionStorage.setItem("checkOut", normalizedRange.checkOut.toISOString());
    sessionStorage.setItem("adultCount", adultCount.toString());
    sessionStorage.setItem("childCount", childCount.toString());

    if (hotelId) {
      sessionStorage.setItem("hotelId", hotelId);
    }
  };

  const clearSearchValues = () => {
    const resetDate = getStartOfToday();

    setDestination("");
    setCheckIn(resetDate);
    setCheckOut(resetDate);
    setAdultCount(1);
    setChildCount(0);
    setHotelId("");

    sessionStorage.removeItem("destination");
    sessionStorage.removeItem("checkIn");
    sessionStorage.removeItem("checkOut");
    sessionStorage.removeItem("adultCount");
    sessionStorage.removeItem("childCount");
    sessionStorage.removeItem("hotelId");

    // Clear cached places data if it's older than 5 minutes
    const cacheTime = localStorage.getItem("hotelPlacesTime");
    if (cacheTime) {
      const now = Date.now();
      if (now - parseInt(cacheTime) > 5 * 60 * 1000) {
        localStorage.removeItem("hotelPlaces");
        localStorage.removeItem("hotelPlacesTime");
      }
    }
  };

  return (
    <SearchContext.Provider
      value={{
        destination,
        checkIn,
        checkOut,
        adultCount,
        childCount,
        hotelId,
        saveSearchValues,
        clearSearchValues,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
};

// ...existing code...
