import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MongoClient } from "mongodb";

const UI_URL = "http://localhost:5174";
const API_URL = "http://localhost:5000";
const TEST_EMAIL = "antoniogatti+palazzopintotest@gmail.com";

type HotelRecord = {
  _id: string;
  name: string;
  pricePerNight: number;
  minimumNights?: number;
  adultCount?: number;
  childCount?: number;
  type?: string[];
};

type AvailabilityResponse = {
  available: boolean;
  reason?: string;
  minimumNights?: number;
};

const TEST_BOOKING_EMAIL_REGEX =
  /^antoniogatti\+(palazzopintotest|2a-|duplicate-|2a2c-).*@gmail\.com$/i;

const readBackendEnvValue = (key: string) => {
  const envPath = join(__dirname, "..", "..", "..", "hotel-booking-backend", ".env");
  const content = readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const variableName = trimmed.slice(0, separatorIndex).trim();
    if (variableName !== key) {
      continue;
    }

    return trimmed.slice(separatorIndex + 1).trim();
  }

  return "";
};

const cleanupTestBookings = async () => {
  const connectionString =
    process.env.MONGODB_CONNECTION_STRING || readBackendEnvValue("MONGODB_CONNECTION_STRING");

  if (!connectionString) {
    throw new Error("MONGODB_CONNECTION_STRING is required to clean up test bookings.");
  }

  const client = new MongoClient(connectionString);

  try {
    await client.connect();
    const database = client.db("PalazzoPinto_DB");
    await database.collection("bookings").deleteMany({
      userId: "guest-request",
      email: { $regex: TEST_BOOKING_EMAIL_REGEX },
    });
  } finally {
    await client.close();
  }
};

test.beforeAll(async () => {
  await cleanupTestBookings();
});

test.afterAll(async () => {
  await cleanupTestBookings();
});

const getMinimumNights = (hotel: Pick<HotelRecord, "minimumNights">) =>
  Math.max(1, hotel.minimumNights || 1);

const toUiDate = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const toLocalDateOnly = (date: Date) => {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const seedSearchAndOpenBooking = async (params: {
  page: Parameters<typeof test>[0]["page"];
  hotelId: string;
  checkIn: string;
  checkOut: string;
  adultCount: number;
  childCount: number;
}) => {
  const { page, hotelId, checkIn, checkOut, adultCount, childCount } = params;

  await page.goto(UI_URL);
  await page.evaluate(
    ({ seedHotelId, seedCheckIn, seedCheckOut, seedAdults, seedChildren }) => {
      sessionStorage.setItem("destination", "");
      sessionStorage.setItem("checkIn", seedCheckIn);
      sessionStorage.setItem("checkOut", seedCheckOut);
      sessionStorage.setItem("adultCount", String(seedAdults));
      sessionStorage.setItem("childCount", String(seedChildren));
      sessionStorage.setItem("hotelId", seedHotelId);
    },
    {
      seedHotelId: hotelId,
      seedCheckIn: checkIn,
      seedCheckOut: checkOut,
      seedAdults: adultCount,
      seedChildren: childCount,
    }
  );

  await page.goto(`${UI_URL}/hotel/${hotelId}/booking`);
};

const findAvailableStay = async (params: {
  request: Parameters<typeof test>[0]["request"];
  hotelId: string;
  nights: number;
  adultCount: number;
  childCount: number;
  startOffsetDays: number;
  maxAttempts: number;
}) => {
  const {
    request,
    hotelId,
    nights,
    adultCount,
    childCount,
    startOffsetDays,
    maxAttempts,
  } = params;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + startOffsetDays + attempt * 7);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkIn.getDate() + nights);

    const checkInValue = toLocalDateOnly(checkIn);
    const checkOutValue = toLocalDateOnly(checkOut);

    const availabilityResponse = await request.get(
      `${API_URL}/api/rooms/${hotelId}/availability`,
      {
        params: {
          checkIn: checkInValue,
          checkOut: checkOutValue,
          adultCount: String(adultCount),
          childCount: String(childCount),
        },
      }
    );

    if (!availabilityResponse.ok()) {
      continue;
    }

    const availability = (await availabilityResponse.json()) as AvailabilityResponse;
    if (availability.available) {
      return { checkInValue, checkOutValue };
    }
  }

  throw new Error("Unable to find an available stay window for this test run.");
};

