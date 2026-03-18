import { expect, test } from "@playwright/test";

const UI_URL = "http://localhost:5174";
const API_URL = "http://localhost:5000";
const TEST_EMAIL = "antoniogatti+palazzopintotest@gmail.com";

test("should complete the guest booking flow and surface a booking reference", async ({ page, request }) => {
  const hotelsResponse = await request.get(`${API_URL}/api/rooms`);
  expect(hotelsResponse.ok()).toBeTruthy();

  const hotels = (await hotelsResponse.json()) as Array<{
    _id: string;
    name: string;
    pricePerNight: number;
  }>;

  expect(hotels.length).toBeGreaterThan(0);
  const hotel = hotels[0];

  const runOffsetDays = (Math.floor(Date.now() / 60000) % 15) + 40;
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + runOffsetDays);
  const checkOut = new Date();
  checkOut.setDate(checkOut.getDate() + runOffsetDays + 1);
  const checkInValue = checkIn.toISOString().split("T")[0];
  const checkOutValue = checkOut.toISOString().split("T")[0];

  await page.goto(`${UI_URL}/`);

  await page.locator("#hero-guests").selectOption("1");
  await page.getByRole("button", { name: "Check Availability" }).click();

  await expect(page).toHaveURL(/\/rooms|\/search/);
  await page.getByText(hotel.name).first().click();
  await expect(page).toHaveURL(new RegExp(`/detail/${hotel._id}`));

  await page.getByPlaceholder("Check-in Date").fill(checkInValue);
  await page.getByPlaceholder("Check-out Date").fill(checkOutValue);
  await page.locator('input[name="adultCount"]').fill("1");
  await page.locator('input[name="childCount"]').fill("0");
  await page.getByRole("button", { name: "Proceed to your details" }).click();
  await expect(page).toHaveURL(new RegExp(`/hotel/${hotel._id}/booking`));

  await page.locator('input[name="firstName"]').fill("Guest");
  await page.locator('input[name="lastName"]').fill("Flow");
  await page.locator('input[name="email"]').fill(TEST_EMAIL);
  await page.locator('input[name="phone"]').fill("1234567890");
  await page.locator('input[name="city"]').fill("Brindisi");
  await page.locator('input[name="country"]').fill("Italy");
  await page.locator('textarea[name="specialRequests"]').fill("Late arrival if possible");
  await page.locator('input[name="termsAccepted"]').check();

  await page.getByRole("button", { name: "Proceed to Checkout" }).click();
  await expect(page).toHaveURL(new RegExp(`/hotel/${hotel._id}/checkout`));

  await page.getByRole("button", { name: "Send Booking Request" }).click();

  const confirmationBox = page.locator(".bg-emerald-50").first();
  await expect(confirmationBox.getByText("Booking Reference:")).toBeVisible();
  await expect(confirmationBox.getByText(/PP-\d{8}-[A-F0-9]{6}/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Booking Request Sent" })).toBeDisabled();
});

test("should complete guest booking for 2 adults for 2 nights", async ({ page, request }) => {
  const hotelsResponse = await request.get(`${API_URL}/api/rooms`);
  expect(hotelsResponse.ok()).toBeTruthy();

  const hotels = (await hotelsResponse.json()) as Array<{
    _id: string;
    name: string;
    pricePerNight: number;
  }>;

  expect(hotels.length).toBeGreaterThan(0);
  const hotel = hotels[0];

  const runOffsetDays = (Math.floor(Date.now() / 60000) % 12) + 20;
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + runOffsetDays);
  const checkOut = new Date();
  checkOut.setDate(checkOut.getDate() + runOffsetDays + 2);
  const checkInValue = checkIn.toISOString().split("T")[0];
  const checkOutValue = checkOut.toISOString().split("T")[0];

  await page.goto(`${UI_URL}/`);

  await page.locator("#hero-guests").selectOption("2");
  await page.getByRole("button", { name: "Check Availability" }).click();

  await expect(page).toHaveURL(/\/rooms|\/search/);
  await page.getByText(hotel.name).first().click();
  await expect(page).toHaveURL(new RegExp(`/detail/${hotel._id}`));

  await page.getByPlaceholder("Check-in Date").fill(checkInValue);
  await page.getByPlaceholder("Check-out Date").fill(checkOutValue);
  await page.locator('input[name="adultCount"]').fill("2");
  await page.locator('input[name="childCount"]').fill("0");
  await page.getByRole("button", { name: "Proceed to your details" }).click();
  await expect(page).toHaveURL(new RegExp(`/hotel/${hotel._id}/booking`));

  const uniqueEmail = `antoniogatti+2a-${Date.now()}@gmail.com`;
  await page.locator('input[name="firstName"]').fill("Couple");
  await page.locator('input[name="lastName"]').fill("Getaway");
  await page.locator('input[name="email"]').fill(uniqueEmail);
  await page.locator('input[name="phone"]').fill("1234567890");
  await page.locator('input[name="city"]').fill("Brindisi");
  await page.locator('input[name="country"]').fill("Italy");
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

  const hotels = (await hotelsResponse.json()) as Array<{
    _id: string;
    name: string;
    type?: string[];
  }>;

  expect(hotels.length).toBeGreaterThan(0);
  const hotel = hotels[0];

  const baseOffset = (Math.floor(Date.now() / 60000) % 10) + 70;
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
    const runOffsetDays = baseOffset + attempt * 7;
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + runOffsetDays);
    const checkOut = new Date();
    checkOut.setDate(checkOut.getDate() + runOffsetDays + 2);

    const candidatePayload = {
      hotelId: hotel._id,
      hotelName: hotel.name,
      roomName: Array.isArray(hotel.type) && hotel.type.length > 0 ? hotel.type[0] : "Room",
      firstName: "Duplicate",
      lastName: "Guest",
      email: TEST_EMAIL,
      phone: "1234567890",
      city: "Brindisi",
      country: "Italy",
      specialRequests: "None",
      arrivalTime: "Morning" as const,
      adultCount: 1,
      childCount: 0,
      checkIn: checkIn.toISOString(),
      checkOut: checkOut.toISOString(),
      nights: 2,
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

  const hotels = (await hotelsResponse.json()) as Array<{
    _id: string;
    name: string;
    adultCount: number;
    childCount: number;
  }>;

  expect(hotels.length).toBeGreaterThan(0);

  // Pick a room that can host 2 adults and 2 children.
  const hotel = hotels.find((h) => h.adultCount >= 2 && h.childCount >= 2);
  test.skip(!hotel, "No room currently supports 2 adults and 2 children.");

  // Build a check-in date in the week after the current week, with a rotating weekday offset.
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 Sun ... 6 Sat
  const daysUntilNextMonday = ((8 - dayOfWeek) % 7) || 7;
  const nextWeekMonday = new Date(now);
  nextWeekMonday.setDate(now.getDate() + daysUntilNextMonday);

  const weekdayOffset = Math.floor(Date.now() / 60000) % 2; // 0..1 keeps checkout mostly in/near that week
  const checkIn = new Date(nextWeekMonday);
  checkIn.setDate(nextWeekMonday.getDate() + weekdayOffset);

  const checkOut = new Date(checkIn);
  checkOut.setDate(checkIn.getDate() + 4);

  const checkInValue = checkIn.toISOString().split("T")[0];
  const checkOutValue = checkOut.toISOString().split("T")[0];

  await page.goto(`${UI_URL}/`);

  await page.locator("#hero-guests").selectOption("2");
  await page.getByRole("button", { name: "Check Availability" }).click();

  await expect(page).toHaveURL(/\/rooms|\/search/);
  await page.getByText(hotel.name).first().click();
  await expect(page).toHaveURL(new RegExp(`/detail/${hotel._id}`));

  await page.getByPlaceholder("Check-in Date").fill(checkInValue);
  await page.getByPlaceholder("Check-out Date").fill(checkOutValue);
  await page.locator('input[name="adultCount"]').fill("2");
  await page.locator('input[name="childCount"]').fill("2");
  await page.getByRole("button", { name: "Proceed to your details" }).click();
  await expect(page).toHaveURL(new RegExp(`/hotel/${hotel._id}/booking`));

  const uniqueEmail = `antoniogatti+2a2c-${Date.now()}@gmail.com`;
  await page.locator('input[name="firstName"]').fill("Family");
  await page.locator('input[name="lastName"]').fill("WeekAfter");
  await page.locator('input[name="email"]').fill(uniqueEmail);
  await page.locator('input[name="phone"]').fill("1234567890");
  await page.locator('input[name="city"]').fill("Brindisi");
  await page.locator('input[name="country"]').fill("Italy");
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