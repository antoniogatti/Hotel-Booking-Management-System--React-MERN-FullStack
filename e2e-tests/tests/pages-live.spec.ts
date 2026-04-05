import { test, expect } from "@playwright/test";

const frontendBaseUrl = process.env.FRONTEND_BASE_URL || "http://localhost:5174";
const backendBaseUrl = process.env.BACKEND_BASE_URL || "http://localhost:5000";

const staticPages = [
  { path: "/", heading: "Palazzo Pinto" },
  { path: "/search", text: "Booking Details" },
  { path: "/rooms", text: "Booking Details" },
  { path: "/rooms/aleatico", heading: "ALEATICO Apartment" },
  { path: "/rooms/fuocorosa", heading: "FUOCOROSA Apartment" },
  { path: "/rooms/verdeca", heading: "VERDECA Room" },
  { path: "/rooms/malvasia", heading: "MALVASIA Room" },
  { path: "/api-docs", heading: "API Documentation" },
  { path: "/privacy-cookie-policy", heading: "Privacy and Cookie Policy" },
  { path: "/terms-conditions", heading: "Terms and Conditions" },
  { path: "/contact-us", heading: "Reach Us" },
] as const;

for (const pageCase of staticPages) {
  test(`page is live: ${pageCase.path}`, async ({ page }) => {
    const response = await page.goto(`${frontendBaseUrl}${pageCase.path}`);

    expect(response?.ok()).toBeTruthy();

    if ("heading" in pageCase) {
      await expect(
        page.getByRole("heading", { name: pageCase.heading, exact: true }).first()
      ).toBeVisible();
      return;
    }

    await expect(page.getByText(pageCase.text).first()).toBeVisible();
  });
}

test("api room record exists: Fuocorosa slug is present", async ({ request }) => {
  const response = await request.get(`${backendBaseUrl}/api/rooms`);
  expect(response.ok()).toBeTruthy();

  const rooms = (await response.json()) as Array<{ name: string; slug?: string }>;
  const fuocorosa = rooms.find((room) => /fuocorosa/i.test(room.name));

  expect(fuocorosa).toBeTruthy();
  expect(fuocorosa?.slug).toBe("fuocorosa");
});