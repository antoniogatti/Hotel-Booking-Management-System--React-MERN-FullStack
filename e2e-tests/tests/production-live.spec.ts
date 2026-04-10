import { expect, test } from "@playwright/test";

const frontendBaseUrl =
  process.env.PRODUCTION_FRONTEND_BASE_URL ||
  "https://www.palazzopintobnb.com";
const backendBaseUrl =
  process.env.PRODUCTION_BACKEND_BASE_URL ||
  "https://api.palazzopintobnb.com";
const allowWriteTests = process.env.PRODUCTION_E2E_WRITE_TESTS === "true";

type HotelRecord = {
  _id: string;
  name: string;
  minimumNights?: number;
  adultCount?: number;
  childCount?: number;
  type?: string[];
};

type HotelSearchResponse = {
  data: HotelRecord[];
};

const getMinimumNights = (hotel: Pick<HotelRecord, "minimumNights">) =>
  Math.max(1, hotel.minimumNights || 1);

const toUiDate = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const buildStay = (offsetDays: number, nights: number) => {
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + offsetDays);

  const checkOut = new Date(checkIn);
  checkOut.setDate(checkIn.getDate() + nights);

  return `${toUiDate(checkIn)} - ${toUiDate(checkOut)}`;
};

test.describe("production live smoke", () => {
  test("our recommendations page is live", async ({ page }) => {
    const response = await page.goto(`${frontendBaseUrl}/our-recommendations`);

    expect(response?.ok()).toBeTruthy();
    await expect(
      page.getByRole("heading", { name: "Our Recommendations", exact: true })
    ).toBeVisible();
  });

  test("reach us page is live", async ({ page }) => {
    const response = await page.goto(`${frontendBaseUrl}/reach-us`);

    expect(response?.ok()).toBeTruthy();
    await expect(
      page.getByRole("heading", { name: "Reach Us", exact: true })
    ).toBeVisible();
  });

  test("contact form shows validation errors", async ({ page }) => {
    const response = await page.goto(`${frontendBaseUrl}/contact-us`);

    expect(response?.ok()).toBeTruthy();
    await page.getByRole("button", { name: "Send Message" }).click();

    await expect(page.getByText("Name is required")).toBeVisible();
    await expect(page.getByText("Email is required")).toBeVisible();
    await expect(page.getByText("Message is required")).toBeVisible();
    await expect(
      page.getByText("You must accept the privacy policy")
    ).toBeVisible();
  });

  test("contact form can be submitted in production", async ({ page }) => {
    test.skip(
      !allowWriteTests,
      "Set PRODUCTION_E2E_WRITE_TESTS=true to allow real production contact-form submissions."
    );

    await page.goto(`${frontendBaseUrl}/contact-us`);

    const uniqueEmail = `antoniogatti+prod-contact-${Date.now()}@gmail.com`;
    await page.locator("#contact-name").fill("Antonio Gatti");
    await page.locator("#contact-email").fill(uniqueEmail);
    await page.locator("#contact-phone").fill("+393358246145");
    await page.locator("#contact-message").fill(
      "Production Playwright smoke test for the contact form."
    );
    await page.locator("#contact-privacy").check();

    await page.getByRole("button", { name: "Send Message" }).click();

    await expect(page.getByText("Message sent", { exact: true }).first()).toBeVisible();
    await expect(
      page
        .getByText(
          "Thank you for contacting us. We sent a confirmation to your email.",
          {
            exact: true,
          }
        )
        .first()
    ).toBeVisible();
  });

  test("guest booking flow works in production", async ({ page, request }) => {
    test.skip(
      !allowWriteTests,
      "Set PRODUCTION_E2E_WRITE_TESTS=true to allow real production booking submissions."
    );

    const hotelsResponse = await request.get(`${backendBaseUrl}/api/rooms`);
    expect(hotelsResponse.ok()).toBeTruthy();

    const hotels = (await hotelsResponse.json()) as HotelRecord[];
    expect(hotels.length).toBeGreaterThan(0);

    let selectedHotel: HotelRecord | undefined;
    let checkIn: Date | undefined;
    let checkOut: Date | undefined;

    for (const offsetDays of [35, 42, 49, 56, 63, 70, 77, 84, 91, 98, 105, 112, 119, 126, 133, 140, 147, 154, 161, 168]) {
      const candidateCheckIn = new Date();
      candidateCheckIn.setDate(candidateCheckIn.getDate() + offsetDays);
      const candidateCheckOut = new Date(candidateCheckIn);
      candidateCheckOut.setDate(candidateCheckIn.getDate() + 2);

      const searchParams = new URLSearchParams({
        checkIn: candidateCheckIn.toISOString(),
        checkOut: candidateCheckOut.toISOString(),
        adultCount: "1",
        childCount: "0",
        page: "1",
      });
      const searchResponse = await request.get(
        `${backendBaseUrl}/api/rooms/search?${searchParams.toString()}`
      );

      if (!searchResponse.ok()) {
        continue;
      }

      const searchResults = (await searchResponse.json()) as HotelSearchResponse;
      const candidateHotel = searchResults.data?.[0];
      if (!candidateHotel) {
        continue;
      }

      const minimumNights = getMinimumNights(candidateHotel);
      const adjustedCheckOut = new Date(candidateCheckIn);
      adjustedCheckOut.setDate(candidateCheckIn.getDate() + Math.max(2, minimumNights));

      selectedHotel = candidateHotel;
      checkIn = candidateCheckIn;
      checkOut = adjustedCheckOut;
      break;
    }

    expect(selectedHotel).toBeTruthy();
    expect(checkIn).toBeTruthy();
    expect(checkOut).toBeTruthy();

    await page.goto(frontendBaseUrl);
    await page.evaluate(
      ({ hotelId, checkInIso, checkOutIso }) => {
        sessionStorage.setItem("destination", "");
        sessionStorage.setItem("checkIn", checkInIso);
        sessionStorage.setItem("checkOut", checkOutIso);
        sessionStorage.setItem("adultCount", "1");
        sessionStorage.setItem("childCount", "0");
        sessionStorage.setItem("hotelId", hotelId);
      },
      {
        hotelId: selectedHotel!._id,
        checkInIso: checkIn!.toISOString(),
        checkOutIso: checkOut!.toISOString(),
      }
    );

    await page.goto(`${frontendBaseUrl}/hotel/${selectedHotel!._id}/booking`);
    await expect(page.getByRole("heading", { name: "Billing Details" })).toBeVisible();

    const uniqueEmail = `antoniogatti+prod-booking-${Date.now()}@gmail.com`;
    await page.locator('input[name="firstName"]').fill("Prod");
    await page.locator('input[name="lastName"]').fill("Booking");
    await page.locator('input[name="email"]').fill(uniqueEmail);
    await page.locator('input[name="phone"]').fill("1234567890");
    await page.locator('input[name="city"]').fill("Brindisi");
    await page.locator('input[name="country"]').fill("Italy");
    await page.locator('input[name="nationality"]').fill("Italian");
    await page.locator('textarea[name="specialRequests"]').fill(
      "Production Playwright smoke test booking request."
    );
    await page.locator('input[name="termsAccepted"]').check();

    await page.getByRole("button", { name: "Proceed to Checkout" }).click();
    await expect(page).toHaveURL(new RegExp(`/hotel/${selectedHotel!._id}/checkout`));

    await page.getByRole("button", { name: "Send Booking Request" }).click();

    const confirmationBox = page.locator(".bg-emerald-50").first();
    await expect(confirmationBox.getByText("Booking Reference:")).toBeVisible();
    await expect(confirmationBox.getByText(/PP-\d{8}-[A-F0-9]{6}/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Booking Request Sent" })
    ).toBeDisabled();
  });
});