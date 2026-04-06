const MS_PER_DAY = 1000 * 60 * 60 * 24;
const FREE_CANCELLATION_DAYS = 7;

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const getCancellationPolicyMessage = (checkIn?: Date | string | null) => {
  if (!checkIn) {
    return "Free cancellation up to 7 days before arrival. Bookings made within 7 days of check-in are non-refundable.";
  }

  const checkInDate = startOfDay(new Date(checkIn));

  if (Number.isNaN(checkInDate.getTime())) {
    return "Free cancellation up to 7 days before arrival. Bookings made within 7 days of check-in are non-refundable.";
  }

  const today = startOfDay(new Date());
  const diffDays = Math.floor((checkInDate.getTime() - today.getTime()) / MS_PER_DAY);

  if (diffDays < FREE_CANCELLATION_DAYS) {
    return "This booking falls within 7 days of arrival and is non-refundable.";
  }

  const freeCancellationUntil = new Date(checkInDate);
  freeCancellationUntil.setDate(freeCancellationUntil.getDate() - FREE_CANCELLATION_DAYS);

  return `Free cancellation until ${freeCancellationUntil.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}.`;
};