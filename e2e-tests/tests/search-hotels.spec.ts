import { test, expect } from "@playwright/test";

const UI_URL = "http://localhost:5174/";

test.beforeEach(async ({ page }) => {
  await page.goto(UI_URL);

  // get the sign in button
  await page.getByRole("link", { name: "Sign In" }).click();

  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();

  await page.locator("[name=email]").fill("1@1.com");
  await page.locator("[name=password]").fill("password123");

  await page.getByRole("button", { name: "Login" }).click();

  await expect(page.getByText("Sign in Successful!")).toBeVisible();
});

test("should show hotel search results", async ({ page }) => {
  await page.goto(UI_URL);

  await page.getByPlaceholder("Where are you going?").fill("Dublin");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page.getByText("Hotels found in Dublin")).toBeVisible();
  await expect(page.getByText("Dublin Getaways")).toBeVisible();
});

test("should show hotel detail", async ({ page }) => {
  await page.goto(UI_URL);

  await page.getByPlaceholder("Where are you going?").fill("Dublin");
  await page.getByRole("button", { name: "Search" }).click();

  await page.getByText("Dublin Getaways").click();
  await expect(page).toHaveURL(/detail/);
  await expect(page.getByRole("button", { name: "Book now" })).toBeVisible();
});

test("should submit booking request", async ({ page }) => {
  await page.goto(UI_URL);

  await page.getByPlaceholder("Where are you going?").fill("Dublin");

  const date = new Date();
  date.setDate(date.getDate() + 3);
  const formattedDate = date.toISOString().split("T")[0];
  await page.getByPlaceholder("Check-out Date").fill(formattedDate);

  await page.getByRole("button", { name: "Search" }).click();

  await page.getByText("Dublin Getaways").click();
  await page.getByRole("button", { name: "Book now" }).click();

  await page.locator('input[name="firstName"]').fill("Anton");
  await page.locator('input[name="lastName"]').fill("Test");
  await page.locator('input[name="email"]').fill("anton@example.com");
  await page.locator('input[name="phone"]').fill("123456789");
  await page.locator('input[name="city"]').fill("Dublin");
  await page.locator('input[name="country"]').fill("Ireland");
  await page.locator('input[name="nationality"]').fill("Italian");
  await page.getByRole("checkbox").check();

  await page.getByRole("button", { name: "Continue to Checkout" }).click();
  await expect(page.getByRole("heading", { name: "Booking Details" })).toBeVisible();
  await page.getByRole("button", { name: "Send Booking Request" }).click();
  await expect(page.getByText(/Booking Request Sent|Booking Saved/)).toBeVisible();
});
