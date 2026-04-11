export type UserType = {
  _id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  image?: string;
  role?: "user" | "admin" | "hotel_owner";
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  };
  preferences?: {
    preferredDestinations: string[];
    preferredHotelTypes: string[];
    budgetRange: {
      min: number;
      max: number;
    };
  };
  totalBookings?: number;
  totalSpent?: number;
  lastLogin?: Date;
  isActive?: boolean;
  emailVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  microsoftGraphConnected?: boolean;
};

export type HotelType = {
  _id: string;
  userId: string;
  slug?: string;
  originalUrl?: string;
  minimumNights?: number;
  name: string;
  city: string;
  country: string;
  description: string;
  type: string[];
  adultCount: number;
  childCount: number;
  facilities: string[];
  pricePerNight: number;
  starRating?: number;
  imageUrls: string[];
  lastUpdated: Date;
  // Remove embedded bookings - using separate collection now
  // bookings: BookingType[];

  // New fields
  location?: {
    latitude: number;
    longitude: number;
    address: {
      street: string;
      city: string;
      state: string;
      country: string;
      zipCode: string;
    };
  };
  contact?: {
    phone: string;
    email: string;
    website: string;
  };
  policies?: {
    checkInTime: string;
    checkOutTime: string;
    cancellationPolicy: string;
    petPolicy: string;
    smokingPolicy: string;
  };
  amenities?: {
    parking: boolean;
    wifi: boolean;
    pool: boolean;
    gym: boolean;
    spa: boolean;
    restaurant: boolean;
    bar: boolean;
    airportShuttle: boolean;
    businessCenter: boolean;
  };
  totalBookings?: number;
  totalRevenue?: number;
  averageRating?: number;
  reviewCount?: number;
  occupancyRate?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  bookingComIcal?: {
    importUrl?: string;
    syncEnabled?: boolean;
    exportEnabled?: boolean;
    exportToken?: string;
    lastSyncAt?: Date;
    lastSyncStatus?: string;
    lastSyncError?: string;
    syncErrorHistory?: Array<{
      at: Date;
      status: string;
      message: string;
    }>;
  };
  createdAt?: Date;
  updatedAt?: Date;
};

export type BookingType = {
  _id: string;
  reservationNumber?: string;
  userId: string;
  hotelId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  adultCount: number;
  childCount: number;
  arrivalTime?: "Morning" | "Afternoon" | "Evening" | "Night";
  nationality?: string;
  checkIn: Date;
  checkOut: Date;
  totalCost: number;
  status?: "pending" | "confirmed" | "arrived" | "cancelled" | "completed" | "refunded";
  specialRequests?: string;
  cancellationReason?: string;
  refundAmount?: number;
  city?: string;
  country?: string;
  checkInInfo?: {
    arrivalTime?: string;
    phone?: string;
    email?: string;
    nationality?: string;
    bookingChannel?: string;
    paymentDetails?: string;
    specialNotes?: string;
    documents?: string[];
    cityTax?: number;
    checkedInAt?: Date;
  };
  excelSync?: {
    lastSyncedAt?: Date;
    sheetName?: string;
    workbookItemId?: string;
    matchedRowNumber?: number;
    matchedRoom?: string;
    matchedDate?: Date;
    guestName?: string;
    invoiceNumber?: string;
    identifier?: string;
    paymentVia?: string;
    pax?: number;
    totalPrice?: number;
    unitPrice?: number;
    netPrice?: number;
    city?: string;
    country?: string;
    raw?: Record<string, string | number | null>;
  };
  oneNoteSync?: {
    lastSyncedAt?: Date;
    matchedPageId?: string;
    matchedPageTitle?: string;
    matchedSectionName?: string;
    room?: string;
    guestName?: string;
    arrivalNote?: string;
    nationality?: string;
    phone?: string;
    whatsapp?: string;
    nights?: number;
    checkOutNote?: string;
    bookingSource?: string;
    paymentNote?: string;
    amountDueEUR?: number;
    notes?: string;
    rawLines?: string[];
  };
  createdAt?: Date;
  updatedAt?: Date;
};

export type HotelWithBookingsType = HotelType & {
  bookings: BookingType[];
};

export type HotelSearchResponse = {
  data: HotelType[];
  pagination: {
    total: number;
    page: number;
    pages: number;
  };
};

export type BookingCalendarDayStatus =
  | "Available"
  | "Requested"
  | "Booked"
  | "Imported"
  | "Closed";

export type BookingManagementRoomType = {
  _id: string;
  name: string;
  city: string;
  country: string;
  bookingComIcal?: {
    importUrl?: string;
    syncEnabled?: boolean;
    exportEnabled?: boolean;
    exportToken?: string;
    lastSyncAt?: Date;
    lastSyncStatus?: string;
    lastSyncError?: string;
    syncErrorHistory?: Array<{
      at: Date;
      status: string;
      message: string;
    }>;
  };
};

export type BookingCalendarDayType = {
  date: string;
  status: BookingCalendarDayStatus;
  requestedCount: number;
  bookedCount: number;
  importedCount?: number;
  closed: boolean;
  closedReason?: string;
};

export type BookingCalendarBookingRowType = {
  _id: string;
  reservationNumber?: string;
  isImported?: boolean;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  checkIn: Date;
  checkOut: Date;
  status: BookingCalendarDayStatus;
  totalCost: number;
  adultCount: number;
  childCount: number;
  createdAt?: Date;
  source?: "local" | "booking_com";
  sourceLabel?: string;
  summary?: string;
  externalUid?: string;
  dtStamp?: Date;
  nationality?: string;
  specialRequests?: string;
  checkedInAt?: Date;
};

export type BookingCalendarResponseType = {
  room: BookingManagementRoomType;
  month: string;
  days: BookingCalendarDayType[];
  bookings: BookingCalendarBookingRowType[];
};
