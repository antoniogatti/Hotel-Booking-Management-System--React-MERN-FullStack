import { expect, test } from "@playwright/test";

const UI_URL = "http://localhost:5174";
const TEST_EMAIL = "antoniogatti+palazzopintotest@gmail.com";

test("should submit the contact form from the homepage navigation", async ({ page }) => {
  await page.goto(`${UI_URL}/`);
  await page.getByRole("link", { name: "Contact Us" }).first().click();

  await expect(page).toHaveURL(/\/contact-us$/);
  await expect(page.locator("h1", { hasText: "Contact Us" })).toBeVisible();

  await page.locator("#contact-name").fill("Antonio Gatti");
  await page.locator("#contact-email").fill(TEST_EMAIL);
  await page.locator("#contact-phone").fill("+393358246145");
  await page.locator("#contact-message").fill(
    "Hello, I would like more information about room availability for next month."
  );
  await page.locator("#contact-privacy").check();

  await page.getByRole("button", { name: "Send Message" }).click();

  await expect(page.getByText("Message sent", { exact: true }).first()).toBeVisible();
  await expect(
    page
      .getByText("Thank you for contacting us. We sent a confirmation to your email.", {
        exact: true,
      })
      .first()
  ).toBeVisible();
  await expect(page.locator("#contact-name")).toHaveValue("");
  await expect(page.locator("#contact-email")).toHaveValue("");
  await expect(page.locator("#contact-message")).toHaveValue("");
});

test("should show client-side validation errors on the contact form", async ({ page }) => {
  await page.goto(`${UI_URL}/contact-us`);

  await page.getByRole("button", { name: "Send Message" }).click();

  await expect(page.getByText("Name is required")).toBeVisible();
  await expect(page.getByText("Email is required")).toBeVisible();
  await expect(page.getByText("Message is required")).toBeVisible();
  await expect(page.getByText("You must accept the privacy policy")).toBeVisible();
});