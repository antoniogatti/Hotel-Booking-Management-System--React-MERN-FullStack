import { expect, test } from "@playwright/test";

const UI_URL = "http://localhost:5174";
const API_URL = "http://localhost:5000";
const TEST_EMAIL = "antoniogatti+palazzopintotest@gmail.com";

test("should complete the guest booking flow and surface a booking reference", async ({ page, request }) => {
  const hotelsResponse = await request.get(`${API_URL}/api/hotels`);
  expect(hotelsResponse.ok()).toBeTruthy();

  const hotels = (await hotelsResponse.json()) as Array<{
    _id: string;
    name: string;
    pricePerNight: number;
  }>;

  expect(hotels.length).toBeGreaterThan(0);
  const hotel = hotels[0];

  const runOffsetDays = (Math.floor(Date.now() / 60000) % 20) + 7;
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

test("should reject a repeated guest booking request in the duplicate protection window", async ({ request }) => {
  const hotelsResponse = await request.get(`${API_URL}/api/hotels`);
  expect(hotelsResponse.ok()).toBeTruthy();

  const hotels = (await hotelsResponse.json()) as Array<{
    _id: string;
    name: string;
    type?: string[];
  }>;

  expect(hotels.length).toBeGreaterThan(0);
  const hotel = hotels[0];

  const runOffsetDays = (Math.floor(Date.now() / 60000) % 20) + 30;
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + runOffsetDays);
  const checkOut = new Date();
  checkOut.setDate(checkOut.getDate() + runOffsetDays + 2);

  const payload = {
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
    arrivalTime: "Morning",
    adultCount: 1,
    childCount: 0,
    checkIn: checkIn.toISOString(),
    checkOut: checkOut.toISOString(),
    nights: 2,
    totalCost: 0,
  };

  const firstResponse = await request.post(`${API_URL}/api/hotels/${hotel._id}/booking-request`, {
    data: payload,
  });
  expect(firstResponse.ok()).toBeTruthy();
  const firstBody = await firstResponse.json();
  expect(firstBody.reservationNumber).toMatch(/^PP-\d{8}-[A-F0-9]{6}$/);

  const duplicateResponse = await request.post(`${API_URL}/api/hotels/${hotel._id}/booking-request`, {
    data: payload,
  });
  expect(duplicateResponse.status()).toBe(409);
  const duplicateBody = await duplicateResponse.json();
  expect(duplicateBody.message).toContain("already submitted recently");
  expect(duplicateBody.reservationNumber).toBe(firstBody.reservationNumber);
});