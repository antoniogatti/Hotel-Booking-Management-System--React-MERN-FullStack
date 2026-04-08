const BOOKING_COM_HOSTNAME = "booking.com";
const MAX_IMPORT_URL_LENGTH = 2048;

type BookingComImportUrlValidationResult =
  | { ok: true; normalizedUrl: string }
  | { ok: false; message: string };

const normalizeHostname = (hostname: string) => hostname.trim().toLowerCase().replace(/\.+$/, "");

const isAllowedBookingComHostname = (hostname: string) => {
  const normalizedHostname = normalizeHostname(hostname);

  return (
    normalizedHostname === BOOKING_COM_HOSTNAME ||
    normalizedHostname.endsWith(`.${BOOKING_COM_HOSTNAME}`)
  );
};

export const validateBookingComImportUrl = (
  rawValue?: string | null
): BookingComImportUrlValidationResult => {
  const candidate = typeof rawValue === "string" ? rawValue.trim() : "";

  if (!candidate) {
    return { ok: true, normalizedUrl: "" };
  }

  if (candidate.length > MAX_IMPORT_URL_LENGTH) {
    return {
      ok: false,
      message: "Booking.com import URL is too long",
    };
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(candidate);
  } catch {
    return {
      ok: false,
      message: "Booking.com import URL is invalid",
    };
  }

  if (parsedUrl.protocol !== "https:") {
    return {
      ok: false,
      message: "Booking.com import URL must use HTTPS",
    };
  }

  if (parsedUrl.username || parsedUrl.password) {
    return {
      ok: false,
      message: "Booking.com import URL cannot include credentials",
    };
  }

  if (parsedUrl.port && parsedUrl.port !== "443") {
    return {
      ok: false,
      message: "Booking.com import URL must use the default HTTPS port",
    };
  }

  if (!isAllowedBookingComHostname(parsedUrl.hostname)) {
    return {
      ok: false,
      message: "Booking.com import URL must target a booking.com domain",
    };
  }

  return {
    ok: true,
    normalizedUrl: parsedUrl.toString(),
  };
};

export const assertValidBookingComImportUrl = (rawValue?: string | null) => {
  const validation = validateBookingComImportUrl(rawValue);

  if (validation.ok === false) {
    throw new Error(validation.message);
  }

  return validation.normalizedUrl;
};