const buildStay = (offsetDays: number, nights: number) => {
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + offsetDays);

  const checkOut = new Date(checkIn);
  checkOut.setDate(checkIn.getDate() + nights);

  return {
    checkIn,
    checkOut,
    checkInValue: toLocalDateOnly(checkIn),
    checkOutValue: toLocalDateOnly(checkOut),
    dateRangeValue: `${toUiDate(checkIn)} - ${toUiDate(checkOut)}`,
  };
};

test("should complete the guest booking flow and surface a booking reference", async ({ page, request }) => {
  const hotelsResponse = await request.get(`${API_URL}/api/rooms`);
  expect(hotelsResponse.ok()).toBeTruthy();

  const hotels = (await hotelsResponse.json()) as HotelRecord[];

  expect(hotels.length).toBeGreaterThan(0);
  const hotel = hotels[0];
  const minimumNights = getMinimumNights(hotel);

  const { checkInValue, checkOutValue } = await findAvailableStay({
    request,
    hotelId: hotel._id,
    nights: minimumNights,
    adultCount: 1,
    childCount: 0,
    startOffsetDays: 35,
    maxAttempts: 15,
  });

  await seedSearchAndOpenBooking({
    page,
    hotelId: hotel._id,
    checkIn: checkInValue,
    checkOut: checkOutValue,
    adultCount: 1,
    childCount: 0,
  });

  await expect(page.getByRole("heading", { name: "Billing Details" })).toBeVisible();

  await page.locator('input[name="firstName"]').fill("Guest");
  await page.locator('input[name="lastName"]').fill("Flow");
  await page.locator('input[name="email"]').fill(TEST_EMAIL);
  await page.locator('input[name="phone"]').fill("1234567890");
  await page.locator('input[name="city"]').fill("Brindisi");
  await page.locator('input[name="country"]').fill("Italy");
  await page.locator('input[name="nationality"]').fill("Italian");
  await page.locator('textarea[name="specialRequests"]').fill("Late arrival if possible");
  await page.locator('input[name="termsAccepted"]').check();

  await page.getByRole("button", { name: "Proceed to Checkout" }).click();
  await expect(page).toHaveURL(new RegExp(`/hotel/${hotel._id}/checkout`));

  const bookingRequestPromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/api/rooms/${hotel._id}/booking-request`)
  );

  await page.getByRole("button", { name: "Send Booking Request" }).click();

  const bookingRequestResponse = await bookingRequestPromise;
  expect(bookingRequestResponse.ok()).toBeTruthy();

  const bookingRequestPayload = bookingRequestResponse.request().postDataJSON() as {
    checkIn: string;
    checkOut: string;
    roomName: string;
    hotelName: string;
  };

  expect(bookingRequestPayload.checkIn).toBe(checkInValue);
  expect(bookingRequestPayload.checkOut).toBe(checkOutValue);
  expect(bookingRequestPayload.roomName).toBe(hotel.name);
  expect(bookingRequestPayload.hotelName).toBe(hotel.name);

  const bookingResponseBody = (await bookingRequestResponse.json()) as {
    reservationNumber: string;
    emailsSent?: boolean;
    warning?: string;
  };

  expect(bookingResponseBody.reservationNumber).toMatch(/^PP-\d{8}-[A-F0-9]{6}$/);
  // Treat delayed/failed email dispatch as a failing verification signal in this core flow.
  expect(bookingResponseBody.emailsSent).toBe(true);
  expect(bookingResponseBody.warning || "").toBe("");

  const confirmationBox = page.locator(".bg-emerald-50").first();
  await expect(confirmationBox.getByText("Booking Reference:")).toBeVisible();
  await expect(confirmationBox.getByText(/PP-\d{8}-[A-F0-9]{6}/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Booking Request Sent" })).toBeDisabled();
});

test("should complete guest booking for 2 adults using the room minimum stay", async ({ page, request }) => {
  const hotelsResponse = await request.get(`${API_URL}/api/rooms`);
  expect(hotelsResponse.ok()).toBeTruthy();

  const hotels = (await hotelsResponse.json()) as HotelRecord[];

  expect(hotels.length).toBeGreaterThan(0);
  const hotel = hotels[0];
  const minimumNights = getMinimumNights(hotel);

  const { checkInValue, checkOutValue } = await findAvailableStay({
    request,
    hotelId: hotel._id,
    nights: Math.max(2, minimumNights),
    adultCount: 2,
    childCount: 0,
    startOffsetDays: 28,
    maxAttempts: 16,
  });

  await seedSearchAndOpenBooking({
    page,
    hotelId: hotel._id,
    checkIn: checkInValue,
    checkOut: checkOutValue,
    adultCount: 2,
    childCount: 0,
  });

  await expect(page.getByRole("heading", { name: "Billing Details" })).toBeVisible();

  const uniqueEmail = `antoniogatti+2a-${Date.now()}@gmail.com`;
  await page.locator('input[name="firstName"]').fill("Couple");
  await page.locator('input[name="lastName"]').fill("Getaway");
  await page.locator('input[name="email"]').fill(uniqueEmail);
  await page.locator('input[name="phone"]').fill("1234567890");
  await page.locator('input[name="city"]').fill("Brindisi");
  await page.locator('input[name="country"]').fill("Italy");
  await page.locator('input[name="nationality"]').fill("Italian");
  await page.locator('textarea[name="specialRequests"]').fill("Weekend getaway for two");
  await page.locator('input[name="termsAccepted"]').check();

  await page.getByRole("button", { name: "Proceed to Checkout" }).click();
  await expect(page).toHaveURL(new RegExp(`/hotel/${hotel._id}/checkout`));

  await page.getByRole("button", { name: "Send Booking Request" }).click();

  const confirmationBox = page.locator(".bg-emerald-50").first();
  await expect(confirmationBox.getByText("Booking Reference:")).toBeVisible();
  await expect(confirmationBox.getByText(/PP-\d{8}-[A-F0-9]{6}/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Booking Request Sent" })).toBeDisabled();
});

test("should reject a repeated guest booking request in the duplicate protection window", async ({ request }) => {
  const hotelsResponse = await request.get(`${API_URL}/api/rooms`);
  expect(hotelsResponse.ok()).toBeTruthy();

  const hotels = (await hotelsResponse.json()) as HotelRecord[];

  expect(hotels.length).toBeGreaterThan(0);
  const hotel = hotels[0];
  const minimumNights = getMinimumNights(hotel);

  const duplicateTestEmail = `antoniogatti+duplicate-${Date.now()}@gmail.com`;
  let payload: {
    hotelId: string;
    hotelName: string;
    roomName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    city: string;
    country: string;
    nationality: string;
    specialRequests: string;
    arrivalTime: "Morning";
    adultCount: number;
    childCount: number;
    checkIn: string;
    checkOut: string;
    nights: number;
    totalCost: number;
  } | null = null;

  let firstResponse: Awaited<ReturnType<typeof request.post>> | null = null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const checkIn = new Date(Date.UTC(2027, 0, 10 + attempt * 21));
    const checkOut = new Date(checkIn);
    checkOut.setUTCDate(checkIn.getUTCDate() + Math.max(2, minimumNights));

    const candidatePayload = {
      hotelId: hotel._id,
      hotelName: hotel.name,
      roomName: Array.isArray(hotel.type) && hotel.type.length > 0 ? hotel.type[0] : "Room",
      firstName: "Duplicate",
      lastName: "Guest",
      email: duplicateTestEmail,
      phone: "1234567890",
      city: "Brindisi",
      country: "Italy",
      nationality: "Italian",
      specialRequests: "None",
      arrivalTime: "Morning" as const,
      adultCount: 1,
      childCount: 0,
      checkIn: checkIn.toISOString().slice(0, 10),
      checkOut: checkOut.toISOString().slice(0, 10),
      nights: Math.max(2, minimumNights),
      totalCost: 0,
    };

    const candidateResponse = await request.post(`${API_URL}/api/rooms/${hotel._id}/booking-request`, {
      data: candidatePayload,
    });

    if (candidateResponse.ok()) {
      payload = candidatePayload;
      firstResponse = candidateResponse;
      break;
    }

    if (candidateResponse.status() !== 409) {
      firstResponse = candidateResponse;
      break;
    }
  }

  expect(firstResponse).not.toBeNull();
  expect(firstResponse!.ok()).toBeTruthy();
  expect(payload).not.toBeNull();

  const firstBody = await firstResponse!.json();
  expect(firstBody.reservationNumber).toMatch(/^PP-\d{8}-[A-F0-9]{6}$/);

  const duplicateResponse = await request.post(`${API_URL}/api/rooms/${hotel._id}/booking-request`, {
    data: payload!,
  });
  expect(duplicateResponse.status()).toBe(409);
  const duplicateBody = await duplicateResponse.json();
  expect(duplicateBody.message).toContain("not available for the selected dates");
  expect(duplicateBody.reservationNumber).toBe(firstBody.reservationNumber);
});

test("should complete guest booking for 2 adults and 2 children for 4 nights in the week after current week", async ({ page, request }) => {
  const hotelsResponse = await request.get(`${API_URL}/api/rooms`);
  expect(hotelsResponse.ok()).toBeTruthy();

  const hotels = (await hotelsResponse.json()) as HotelRecord[];

  expect(hotels.length).toBeGreaterThan(0);

  // Pick a room that can host 2 adults and 2 children.
  const hotel = hotels.find((h) => h.adultCount >= 2 && h.childCount >= 2);
  test.skip(!hotel, "No room currently supports 2 adults and 2 children.");
  const minimumNights = getMinimumNights(hotel!);

  const { checkInValue, checkOutValue } = await findAvailableStay({
    request,
    hotelId: hotel!._id,
    nights: Math.max(4, minimumNights),
    adultCount: 2,
    childCount: 2,
    startOffsetDays: 21,
    maxAttempts: 20,
  });

  await seedSearchAndOpenBooking({
    page,
    hotelId: hotel!._id,
    checkIn: checkInValue,
    checkOut: checkOutValue,
    adultCount: 2,
    childCount: 2,
  });

  await expect(page.getByRole("heading", { name: "Billing Details" })).toBeVisible();

  const uniqueEmail = `antoniogatti+2a2c-${Date.now()}@gmail.com`;
  await page.locator('input[name="firstName"]').fill("Family");
  await page.locator('input[name="lastName"]').fill("WeekAfter");
  await page.locator('input[name="email"]').fill(uniqueEmail);
  await page.locator('input[name="phone"]').fill("1234567890");
  await page.locator('input[name="city"]').fill("Brindisi");
  await page.locator('input[name="country"]').fill("Italy");
  await page.locator('input[name="nationality"]').fill("Italian");
  await page.locator('textarea[name="specialRequests"]').fill("Family stay for 5 nights");
  await page.locator('input[name="termsAccepted"]').check();

  await page.getByRole("button", { name: "Proceed to Checkout" }).click();
  await expect(page).toHaveURL(new RegExp(`/hotel/${hotel._id}/checkout`));

  await expect(page.getByText("2 Adults, 2 Children")).toBeVisible();

  await page.getByRole("button", { name: "Send Booking Request" }).click();

  const confirmationBox = page.locator(".bg-emerald-50").first();
  await expect(confirmationBox.getByText("Booking Reference:")).toBeVisible();
  await expect(confirmationBox.getByText(/PP-\d{8}-[A-F0-9]{6}/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Booking Request Sent" })).toBeDisabled();
});