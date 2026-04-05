import { test, expect } from "@playwright/test";

const frontendBaseUrl = process.env.FRONTEND_BASE_URL || "http://localhost:5174";

const roomCases = [
  {
    roomName: "Aleatico - King Studio with sofa bed",
    expectedPath: /\/rooms\/aleatico$/,
    expectedHeading: "ALEATICO Apartment",
  },
  {
    roomName: "Verdeca - Double Room",
    expectedPath: /\/rooms\/verdeca$/,
    expectedHeading: "VERDECA Room",
  },
  {
    roomName: "Malvasia - Double Room",
    expectedPath: /\/rooms\/malvasia$/,
    expectedHeading: "MALVASIA Room",
  },
  {
    roomName: "Fuocorosa - Apartment",
    expectedPath: /\/rooms\/fuocorosa$/,
    expectedHeading: "FUOCOROSA Apartment",
  },
] as const;

test.beforeEach(async ({ page }) => {
  await page.goto(`${frontendBaseUrl}/rooms`);
  await expect(page.getByText("Booking Details").first()).toBeVisible();
});

for (const roomCase of roomCases) {
  test(`room card routes correctly: ${roomCase.roomName}`, async ({ page }) => {
    await page.getByRole("link", { name: roomCase.roomName, exact: true }).first().click();

    await expect(page).toHaveURL(roomCase.expectedPath);
    await expect(
      page.getByRole("heading", { name: roomCase.expectedHeading, exact: true }).first()
    ).toBeVisible();
  });
}