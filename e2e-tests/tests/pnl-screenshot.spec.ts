import { expect, test } from "@playwright/test";
import { parseBookingScreenshot } from "../../hotel-booking-frontend/src/components/bookingScreenshotParser";

const uiUrl = process.env.ADMIN_TEST_URL || "http://localhost:5197";
const roomId = "507f1f77bcf86cd799439013";
const bookingId = "507f1f77bcf86cd799439021";
const headers = {
  "access-control-allow-origin": uiUrl,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-allow-methods": "GET,PATCH,OPTIONS",
};

test("groups fragmented dates and keeps shared reservation totals out of room amounts", () => {
  const line = (text: string, x: number, y: number) => ({ text, x0: x, x1: x + 30, y0: y, y1: y + 15 });
  const parsed = parseBookingScreenshot([
    line("Example Guest", 100, 50), line("1234567890", 100, 90),
    line("Testroom", 100, 125), line("Otherroom", 100, 155),
    line("Dec", 700, 90), line("30,", 750, 90), line("2026", 800, 90),
    line("Jan", 900, 90), line("2,", 950, 90), line("2027", 1000, 90),
    line("EUR 1,200.00", 1250, 90),
  ], ["Testroom", "Otherroom"]);
  expect(parsed).toHaveLength(2);
  expect(parsed.map((row) => [row.checkIn, row.checkOut, row.amount, row.sharedTotal])).toEqual([
    ["2026-12-30", "2027-01-02", "", "1,200.00"],
    ["2026-12-30", "2027-01-02", "", "1,200.00"],
  ]);
  expect(parseBookingScreenshot([line("No reference", 0, 0)], [])).toEqual([]);
});

test("local OCR reviews a screenshot and updates only a confirmed existing booking", async ({ page }) => {
  test.setTimeout(120000);
  const unexpected: string[] = [];
  const years: string[] = [];
  const patches: unknown[] = [];
  const booking = {
    id: bookingId, source: "booking_com", roomId, reference: "opaque", guestName: "", checkIn: "2027-01-02", checkOut: "2027-01-05",
    status: "imported", overrides: { notes: "Keep me" }, amountCents: null, currency: "", reason: "Amount unavailable",
  };
  await page.addInitScript(() => { localStorage.setItem("session_id", "test-session"); localStorage.setItem("user_role", "admin"); });
  await page.context().route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/")) {
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      if (url.pathname === "/api/auth/validate-token") return route.fulfill({ headers, json: { role: "admin", userId: "test-user" } });
      if (url.pathname === "/api/bookings/rooms") return route.fulfill({ headers, json: [{ _id: roomId, name: "Testroom" }, { _id: "507f1f77bcf86cd799439014", name: "Otherroom" }] });
      if (url.pathname === "/api/pnl/entries") return route.fulfill({ headers, json: { entries: [] } });
      if (url.pathname === "/api/pnl/bookings") {
        years.push(url.searchParams.get("year") || "");
        return route.fulfill({ headers, json: { bookings: url.searchParams.get("year") === "2027" ? [booking] : [] } });
      }
      if (url.pathname.endsWith("/screenshot")) {
        patches.push(route.request().postDataJSON());
        return route.fulfill({ headers, json: { message: "Saved" } });
      }
      return route.fulfill({ status: 503, headers });
    }
    if (url.origin !== new URL(uiUrl).origin) {
      unexpected.push(url.origin);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto(`${uiUrl}/pnl/income`);
  await page.getByRole("button", { name: "Import screenshot" }).click();
  unexpected.length = 0;
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600; canvas.height = 600;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black"; ctx.font = "28px Arial";
    ctx.fillText("Example Guest", 100, 100);
    ctx.fillText("1234567890", 100, 145);
    ctx.fillText("Testroom", 100, 180);
    ctx.fillText("Otherroom", 100, 215);
    ctx.fillText("Jan 2, 2027 - Jan 5, 2027", 650, 145);
    ctx.fillText("4 adults", 650, 190);
    ctx.fillText("EUR 250.00", 1250, 145);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.evaluate(async (base64) => {
    const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
    const clipboard = new DataTransfer();
    clipboard.items.add(new File([blob], "synthetic.png", { type: "image/png" }));
    document.querySelector("textarea")!.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: clipboard }));
  }, image);
  await expect(page.getByRole("status")).toContainText("Extraction finished", { timeout: 90000 });
  const rows = page.locator("fieldset").filter({ has: page.getByText(/^Reservation /) });
  await expect(rows).toHaveCount(2);
  const row = rows.first();
  await expect(row.getByLabel("Reference")).toHaveValue("1234567890");
  await expect(row.getByLabel("Check-in")).toHaveValue("2027-01-02");
  await expect(row.getByLabel("Check-out")).toHaveValue("2027-01-05");
  await expect(row.getByLabel("Amount for this room (EUR)")).toHaveValue("");
  expect(patches).toHaveLength(0);
  await row.getByRole("button", { name: "Find bookings for these dates" }).click();
  await row.getByLabel("Confirm matching booking").selectOption(bookingId);
  await row.getByLabel("Guest name").fill("Example Guest");
  await row.getByLabel("Amount for this room (EUR)").fill("100.00");
  await row.getByRole("button", { name: "Save reviewed row" }).click();
  await expect(row).toContainText("saved");
  expect(years).toContain("2027");
  expect(patches).toEqual([{ roomId, checkIn: "2027-01-02", checkOut: "2027-01-05", details: { bookingReference: "1234567890", bookingGuestName: "Example Guest", grossAmountCents: 10000 } }]);
  const second = rows.nth(1);
  await second.getByRole("button", { name: "Find bookings for these dates" }).click();
  await second.getByLabel("Confirm matching booking").selectOption(bookingId);
  await second.getByLabel("Guest name").fill("Example Guest");
  await second.getByRole("button", { name: "Save reviewed row" }).click();
  await expect(page.getByRole("alert")).toContainText("already updated");
  expect(patches).toHaveLength(1);
  expect(unexpected).toEqual([]);
});
