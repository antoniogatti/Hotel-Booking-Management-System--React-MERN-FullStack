type CheckInInfo = {
  arrivalTime?: string;
  phone?: string;
  nationality?: string;
  bookingChannel?: string;
  paymentDetails?: string;
  specialNotes?: string;
};

type BookingWithLegacyDetails<T extends CheckInInfo> = {
  checkInInfo?: T;
  phone?: string;
  nationality?: string;
  oneNoteSync?: {
    arrivalNote?: string;
    phone?: string;
    nationality?: string;
    bookingSource?: string;
    paymentNote?: string;
    notes?: string;
  };
  excelSync?: { paymentVia?: string };
};

export const checkInInfoForResponse = <T extends CheckInInfo>(
  booking: BookingWithLegacyDetails<T>
) => {
  const info = booking.checkInInfo;
  const legacy = booking.oneNoteSync;
  return {
    ...info,
    arrivalTime: info?.arrivalTime ?? legacy?.arrivalNote,
    phone: info?.phone ?? (booking.phone || legacy?.phone),
    nationality: info?.nationality ?? (booking.nationality || legacy?.nationality),
    bookingChannel: info?.bookingChannel ?? legacy?.bookingSource,
    paymentDetails: info?.paymentDetails ?? (legacy?.paymentNote || booking.excelSync?.paymentVia),
    specialNotes: info?.specialNotes ?? legacy?.notes,
  };
};
