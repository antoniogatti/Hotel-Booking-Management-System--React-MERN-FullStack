import { expect, test } from "@playwright/test";

const uiUrl = process.env.ADMIN_TEST_URL || "http://localhost:5174";
const year = new Date().getFullYear();
const roomId = "507f1f77bcf86cd799439013";
const headers = {
  "access-control-allow-origin": uiUrl,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("session_id", "test-session");
    localStorage.setItem("user_role", "admin");
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === "/api/auth/validate-token") return route.fulfill({ headers, json: { role: "admin", userId: "test-user" } });
    if (path === "/api/bookings/rooms") return route.fulfill({ headers, json: [{ _id: roomId, name: "Test room" }] });
    if (path === "/api/pnl/views") return route.fulfill({ headers, json: { views: [] } });
    return route.fulfill({ status: 503, headers, json: { message: "Unavailable" } });
  });
});

test("income loads both sources and saves reporting details without changing check-in recipients", async ({ page }) => {
  const common = {
    roomId, checkIn: `${year}-01-02`, checkOut: `${year}-01-05`, phone: "", country: "", city: "",
    identifier: "", guestDetails: "", guestCount: null, nights: 3, amountCents: null, currency: "",
    reason: "Amount unavailable", netAmountCents: null, unitAmountCents: null, invoiceRequired: null,
    invoiceCreated: null, invoiceNumber: "", paymentMethod: "", taxQuarter: "",
  };
  const site = { ...common, id: "507f1f77bcf86cd799439021", source: "local", status: "confirmed",
    sourceDetails: { reference: "SITE-1", guestName: "Site Guest", email: "site@example.test", phone: "" } };
  const calendar = { ...common, id: "507f1f77bcf86cd799439022", source: "booking_com", status: "imported", calendarEvent: true,
    sourceDetails: { reference: "opaque", guestName: "", email: "original@example.test", phone: "" } };
  const saved: Record<string, Record<string, string>> = { [site.id]: { notes: "Keep" }, [calendar.id]: { notes: "Keep" } };
  const invitations: Record<string, unknown>[] = [];
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (request.method() === "PUT") {
      const id = request.url().split("/").pop()!;
      saved[id] = request.postDataJSON();
      return route.fulfill({ headers, json: { message: "Saved" } });
    }
    const rows = [site, calendar].map((booking) => {
      const details = saved[booking.id];
      return { ...booking, reference: details.bookingReference || booking.sourceDetails.reference,
        guestName: details.bookingGuestName || booking.sourceDetails.guestName,
        email: details.bookingEmail || booking.sourceDetails.email, phone: details.bookingPhone || booking.sourceDetails.phone,
        notes: details.notes || "", arrivalTime: details.arrivalTime || "", overrides: details };
    });
    return route.fulfill({ headers, json: { bookings: rows } });
  });
  await page.route("**/api/pnl/check-in-invitations", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    invitations.push(route.request().postDataJSON());
    return route.fulfill({ headers, json: { message: "Accepted" } });
  });
  await page.goto(`${uiUrl}/pnl/income`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog", { name: "Income full-screen editor" });
  await expect(editor).toContainText("1 site, 1 Booking.com, 0 recorded");
  await editor.getByLabel("Booking source").selectOption("booking_com");
  const calendarRow = editor.locator("tbody tr").first();
  await expect(editor.locator("tbody tr")).toHaveCount(1);
  await expect(calendarRow).toContainText("iCal availability event");
  await calendarRow.getByLabel(/^Guest for /).fill("Calendar Guest");
  await calendarRow.getByLabel(/^Guest for /).blur();
  await expect.poll(() => saved[calendar.id].bookingGuestName).toBe("Calendar Guest");
  await calendarRow.getByLabel(/^Reference for /).fill("REAL-1");
  await calendarRow.getByLabel(/^Reference for /).blur();
  await expect.poll(() => saved[calendar.id].bookingReference).toBe("REAL-1");
  await calendarRow.getByLabel(/^Email for /).fill("report@example.test");
  await calendarRow.getByLabel(/^Email for /).blur();
  await expect.poll(() => saved[calendar.id].bookingEmail).toBe("report@example.test");
  await calendarRow.getByLabel(/^Arrival time for /).fill("15:20");
  await calendarRow.getByLabel(/^Arrival time for /).blur();
  await expect.poll(() => saved[calendar.id].arrivalTime).toBe("15:20");
  expect(saved[calendar.id].notes).toBe("Keep");
  await calendarRow.getByRole("checkbox", { name: /Select Calendar Guest/ }).check();
  await editor.getByRole("button", { name: "Check-in actions (1)" }).click();
  const panel = page.getByRole("dialog", { name: "Check-in actions" });
  await expect(panel).toContainText("original@example.test");
  await expect(panel).not.toContainText("report@example.test");
  page.once("dialog", (dialog) => dialog.accept());
  await panel.getByRole("button", { name: "Send email to 1 guest(s)" }).click();
  await expect.poll(() => invitations.length).toBe(1);
  expect(invitations[0].expectedEmail).toBe("original@example.test");
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await editor.getByLabel("Booking source").selectOption("local");
  const siteRow = editor.locator("tbody tr").first();
  await siteRow.getByLabel(/^Guest for /).fill("Reporting Guest");
  await siteRow.getByLabel(/^Guest for /).blur();
  await expect.poll(() => saved[site.id].bookingGuestName).toBe("Reporting Guest");
  await siteRow.getByLabel(/^Guest for /).fill("");
  await siteRow.getByLabel(/^Guest for /).blur();
  await expect(siteRow.getByLabel(/^Guest for /)).toHaveValue("Site Guest");
  await expect.poll(() => saved[site.id].bookingGuestName).toBeUndefined();
  await editor.getByRole("button", { name: "Close editor" }).click();
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const reopened = page.getByRole("dialog", { name: "Income full-screen editor" });
  await reopened.getByLabel("Booking source").selectOption("booking_com");
  await expect(reopened.getByLabel(/^Guest for Calendar Guest/)).toHaveValue("Calendar Guest");
  await expect(reopened.getByLabel(/^Email for Calendar Guest/)).toHaveValue("report@example.test");
  await expect(reopened.getByLabel(/^Arrival time for Calendar Guest/)).toHaveValue("15:20");
  await reopened.getByRole("button", { name: "Close editor" }).click();
  await page.getByRole("button", { name: "Edit income details for REAL-1" }).click();
  await expect(page.getByLabel("Guest name override")).toHaveValue("Calendar Guest");
  await page.getByLabel("Phone override").fill("12345");
  await page.getByRole("button", { name: "Save income details" }).click();
  await expect.poll(() => saved[calendar.id].bookingPhone).toBe("12345");
  expect(saved[calendar.id].bookingGuestName).toBe("Calendar Guest");
  expect(saved[calendar.id].bookingEmail).toBe("report@example.test");
});

test("selected bookings open desk procedures and send separate check-in emails", async ({ page }) => {
  const base = {
    roomId, roomName: "Test room", checkIn: `${year}-01-02`, checkOut: `${year}-01-05`,
    status: "confirmed", phone: "", country: "", city: "", identifier: "", guestDetails: "", guestCount: 2,
    nights: 3, amountCents: 10000, currency: "EUR", reason: "", netAmountCents: 9000, unitAmountCents: 3000,
    invoiceRequired: null, invoiceCreated: null, invoiceNumber: "", paymentMethod: "", taxQuarter: "", overrides: {},
  };
  const first = { ...base, id: "507f1f77bcf86cd799439021", reference: "SITE-1", source: "local", guestName: "First Guest", email: "first@example.test" };
  const second = { ...base, id: "507f1f77bcf86cd799439022", reference: "IMPORT-1", source: "booking_com", status: "imported", guestName: "Second Guest", email: "second@example.test" };
  const recorded = { ...base, id: "a".repeat(64), reference: "REC-1", source: "recorded", guestName: "Recorded Guest", email: "" };
  const requests: Record<string, unknown>[] = [];
  let failSecond = true;
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { bookings: [first, second, recorded] } }));
  await page.route("**/api/pnl/check-in-invitations", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const body = route.request().postDataJSON() as Record<string, unknown>;
    requests.push(body);
    if (body.id === second.id && failSecond) return route.fulfill({ status: 400, headers, json: { message: "This booking needs a valid guest email address." } });
    return route.fulfill({ headers, json: { message: "Accepted" } });
  });
  await page.goto(`${uiUrl}/pnl/income`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog", { name: "Income full-screen editor" });
  await expect(editor.getByLabel("Select Recorded Guest (REC-1)")).toBeDisabled();
  await editor.getByLabel("Select bookings on this page").check();
  await expect(editor.getByRole("button", { name: "Check-in actions (2)" })).toBeVisible();
  await editor.getByRole("button", { name: "Check-in actions (2)" }).click();
  const panel = page.getByRole("dialog", { name: "Check-in actions" });
  await expect(panel.getByRole("link", { name: "Open staff check-in procedure" }).first())
    .toHaveAttribute("href", `/hotel/${roomId}/check-in/${first.id}`);
  await panel.getByLabel("Self check-in", { exact: true }).check();
  await panel.getByRole("button", { name: "Send email to 2 guest(s)" }).click();
  await expect(panel.getByRole("alert")).toContainText("Enter an access code");
  expect(requests).toHaveLength(0);
  await panel.getByLabel("Access code for SITE-1").fill("1111");
  await panel.getByLabel("Access code for IMPORT-1").fill("2222");
  await panel.getByLabel("Locker for IMPORT-1").fill("2");
  await panel.getByLabel("Breakfast included").nth(1).uncheck();
  page.once("dialog", (dialog) => dialog.accept());
  await panel.getByRole("button", { name: "Send email to 2 guest(s)" }).click();
  await expect(panel.getByText("Accepted for sending")).toBeVisible();
  await expect(panel.getByRole("alert")).toContainText("valid guest email");
  expect(requests).toEqual([
    { source: "local", id: first.id, expectedEmail: first.email, mode: "self", accessCode: "1111", locker: "", breakfastIncluded: true },
    { source: "booking_com", id: second.id, expectedEmail: second.email, mode: "self", accessCode: "2222", locker: "2", breakfastIncluded: false },
  ]);
  failSecond = false;
  page.once("dialog", (dialog) => dialog.accept());
  await panel.getByRole("button", { name: "Send email to 1 guest(s)" }).click();
  await expect(panel.getByText("Accepted for sending")).toHaveCount(2);
  expect(requests).toHaveLength(3);
  expect(requests[2].id).toBe(second.id);
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await editor.getByLabel("Select First Guest (SITE-1)").check();
  await editor.getByRole("button", { name: "Check-in actions (1)" }).click();
  await panel.getByLabel("Desk check-in", { exact: true }).check();
  page.once("dialog", (dialog) => dialog.accept());
  await panel.getByRole("button", { name: "Send email to 1 guest(s)" }).click();
  await expect(panel.getByText("Accepted for sending")).toBeVisible();
  expect(requests[3]).toEqual({ source: "local", id: first.id, expectedEmail: first.email, mode: "desk" });
});

test("an uncertain email request is not automatically retried", async ({ page }) => {
  const booking = {
    id: "507f1f77bcf86cd799439021", reference: "SITE-1", source: "local", roomId,
    checkIn: `${year}-01-02`, checkOut: `${year}-01-05`, status: "confirmed",
    guestName: "First Guest", email: "first@example.test", phone: "", country: "", city: "", identifier: "",
    guestDetails: "", guestCount: 2, nights: 3, amountCents: 10000, currency: "EUR", reason: "",
    netAmountCents: null, unitAmountCents: null, invoiceRequired: null, invoiceCreated: null,
    invoiceNumber: "", paymentMethod: "", taxQuarter: "", overrides: {},
  };
  let attempts = 0;
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { bookings: [booking] } }));
  await page.route("**/api/pnl/check-in-invitations", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    attempts++;
    await route.abort("connectionreset");
  });
  await page.goto(`${uiUrl}/pnl/income`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog", { name: "Income full-screen editor" });
  await editor.getByLabel("Select First Guest (SITE-1)").check();
  await editor.getByRole("button", { name: "Check-in actions (1)" }).click();
  const panel = page.getByRole("dialog", { name: "Check-in actions" });
  page.once("dialog", (dialog) => dialog.accept());
  await panel.getByRole("button", { name: "Send email to 1 guest(s)" }).click();
  await expect(panel.getByRole("alert")).toContainText("Check sent mail before retrying");
  await page.waitForTimeout(2500);
  expect(attempts).toBe(1);
});

test("check-in markers autosave independently, retry failures, and survive reload", async ({ page }) => {
  const base = {
    roomId, roomName: "Test room", checkIn: `${year}-01-02`, checkOut: `${year}-01-05`,
    status: "confirmed", phone: "", country: "", city: "", identifier: "", guestDetails: "", guestCount: 2,
    nights: 3, amountCents: 10000, currency: "EUR", reason: "", netAmountCents: 9000, unitAmountCents: 3000,
    invoiceRequired: null, invoiceCreated: null, invoiceNumber: "", paymentMethod: "", taxQuarter: "",
  };
  const local = { ...base, id: "507f1f77bcf86cd799439021", reference: "SITE-1", source: "local", guestName: "First Guest", email: "first@example.test" };
  const recorded = { ...base, id: "a".repeat(64), reference: "REC-1", source: "recorded", guestName: "Recorded Guest", email: "" };
  const saved: Record<string, Record<string, unknown>> = { [local.id]: {}, [recorded.id]: { grossAmountCents: 10000 } };
  let fail = false;
  let requests = 0;
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (route.request().method() === "PUT") {
      requests++;
      const id = route.request().url().split("/").pop()!;
      const body = route.request().postDataJSON();
      if (fail) return route.fulfill({ status: 500, headers, json: { message: "Unavailable" } });
      if (requests === 1) await new Promise((resolve) => setTimeout(resolve, 400));
      saved[id] = id === recorded.id ? body.details : body;
      return route.fulfill({ headers, json: { message: "Saved" } });
    }
    return route.fulfill({ headers, json: { bookings: [{ ...local, overrides: saved[local.id] }, { ...recorded, overrides: saved[recorded.id] }] } });
  });
  await page.goto(`${uiUrl}/pnl/income`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog", { name: "Income full-screen editor" });
  const firstHeaders = await editor.getByRole("table", { name: "Booking income grid" }).locator("thead th > button").allTextContents();
  expect(firstHeaders.slice(0, 3)).toEqual(["Check-in desk", "Self check-in", "Notes"]);
  const region = editor.getByRole("region", { name: "Editable grid" });
  const viewport = await region.boundingBox();
  for (const label of ["Check-in desk for First Guest", "Self check-in for First Guest"]) {
    const checkbox = editor.getByLabel(label);
    const box = await checkbox.boundingBox();
    const cell = await checkbox.locator("xpath=ancestor::td").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(viewport!.x);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.x + viewport!.width);
    expect(Math.abs(box!.x + box!.width / 2 - (cell!.x + cell!.width / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(box!.y + box!.height / 2 - (cell!.y + cell!.height / 2))).toBeLessThanOrEqual(1);
  }
  expect(await region.evaluate((element) => element.scrollLeft)).toBe(0);
  await editor.getByLabel("Check-in desk for First Guest").check();
  await editor.getByLabel("Self check-in for First Guest").check();
  await expect.poll(() => saved[local.id]).toMatchObject({ checkInDesk: true, selfCheckIn: true });
  await editor.getByLabel("Self check-in for Recorded Guest").check();
  await expect.poll(() => saved[recorded.id]).toMatchObject({ grossAmountCents: 10000, selfCheckIn: true });
  fail = true;
  await editor.getByLabel("Check-in desk for First Guest").uncheck();
  await expect(editor.getByRole("alert")).toContainText("Save failed");
  expect(saved[local.id].checkInDesk).toBe(true);
  fail = false;
  await editor.getByRole("button", { name: "Save all" }).click();
  await expect.poll(() => saved[local.id].checkInDesk).toBe(false);
  await editor.getByRole("button", { name: "Close editor" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  await expect(editor.getByLabel("Check-in desk for First Guest")).not.toBeChecked();
  await expect(editor.getByLabel("Self check-in for First Guest")).toBeChecked();
  await expect(editor.getByLabel("Self check-in for Recorded Guest")).toBeChecked();
  await editor.getByRole("button", { name: "Show value filters" }).click();
  await editor.getByLabel("Filter Self check-in by value").selectOption(JSON.stringify("Yes"));
  await expect(editor.getByText("2 rows", { exact: true })).toBeVisible();
});

test("income editor controls wrap inside the viewport", async ({ page }) => {
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { bookings: [] } }));
  await page.goto(`${uiUrl}/pnl/income`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog", { name: "Income full-screen editor" });
  const header = editor.locator("header");
  for (const width of [940, 390]) {
    await page.setViewportSize({ width, height: 800 });
    const editorBox = await editor.boundingBox();
    expect(editorBox!.y).toBe(0);
    expect(editorBox!.height).toBe(800);
    expect(await header.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    for (const control of [
      editor.getByRole("button", { name: "Close editor" }),
      editor.getByLabel("Income grid view"),
      editor.getByRole("button", { name: "Configure columns and groups" }),
      editor.getByRole("button", { name: "Show check-in columns first" }),
      editor.getByRole("button", { name: "04 Payment & review" }),
      editor.getByLabel("Filter columns by color"),
    ]) {
      const box = await control.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
  }
});

test("expense grid autosaves, preserves unsaved values on failure, and retries", async ({ page }) => {
  let entry = {
    _id: "507f1f77bcf86cd799439014", type: "expense", date: `${year}-01-02`,
    description: "Cleaning", category: "Housekeeping", roomId, status: "unknown", amountCents: 2000,
    nights: null, guestCount: null, numberOfNights: null, payee: "", reference: "", invoice: "", notes: "",
  };
  let fail = false;
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (route.request().method() === "PUT") {
      if (fail) return route.fulfill({ status: 500, headers, json: { message: "Unavailable" } });
      entry = { ...route.request().postDataJSON(), _id: entry._id };
      return route.fulfill({ headers, json: entry });
    }
    return route.fulfill({ headers, json: { entries: [entry] } });
  });
  await page.goto(`${uiUrl}/pnl/expenses`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog", { name: "Expenses full-screen editor" });
  await expect(editor).toBeVisible();
  const description = editor.getByLabel("Description for Cleaning");
  await description.fill("Updated cleaning");
  await expect(editor.getByLabel("Description for Updated cleaning")).toHaveValue("Updated cleaning");
  await editor.getByLabel("Category for Updated cleaning").focus();
  await expect.poll(() => entry.description).toBe("Updated cleaning");
  expect(entry.status).toBe("unknown");
  expect(entry.nights).toBeNull();
  const handle = editor.getByRole("separator", { name: "Resize Description column" });
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await expect(handle).toHaveAttribute("aria-valuenow", "226");
  const bounds = (await handle.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 30, bounds.y + bounds.height / 2);
  await page.mouse.up();
  await expect(handle).toHaveAttribute("aria-valuenow", "256");

  const amount = editor.getByLabel("Amount (€) for Updated cleaning");
  await amount.fill("0");
  await editor.getByLabel("Category for Updated cleaning").focus();
  await expect(editor.getByRole("alert")).toContainText("Amount must be positive");
  expect(entry.amountCents).toBe(2000);
  fail = true;
  await amount.fill("25.50");
  await editor.getByLabel("Category for Updated cleaning").focus();
  await expect(editor.getByRole("alert")).toContainText("Save failed");
  await expect(amount).toHaveValue("25.50");
  await editor.getByRole("button", { name: "Close editor" }).click();
  await expect(editor).toBeVisible();
  await expect(editor.getByText("You have unsaved changes. Fix errors and save, or discard them before closing.")).toBeVisible();
  fail = false;
  await editor.getByRole("button", { name: "Save all" }).click();
  await expect.poll(() => entry.amountCents).toBe(2550);
  await expect(editor.getByText("All changes saved", { exact: true }).first()).toBeVisible();
  await editor.getByRole("button", { name: "Close editor" }).click();
  await expect(editor).toHaveCount(0);
});

test("rapid edits to one row are serialized without losing changes", async ({ page }) => {
  let entry = {
    _id: "507f1f77bcf86cd799439014", type: "expense", date: `${year}-01-02`,
    description: "Cleaning", category: "Housekeeping", roomId, status: "unknown", amountCents: 2000,
    nights: null, guestCount: null, numberOfNights: null, payee: "", reference: "", invoice: "", notes: "",
  };
  let requests = 0;
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (route.request().method() === "PUT") {
      requests++;
      if (requests === 1) await new Promise((resolve) => setTimeout(resolve, 600));
      entry = { ...route.request().postDataJSON(), _id: entry._id };
      return route.fulfill({ headers, json: entry });
    }
    return route.fulfill({ headers, json: { entries: [entry] } });
  });
  await page.goto(`${uiUrl}/pnl/expenses`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog");
  await editor.getByLabel("Description for Cleaning").fill("Updated");
  await editor.getByLabel("Category for Updated").fill("Supplies");
  await editor.getByLabel("Amount (€) for Updated").focus();
  await expect.poll(() => requests).toBe(2);
  await expect.poll(() => entry.category).toBe("Supplies");
  expect(entry.description).toBe("Updated");
  await expect(editor.getByText("All changes saved", { exact: true }).first()).toBeVisible();
});

test("reverting a cell during an in-flight save still persists the reverted value", async ({ page }) => {
  let entry = {
    _id: "507f1f77bcf86cd799439014", type: "expense", date: `${year}-01-02`,
    description: "Cleaning", category: "Housekeeping", roomId, status: "unknown", amountCents: 2000,
    nights: null, guestCount: null, numberOfNights: null, payee: "", reference: "", invoice: "", notes: "",
  };
  let requests = 0;
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (route.request().method() === "PUT") {
      requests++;
      if (requests === 1) await new Promise((resolve) => setTimeout(resolve, 600));
      entry = { ...route.request().postDataJSON(), _id: entry._id };
      return route.fulfill({ headers, json: entry });
    }
    return route.fulfill({ headers, json: { entries: [entry] } });
  });
  await page.goto(`${uiUrl}/pnl/expenses`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog");
  const amount = editor.getByLabel("Amount (€) for Cleaning");
  await amount.fill("30.00");
  await editor.getByLabel("Category for Cleaning").focus();
  await amount.fill("20.00");
  await editor.getByLabel("Category for Cleaning").focus();
  await expect.poll(() => requests).toBe(2);
  await expect.poll(() => entry.amountCents).toBe(2000);
  await expect(editor.getByText("All changes saved", { exact: true }).first()).toBeVisible();
});

test("income grid edits independent records, calculates unit price, and protects booking dates", async ({ page }) => {
  const id = "a".repeat(64);
  let saved: Record<string, unknown> | undefined;
  const details = { grossAmountCents: 10000, netAmountCents: 9000, invoiceNumber: "INV-1" };
  const record = {
    id, reference: "REC-1", source: "recorded", roomId, roomName: "Test room", checkIn: `${year}-01-02`, checkOut: `${year}-01-05`,
    status: "recorded", guestName: "Independent Guest", phone: "", email: "", country: "", city: "", identifier: "",
    guestDetails: "", guestCount: 2, nights: 3, amountCents: 10000, currency: "EUR", reason: "",
    netAmountCents: 9000, unitAmountCents: 3000, invoiceRequired: null, invoiceCreated: null, invoiceNumber: "INV-1",
    paymentMethod: "", taxQuarter: "", overrides: details,
  };
  const linked = { ...record, id: "local1", reference: "LOCAL-1", guestName: "Booking Guest", source: "local", overrides: {} };
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (route.request().method() === "PUT") {
      saved = route.request().postDataJSON();
      return route.fulfill({ headers, json: { message: "Saved" } });
    }
    return route.fulfill({ headers, json: { bookings: [record, linked] } });
  });
  await page.goto(`${uiUrl}/pnl/income`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog");
  await expect(editor.getByLabel("Guest for Booking Guest")).toHaveCount(1);
  await expect(editor.getByLabel("Check-out for Booking Guest")).toHaveCount(0);
  await editor.getByLabel("Notes for Independent Guest").fill("Call guest");
  await editor.getByLabel("Room for Independent Guest").focus();
  await expect.poll(() => (saved?.details as Record<string, unknown>)?.notes).toBe("Call guest");
  await editor.getByLabel("Notes for Booking Guest").fill("Booking note");
  await editor.getByLabel("Country for Booking Guest").focus();
  await expect.poll(() => (saved as Record<string, unknown>)?.notes).toBe("Booking note");
  await editor.getByLabel("Check-out for Independent Guest").fill(`${year}-01-06`);
  await editor.getByLabel("Pax for Independent Guest").focus();
  await expect.poll(() => saved?.nights).toBe(4);
  expect((saved?.details as typeof details).invoiceNumber).toBe("INV-1");
  const row = editor.getByLabel("Guest for Independent Guest").locator("xpath=ancestor::tr");
  await expect(row).toContainText("22.50");
  await editor.getByLabel("Invoice required for Independent Guest").focus();
  await editor.getByLabel("Invoice required for Independent Guest").selectOption("yes");
  await editor.getByLabel("Invoice status for Independent Guest").focus();
  await expect.poll(() => (saved?.details as Record<string, unknown>)?.invoiceRequired).toBe(true);
  await editor.getByLabel("Invoice status for Independent Guest").selectOption("yes");
  await editor.getByLabel("Tax quarter for Independent Guest").focus();
  await expect.poll(() => (saved?.details as Record<string, unknown>)?.invoiceCreated).toBe(true);
  await editor.getByLabel("Country for Booking Guest").fill("France");
  await editor.getByLabel("Guest ID for Booking Guest").focus();
  await expect.poll(() => (saved as Record<string, unknown>)?.country).toBe("France");
  await editor.getByRole("button", { name: "Additional income" }).click();
  await expect(editor.getByText("No rows on this sheet match your search.")).toBeVisible();
});

test("income notes retain failed edits, retry, and reload", async ({ page }) => {
  let note = "";
  let fail = true;
  const record = {
    id: "a".repeat(64), reference: "REC-1", source: "recorded", roomId, roomName: "Test room",
    checkIn: `${year}-01-02`, checkOut: `${year}-01-05`, status: "recorded", guestName: "Note guest",
    phone: "", email: "", country: "", city: "", identifier: "", guestDetails: "", guestCount: 2, nights: 3,
    amountCents: 10000, currency: "EUR", reason: "", netAmountCents: null, unitAmountCents: null,
    invoiceRequired: null, invoiceCreated: null, invoiceNumber: "", paymentMethod: "", taxQuarter: "",
  };
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (route.request().method() === "PUT") {
      if (fail) return route.fulfill({ status: 500, headers, json: { message: "Unavailable" } });
      note = route.request().postDataJSON().details.notes || "";
      return route.fulfill({ headers, json: { message: "Saved" } });
    }
    return route.fulfill({ headers, json: { bookings: [{ ...record, notes: note, overrides: { grossAmountCents: 10000, notes: note } }] } });
  });
  await page.goto(`${uiUrl}/pnl/income`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog");
  await editor.getByLabel("Notes for Note guest").fill("Remember late arrival");
  await editor.getByLabel("Room for Note guest").focus();
  await expect(editor.getByRole("alert")).toContainText("Save failed");
  await expect(editor.getByLabel("Notes for Note guest")).toHaveValue("Remember late arrival");
  fail = false;
  await editor.getByRole("button", { name: "Save all" }).click();
  await expect.poll(() => note).toBe("Remember late arrival");
  await editor.getByRole("button", { name: "Close editor" }).click();
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  await expect(page.getByRole("dialog").getByLabel("Notes for Note guest")).toHaveValue("Remember late arrival");
});

test("recorded checkout calculates nights and preserves details across saves and reload", async ({ page }) => {
  let identity = { date: `${year}-01-02`, nights: null as number | null };
  let details: Record<string, unknown> = { grossAmountCents: 10000 };
  let writes = 0;
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (route.request().method() === "PUT") {
      writes++;
      const body = route.request().postDataJSON();
      identity = { date: body.date, nights: body.nights };
      details = body.details;
      return route.fulfill({ headers, json: { message: "Saved" } });
    }
    const checkOut = identity.nights === null ? "" : new Date(Date.parse(`${identity.date}T00:00:00Z`) + identity.nights * 86400000).toISOString().slice(0, 10);
    return route.fulfill({ headers, json: { bookings: [{
      id: "a".repeat(64), reference: "REC-1", source: "recorded", roomId, roomName: "Test room",
      checkIn: identity.date, checkOut, status: "recorded", guestName: "Date guest",
      phone: "", email: "", country: "", city: "", identifier: "", guestDetails: "", guestCount: details.guestCount ?? null,
      nights: identity.nights, amountCents: 10000, currency: "EUR", reason: "", netAmountCents: null, unitAmountCents: null,
      invoiceRequired: null, invoiceCreated: null, invoiceNumber: "", paymentMethod: "", taxQuarter: "",
      invoiceDate: details.invoiceDate || "", touristTaxCents: details.touristTaxCents ?? null, paymentStatus: details.paymentStatus || "unknown",
      arrivalTime: details.arrivalTime || "",
      overrides: details,
    }] } });
  });
  await page.goto(`${uiUrl}/pnl/income`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog", { name: "Income full-screen editor" });
  const row = editor.getByLabel("Guest for Date guest").locator("xpath=ancestor::tr");
  await expect(editor.getByRole("button", { name: "Check-in", exact: true }).locator("..")).toContainText("01 Stay");
  await expect(editor.getByRole("button", { name: "Arrival time", exact: true }).locator("..")).toContainText("01 Stay");
  await editor.getByLabel("Arrival time for Date guest").fill("14:45");
  await editor.getByLabel("Arrival time for Date guest").blur();
  await expect.poll(() => details.arrivalTime).toBe("14:45");
  await expect(editor.getByRole("columnheader").filter({ hasText: "Country" })).toContainText("02 Registration");
  await expect(editor.getByRole("columnheader").filter({ hasText: "Invoice date" })).toContainText("03 Invoicing");
  await expect(editor.getByRole("columnheader").filter({ hasText: "Payment status" })).toContainText("04 Payment & review");
  const checkout = editor.getByLabel("Check-out for Date guest");
  await expect(checkout).toHaveValue("");
  await checkout.fill(`${year}-01-01`);
  await editor.getByLabel("Pax for Date guest").focus();
  await expect(row.getByRole("alert")).toContainText("Check-out must be after check-in");
  expect(writes).toBe(1);
  await checkout.fill(`${year}-01-05`);
  await editor.getByLabel("Pax for Date guest").focus();
  await expect.poll(() => identity.nights).toBe(3);
  await editor.getByLabel("Pax for Date guest").fill("4");
  await editor.getByLabel("Invoice date for Date guest").focus();
  await expect.poll(() => details.guestCount).toBe(4);
  await editor.getByLabel("Invoice date for Date guest").fill(`${year}-01-07`);
  await editor.getByLabel("Tourist tax (€) for Date guest", { exact: true }).focus();
  await expect.poll(() => details.invoiceDate).toBe(`${year}-01-07`);
  await editor.getByLabel("Tourist tax (€) for Date guest", { exact: true }).fill("12.50");
  await editor.getByLabel("Payment status for Date guest").focus();
  await expect.poll(() => details.touristTaxCents).toBe(1250);
  await editor.getByLabel("Payment status for Date guest").selectOption("paid");
  await editor.getByLabel("Notes for Date guest").focus();
  await expect.poll(() => details.paymentStatus).toBe("paid");
  await editor.getByRole("button", { name: "Close editor" }).click();
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  await expect(editor.getByLabel("Check-out for Date guest")).toHaveValue(`${year}-01-05`);
  await expect(editor.getByLabel("Arrival time for Date guest")).toHaveValue("14:45");
  await expect(editor.getByLabel("Pax for Date guest")).toHaveValue("4");
  await expect(editor.getByLabel("Invoice date for Date guest")).toHaveValue(`${year}-01-07`);
  await expect(editor.getByLabel("Tourist tax (€) for Date guest", { exact: true })).toHaveValue("12.50");
  await expect(editor.getByLabel("Payment status for Date guest")).toHaveValue("paid");
  await editor.getByLabel("Check-out for Date guest").fill("");
  await editor.getByLabel("Pax for Date guest").focus();
  await expect.poll(() => identity.nights).toBeNull();
  expect(details.invoiceDate).toBe(`${year}-01-07`);
});

test("legacy group visibility is preserved when loading and saving a view", async ({ page }) => {
  let saved: Record<string, unknown> | undefined;
  const view = { id: "legacy", name: "Legacy", columns: ["roomId", "date", "checkOut", "guestName", "country", "invoiceNumber"], hiddenGroups: ["guest", "invoices"], hiddenColumns: ["roomId"], frozenColumns: 1, widths: {} };
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { bookings: [] } }));
  await page.route(/\/api\/pnl\/views(?:\/|$)/, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (route.request().method() === "GET") return route.fulfill({ headers, json: { views: [view] } });
    saved = route.request().postDataJSON();
    return route.fulfill({ headers, json: { ...saved, id: "legacy" } });
  });
  await page.goto(`${uiUrl}/pnl/income`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog", { name: "Income full-screen editor" });
  await editor.getByLabel("Income grid view").selectOption("legacy");
  await expect(editor.getByRole("button", { name: "Country", exact: true })).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "Invoice number", exact: true })).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "Room", exact: true })).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "Check-in", exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Configure columns and groups" }).click();
  const panel = page.getByRole("dialog", { name: "Configure income view" });
  await expect(panel.getByLabel("02 Registration", { exact: true })).toBeChecked();
  await expect(panel.getByLabel("Show Country column")).not.toBeChecked();
  await panel.getByRole("button", { name: "Save view", exact: true }).click();
  await expect.poll(() => saved).toBeDefined();
  expect(saved?.hiddenGroups).toEqual([]);
  expect(saved?.hiddenColumns).toEqual(expect.arrayContaining(["roomId", "country", "invoiceNumber", "invoiceCreated"]));
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await editor.getByLabel("Income grid view").selectOption("");
  await editor.getByLabel("Income grid view").selectOption("legacy");
  await expect(editor.getByRole("button", { name: "Country", exact: true })).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "Invoice number", exact: true })).toHaveCount(0);
});

test("grid sorts and searches numeric values across pages", async ({ page }) => {
  const entries = Array.from({ length: 51 }, (_, index) => ({
    _id: String(index), type: "expense", date: `${year}-01-02`, description: `Cost ${index}`,
    category: "Other", roomId: null, status: "unknown", amountCents: index === 0 ? 2002 : index === 1 ? 2010 : 10000 + index,
  }));
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { entries } }));
  await page.goto(`${uiUrl}/pnl/expenses`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog");
  await expect(editor.getByText("Page 1 of 2")).toBeVisible();
  await editor.getByRole("button", { name: "Next", exact: true }).click();
  await expect(editor.getByLabel("Description for Cost 50")).toBeVisible();
  await editor.getByRole("button", { name: "Amount (€)", exact: true }).click();
  await expect(editor.getByRole("row").nth(1).getByLabel("Description for Cost 0")).toBeVisible();
  await expect(editor.getByRole("row").nth(2).getByLabel("Description for Cost 1")).toBeVisible();
  await editor.getByLabel("Description for Cost 0").focus();
  await page.keyboard.press("Enter");
  await expect(editor.getByLabel("Description for Cost 1", { exact: true })).toBeFocused();
  await editor.getByLabel("Search").fill("Cost 50");
  await expect(editor.getByText("1 rows", { exact: true })).toBeVisible();
  await expect(editor.getByLabel("Description for Cost 50")).toBeVisible();
});

test("income starts with check-in markers and proposes site and booking.com matches without linking", async ({ page }) => {
  const record = {
    id: "a".repeat(64), source: "recorded", reference: "", roomId, roomName: "Test room",
    checkIn: `${year}-01-02`, checkOut: `${year}-01-05`, nights: 3, status: "recorded", guestName: "Recorded guest",
    email: "", phone: "", country: "", city: "", identifier: "", guestDetails: "", guestCount: null,
    amountCents: 10000, netAmountCents: 9000, unitAmountCents: 3000, currency: "EUR", reason: "",
    invoiceRequired: null, invoiceCreated: null, invoiceNumber: "", paymentMethod: "", taxQuarter: "",
    overrides: { grossAmountCents: 10000, netAmountCents: 9000 },
  };
  const site = { ...record, id: "site1", source: "local", reference: "PP/123", guestName: "Site guest", status: "confirmed", overrides: {} };
  const external = { ...record, id: "external1", source: "booking_com", reference: "B-123", guestName: "Other guest", checkOut: `${year}-01-06`, status: "imported", overrides: {} };
  const unrelated = { ...site, id: "site2", reference: "PP/OTHER", checkIn: `${year}-02-01` };
  const referenceOnly = { ...record, id: "b".repeat(64), reference: "pp/other", roomId: "", checkOut: "", nights: null, guestName: "Reference guest" };
  let writes = 0;
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (route.request().method() === "PUT") { writes++; return route.fulfill({ headers, json: { message: "Saved" } }); }
    return route.fulfill({ headers, json: { bookings: [record, referenceOnly, site, external, unrelated] } });
  });
  await page.goto(`${uiUrl}/pnl/income`);
  const table = page.getByRole("table", { name: "Booking income" });
  await expect(table.getByRole("columnheader").allTextContents()).resolves.toEqual(expect.arrayContaining(["Room", "Check-in", "Check-out", "Guest"]));
  expect((await table.getByRole("columnheader").allTextContents()).slice(0, 4)).toEqual(["Room", "Check-in", "Check-out", "Guest"]);
  const recordedRow = table.getByRole("row").filter({ hasText: "Recorded guest" });
  await expect(recordedRow.getByRole("link", { name: "PP/123 (Site)" })).toHaveAttribute("href", "/booking/site1");
  await expect(recordedRow.getByRole("link", { name: "B-123 (Booking.com)" })).toBeVisible();
  await expect(recordedRow).toContainText("Check-out differs");
  await expect(recordedRow).not.toContainText("PP/OTHER");
  const referenceRow = table.getByRole("row").filter({ hasText: "Reference guest" });
  await expect(referenceRow.getByRole("link", { name: "PP/OTHER (Site)" })).toBeVisible();
  await expect(referenceRow).toContainText("Reference matches");
  await expect(referenceRow).toContainText("Check-out missing");
  await expect(referenceRow).not.toContainText("B-123");
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog");
  expect((await editor.locator("thead th > button").allTextContents()).slice(0, 8)).toEqual(["Check-in desk", "Self check-in", "Notes", "Room", "Check-in", "Arrival time", "Check-out", "Guest"]);
  const gridRow = editor.getByLabel("Guest for Recorded guest").locator("xpath=ancestor::tr");
  const region = editor.getByRole("region", { name: "Editable grid" });
  const grid = editor.getByRole("table", { name: "Booking income grid" });
  const checkPinnedColumns = async (offsets: number[]) => {
    const positions = await grid.evaluate((table) => {
      const region = table.parentElement!;
      return {
        left: region.getBoundingClientRect().left,
        headers: Array.from(table.querySelectorAll("thead th")).slice(0, 6).map((cell) => cell.getBoundingClientRect().left),
        cells: Array.from(table.querySelectorAll("tbody tr:first-child td")).slice(0, 6).map((cell) => cell.getBoundingClientRect().left),
        scrollLeft: region.scrollLeft,
      };
    });
    expect(positions.scrollLeft).toBeGreaterThan(500);
    for (let index = 0; index < offsets.length; index++) {
      expect(positions.headers[index] - positions.left).toBeCloseTo(offsets[index], 0);
      expect(positions.cells[index] - positions.left).toBeCloseTo(offsets[index], 0);
    }
  };
  await region.evaluate((element) => { element.scrollLeft = 1000; });
  await checkPinnedColumns([0, 48, 168, 288, 508, 688]);
  await editor.getByRole("separator", { name: "Resize Room column" }).focus();
  await page.keyboard.press("ArrowRight");
  await region.evaluate((element) => { element.scrollLeft = 1000; });
  await checkPinnedColumns([0, 48, 168, 288, 508, 704]);
  await editor.getByRole("separator", { name: "Resize Check-in column" }).focus();
  await page.keyboard.press("ArrowRight");
  await region.evaluate((element) => { element.scrollLeft = 1000; });
  await checkPinnedColumns([0, 48, 168, 288, 508, 704]);
  await expect(gridRow).toContainText("Check-out matches");
  await expect(gridRow).toContainText("Check-out differs");
  await editor.getByLabel("Check-out for Recorded guest").fill(`${year}-01-06`);
  await expect(gridRow.getByText("Check-out matches")).toHaveCount(1);
  await expect(gridRow.getByText("Check-out differs")).toHaveCount(1);
  expect(writes).toBe(0);
});

test("income views save and restore column order, groups, widths and freeze settings", async ({ page }) => {
  type View = { id: string; name: string; columns: string[]; hiddenGroups: string[]; hiddenColumns: string[]; frozenColumns: number; widths: Record<string, number> };
  let views: View[] = [];
  let failSave = false;
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { bookings: [] } }));
  await page.route(/\/api\/pnl\/views(?:\/|$)/, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (request.method() === "GET") return route.fulfill({ headers, json: { views } });
    if (request.method() === "POST") {
      if (failSave) return route.fulfill({ status: 500, headers, json: { message: "Unavailable" } });
      const saved = { ...request.postDataJSON(), id: String(views.length + 1) } as View;
      views.push(saved);
      return route.fulfill({ status: 201, headers, json: saved });
    }
    if (request.method() === "PUT") {
      const id = request.url().split("/").pop()!;
      const saved = { ...request.postDataJSON(), id } as View;
      views = views.map((view) => view.id === id ? saved : view);
      return route.fulfill({ headers, json: saved });
    }
    if (request.method() === "DELETE") {
      const id = request.url().split("/").pop()!;
      views = views.filter((view) => view.id !== id);
      return route.fulfill({ status: 204, headers });
    }
    return route.fulfill({ status: 500, headers });
  });
  await page.goto(`${uiUrl}/pnl/income`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog", { name: "Income full-screen editor" });
  const table = editor.getByRole("table", { name: "Booking income grid" });
  await editor.getByRole("region", { name: "Editable grid" }).evaluate((element) => { element.scrollLeft = 300; });
  await editor.getByLabel("Drag Guest column").dragTo(editor.getByRole("button", { name: "Reference", exact: true }));
  expect((await table.locator("thead th > button").allTextContents()).slice(0, 9)).toEqual(["Check-in desk", "Self check-in", "Notes", "Room", "Check-in", "Arrival time", "Check-out", "Reference", "Guest"]);
  await editor.getByRole("separator", { name: "Resize Room column" }).focus();
  await page.keyboard.press("ArrowRight");
  await editor.getByRole("button", { name: "Configure columns and groups" }).click();
  const panel = page.getByRole("dialog", { name: "Configure income view" });
  await panel.getByLabel("Freeze first visible columns").selectOption("2");
  await panel.getByLabel("02 Registration", { exact: true }).uncheck();
  await panel.getByLabel("Show Invoice number column").uncheck();
  await panel.getByLabel("View name").fill("Invoice review");
  failSave = true;
  await panel.getByRole("button", { name: "Save as new view" }).click();
  await expect(panel.getByRole("alert")).toContainText("Could not save this view");
  expect(views).toHaveLength(0);
  failSave = false;
  await panel.getByRole("button", { name: "Save as new view" }).click();
  await expect.poll(() => views.length).toBe(1);
  expect(views[0].columns.slice(0, 9)).toEqual(["checkInDesk", "selfCheckIn", "notes", "roomId", "date", "arrivalTime", "checkOut", "reference", "guestName"]);
  expect(views[0].hiddenGroups).toEqual(["registrationV2"]);
  expect(views[0].hiddenColumns).toEqual(["invoiceNumber"]);
  expect(views[0].frozenColumns).toBe(2);
  expect(views[0].widths.roomId).toBe(196);
  await panel.getByLabel("View name").fill("Second view");
  await panel.getByLabel("Freeze first visible columns").selectOption("1");
  await panel.getByRole("button", { name: "Save as new view" }).click();
  await expect.poll(() => views.length).toBe(2);
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await editor.getByLabel("Income grid view").selectOption("1");
  await expect(editor.getByRole("separator", { name: "Resize Room column" })).toHaveAttribute("aria-valuenow", "196");
  await editor.getByRole("button", { name: "Configure columns and groups" }).click();
  await expect(panel.getByLabel("Freeze first visible columns")).toHaveValue("2");
  await expect(panel.getByLabel("02 Registration", { exact: true })).not.toBeChecked();
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await editor.getByLabel("Income grid view").selectOption("");
  expect((await table.locator("thead th > button").allTextContents()).slice(0, 8)).toEqual(["Check-in desk", "Self check-in", "Notes", "Room", "Check-in", "Arrival time", "Check-out", "Guest"]);
  await expect(editor.getByRole("button", { name: "Invoice number", exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Close editor" }).click();
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const reopened = page.getByRole("dialog", { name: "Income full-screen editor" });
  await reopened.getByLabel("Income grid view").selectOption("1");
  await expect(reopened.getByRole("separator", { name: "Resize Room column" })).toHaveAttribute("aria-valuenow", "196");
  expect((await reopened.getByRole("separator", { name: "Resize Room column" }).locator("..").boundingBox())!.width).toBeCloseTo(196, 0);
  await expect(reopened.getByRole("button", { name: "Invoice number", exact: true })).toHaveCount(0);
  await expect(reopened.getByRole("button", { name: "Email", exact: true })).toHaveCount(0);
  expect((await reopened.getByRole("table", { name: "Booking income grid" }).locator("thead th > button").allTextContents()).slice(0, 7))
    .toEqual(["Notes", "Room", "Check-in", "Arrival time", "Check-out", "Reference", "Guest"]);
  const positions = await reopened.getByRole("table", { name: "Booking income grid" }).locator("thead th").evaluateAll(
    (cells) => cells.slice(1, 4).map((cell) => getComputedStyle(cell).position)
  );
  expect(positions).toEqual(["sticky", "sticky", "relative"]);
  await reopened.getByRole("button", { name: "Configure columns and groups" }).click();
  await expect(panel.getByLabel("Freeze first visible columns")).toHaveValue("2");
  await expect(panel.getByLabel("02 Registration", { exact: true })).not.toBeChecked();
  await expect(panel.getByLabel("Show Invoice number column")).not.toBeChecked();
  await panel.getByLabel("Show Invoice number column").check();
  await panel.getByLabel("Show Invoice number column").uncheck();
  await panel.getByLabel("Freeze first visible columns").selectOption("3");
  await panel.getByRole("button", { name: "Save view", exact: true }).click();
  await expect.poll(() => views.find((view) => view.id === "1")?.frozenColumns).toBe(3);
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await reopened.getByRole("separator", { name: "Resize Room column" }).focus();
  await page.keyboard.press("ArrowRight");
  await reopened.getByRole("button", { name: "Configure columns and groups" }).click();
  await panel.getByRole("button", { name: "Save view", exact: true }).click();
  await expect.poll(() => views.find((view) => view.id === "1")?.widths.roomId).toBe(212);
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await reopened.getByRole("button", { name: "Close editor" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  await reopened.getByLabel("Income grid view").selectOption("1");
  await expect(reopened.getByRole("separator", { name: "Resize Room column" })).toHaveAttribute("aria-valuenow", "212");
  expect((await reopened.getByRole("separator", { name: "Resize Room column" }).locator("..").boundingBox())!.width).toBeCloseTo(212, 0);
  await reopened.getByRole("button", { name: "Configure columns and groups" }).click();
  await panel.getByRole("button", { name: "Move Guest left" }).click();
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await expect(reopened.getByText("Unsaved view changes")).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await reopened.getByLabel("Income grid view").selectOption("2");
  await expect(reopened.getByLabel("Income grid view")).toHaveValue("1");
  page.once("dialog", (dialog) => dialog.accept());
  await reopened.getByLabel("Income grid view").selectOption("2");
  await reopened.getByRole("button", { name: "Configure columns and groups" }).click();
  await expect(panel.getByLabel("Freeze first visible columns")).toHaveValue("1");
  page.once("dialog", (dialog) => dialog.accept());
  await panel.getByRole("button", { name: "Delete view" }).click();
  await expect.poll(() => views.length).toBe(1);
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await expect(reopened.getByLabel("Income grid view")).toHaveValue("");
});

test("the default view can be overridden and restored alongside named views", async ({ page }) => {
  const named = { id: "named", name: "Named view", columns: ["roomId", "guestName"], hiddenGroups: [], hiddenColumns: [], frozenColumns: 1, widths: {} };
  let defaultView: Record<string, unknown> | null = null;
  let fail = true;
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { bookings: [] } }));
  await page.route(/\/api\/pnl\/views(?:\/|$)/, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (route.request().method() === "GET") return route.fulfill({ headers, json: { views: [named], defaultView } });
    if (fail) return route.fulfill({ status: 500, headers, json: { message: "Unavailable" } });
    defaultView = route.request().postDataJSON();
    return route.fulfill({ headers, json: { defaultView } });
  });
  await page.goto(`${uiUrl}/pnl/income`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog", { name: "Income full-screen editor" });
  const dateHandle = editor.getByRole("separator", { name: "Resize Check-in column" });
  const bounds = (await dateHandle.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 48, bounds.y + bounds.height / 2);
  await page.mouse.up();
  await expect(dateHandle).toHaveAttribute("aria-valuenow", "193");
  await editor.getByRole("button", { name: "03 Invoicing", exact: true }).click();
  await editor.getByRole("button", { name: "02 Registration", exact: true }).click();
  await editor.getByRole("button", { name: "02 Registration", exact: true }).click();
  await expect(editor.getByRole("button", { name: "Country", exact: true })).toBeVisible();
  await expect(editor.getByRole("button", { name: "Invoice date", exact: true })).toHaveCount(0);
  await editor.getByRole("button", { name: "Configure columns and groups" }).click();
  const panel = page.getByRole("dialog", { name: "Configure income view" });
  await panel.getByLabel("Freeze first visible columns").selectOption("3");
  await panel.getByLabel("Show Room column").uncheck();
  await panel.getByLabel("Pick color for 01 Stay").fill("#ff0000");
  await panel.getByRole("button", { name: "Save as default" }).click();
  await expect(panel.getByRole("alert")).toContainText("Could not save the default view");
  expect(defaultView).toBeNull();
  fail = false;
  await panel.getByRole("button", { name: "Save as default" }).click();
  await expect.poll(() => defaultView).not.toBeNull();
  expect(defaultView?.widths).toEqual({ date: 193 });
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await expect(editor.getByText("View unchanged")).toBeVisible();
  await editor.getByRole("button", { name: "Close editor" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  await expect(editor.getByRole("separator", { name: "Resize Check-in column" })).toHaveAttribute("aria-valuenow", "193");
  expect((await editor.getByRole("separator", { name: "Resize Check-in column" }).locator("..").boundingBox())!.width).toBeCloseTo(193, 0);
  await expect(editor.getByRole("button", { name: "03 Invoicing", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(editor.getByRole("button", { name: "Room", exact: true })).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "Guest", exact: true }).locator("..")).toHaveCSS("background-color", "rgb(255, 179, 179)");
  await editor.getByLabel("Income grid view").selectOption("named");
  await expect(editor.getByRole("button", { name: "Room", exact: true })).toBeVisible();
  await expect(editor.getByRole("separator", { name: "Resize Check-in column" })).toHaveAttribute("aria-valuenow", "145");
  await editor.getByLabel("Income grid view").selectOption("");
  await expect(editor.getByRole("button", { name: "Room", exact: true })).toHaveCount(0);
  await expect(editor.getByRole("separator", { name: "Resize Check-in column" })).toHaveAttribute("aria-valuenow", "193");
  await editor.getByRole("button", { name: "Configure columns and groups" }).click();
  await expect(panel.getByLabel("Freeze first visible columns")).toHaveValue("3");
  await expect(panel.getByLabel("Show Room column")).not.toBeChecked();
});

test("loading a default view does not overwrite group changes made while loading", async ({ page }) => {
  let release = () => {};
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const defaultView = { name: "Default", columns: ["guestName", "country"], hiddenGroups: ["stayV2"], hiddenColumns: [], frozenColumns: 1, widths: {}, colorTags: [], columnColors: {}, colorFilter: "", columnFilters: {} };
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { bookings: [] } }));
  await page.route(/\/api\/pnl\/views(?:\/|$)/, async (route) => {
    await waiting;
    return route.fulfill({ headers, json: { views: [], defaultView } });
  });
  await page.goto(`${uiUrl}/pnl/income`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog", { name: "Income full-screen editor" });
  await expect(editor.getByLabel("Income grid view")).toBeDisabled();
  await editor.getByRole("button", { name: "02 Registration", exact: true }).click();
  release();
  await expect(editor.getByLabel("Income grid view")).toBeEnabled();
  await expect(editor.getByRole("button", { name: "Guest", exact: true })).toBeVisible();
  await expect(editor.getByRole("button", { name: "Country", exact: true })).toHaveCount(0);
  await expect(editor.getByText("Unsaved view changes")).toBeVisible();
});

test("saving the default retains changes made while the save is pending", async ({ page }) => {
  let release = () => {};
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  let submitted = false;
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { bookings: [] } }));
  await page.route(/\/api\/pnl\/views(?:\/|$)/, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (route.request().method() === "GET") return route.fulfill({ headers, json: { views: [], defaultView: null } });
    const defaultView = route.request().postDataJSON();
    submitted = true;
    await waiting;
    return route.fulfill({ headers, json: { defaultView } });
  });
  await page.goto(`${uiUrl}/pnl/income`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog", { name: "Income full-screen editor" });
  await editor.getByRole("button", { name: "Configure columns and groups" }).click();
  const panel = page.getByRole("dialog", { name: "Configure income view" });
  await panel.getByRole("button", { name: "Save as default" }).click();
  await expect.poll(() => submitted).toBe(true);
  await panel.getByLabel("02 Registration", { exact: true }).uncheck();
  release();
  await expect(panel.getByRole("button", { name: "Save as default" })).toBeEnabled();
  await expect(panel.getByLabel("02 Registration", { exact: true })).not.toBeChecked();
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await expect(editor.getByText("Unsaved view changes")).toBeVisible();
  await expect(editor.getByRole("button", { name: "Country", exact: true })).toHaveCount(0);
});

test("group pickers and quick buttons work together and persist", async ({ page }) => {
  let views: Array<Record<string, unknown>> = [];
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { bookings: [] } }));
  await page.route(/\/api\/pnl\/views(?:\/|$)/, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (route.request().method() === "GET") return route.fulfill({ headers, json: { views } });
    const saved = { ...route.request().postDataJSON(), id: "picker-view" };
    views = [saved];
    return route.fulfill({ status: 200, headers, json: saved });
  });
  await page.goto(`${uiUrl}/pnl/income`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog", { name: "Income full-screen editor" });
  for (const [group, hidden] of [
    ["02 Registration", "Country"],
    ["03 Invoicing", "Invoice date"],
    ["04 Payment & review", "Notes"],
  ]) {
    await editor.getByRole("button", { name: group, exact: true }).click();
    await expect(editor.getByRole("button", { name: group, exact: true })).toHaveAttribute("aria-pressed", "false");
    await expect(editor.getByRole("button", { name: hidden, exact: true })).toHaveCount(0);
    await expect(editor.getByRole("button", { name: "Guest", exact: true })).toBeVisible();
  }
  await editor.getByRole("button", { name: "02 Registration", exact: true }).click();
  await expect(editor.getByRole("button", { name: "Country", exact: true })).toBeVisible();
  await expect(editor.getByRole("button", { name: "Guest", exact: true })).toBeVisible();
  await expect(editor.getByRole("button", { name: "Invoice date", exact: true })).toHaveCount(0);
  await editor.getByRole("button", { name: "All groups", exact: true }).click();
  await editor.getByRole("button", { name: "Configure columns and groups" }).click();
  const panel = page.getByRole("dialog", { name: "Configure income view" });
  const picker = panel.getByLabel("Pick color for 01 Stay");
  await expect(picker).toHaveValue("#808080");
  await panel.getByRole("button", { name: "Apply picker color to 01 Stay" }).click();
  await expect(panel.getByLabel("Color name 1")).toHaveValue("01 Stay");
  await picker.fill("#ff0000");
  await picker.fill("#00ff00");
  await picker.fill("#ff0000");
  await expect(panel.getByLabel("Color name 2")).toHaveCount(0);
  await panel.getByLabel("Color name 1").fill("My stay");
  await panel.getByLabel("Apply color to 02 Registration").selectOption({ label: "My stay" });
  await picker.fill("#0000ff");
  await expect(panel.getByLabel("Pick color for 02 Registration")).toHaveValue("#ff0000");
  await expect(panel.getByLabel("Color name 2")).toHaveValue("01 Stay");
  await panel.getByLabel("View name").fill("Picker view");
  await panel.getByRole("button", { name: "Save as new view" }).click();
  await expect.poll(() => views.length).toBe(1);
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await expect(editor.getByRole("button", { name: "Guest", exact: true }).locator("..")).toHaveCSS("background-color", "rgb(179, 179, 255)");
  await expect(editor.getByRole("button", { name: "Country", exact: true }).locator("..")).toHaveCSS("background-color", "rgb(255, 179, 179)");
  await editor.getByRole("button", { name: "Close editor" }).click();
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  await editor.getByLabel("Income grid view").selectOption("picker-view");
  await editor.getByRole("button", { name: "Configure columns and groups" }).click();
  await expect(picker).toHaveValue("#0000ff");
  await picker.fill("#123456");
  await expect(panel.getByLabel("Color name 3")).toHaveCount(0);
  await expect(panel.getByLabel("Pick color for 02 Registration")).toHaveValue("#ff0000");
  await panel.getByRole("button", { name: "Save view", exact: true }).click();
  await expect.poll(() => (views[0].colorTags as Array<{ color: string }>).map((tag) => tag.color)).toEqual(["#ff0000", "#123456"]);
});

test("group picker reports the color limit and can reuse an existing color", async ({ page }) => {
  const colorTags = Array.from({ length: 20 }, (_, index) => ({
    id: `color-${index}`, name: `Color ${index + 1}`, color: `#${(index + 1).toString(16).padStart(6, "0")}`,
  }));
  const view = { id: "full", name: "Full palette", columns: ["roomId"], hiddenGroups: [], frozenColumns: 1, widths: {}, colorTags, columnColors: {}, colorFilter: "", columnFilters: {} };
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { bookings: [] } }));
  await page.route(/\/api\/pnl\/views(?:\/|$)/, (route) => route.fulfill({ headers, json: { views: [view] } }));
  await page.goto(`${uiUrl}/pnl/income`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog", { name: "Income full-screen editor" });
  await editor.getByLabel("Income grid view").selectOption("full");
  await editor.getByRole("button", { name: "Configure columns and groups" }).click();
  const panel = page.getByRole("dialog", { name: "Configure income view" });
  const picker = panel.getByLabel("Pick color for 01 Stay");
  await picker.fill("#ff0000");
  await expect(panel.getByRole("alert")).toContainText("already has 20 colors");
  await expect(panel.getByLabel("Apply color to 01 Stay")).toHaveValue("");
  await picker.fill("#000001");
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await expect(panel.getByLabel("Apply color to 01 Stay").locator("option:checked")).toHaveText("Color 1");
});

test("quick Stay view and group colors preserve saved column settings", async ({ page }) => {
  const record = {
    id: "a".repeat(64), reference: "REC-1", source: "recorded", roomId, roomName: "Test room",
    checkIn: `${year}-01-02`, checkOut: `${year}-01-05`, status: "recorded", guestName: "First guest",
    phone: "", email: "", country: "", city: "", identifier: "", guestDetails: "", guestCount: 2, nights: 3,
    amountCents: 10000, currency: "EUR", reason: "", netAmountCents: 9000, unitAmountCents: 3000,
    invoiceRequired: null, invoiceCreated: null, invoiceNumber: "", paymentMethod: "", taxQuarter: "",
    overrides: { grossAmountCents: 10000 },
  };
  let views: Array<Record<string, unknown>> = [];
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { bookings: [record] } }));
  await page.route(/\/api\/pnl\/views(?:\/|$)/, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (route.request().method() === "GET") return route.fulfill({ headers, json: { views } });
    const saved = { ...route.request().postDataJSON(), id: "group-view" };
    views = [saved];
    return route.fulfill({ status: 201, headers, json: saved });
  });
  await page.goto(`${uiUrl}/pnl/income`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog", { name: "Income full-screen editor" });
  await editor.getByRole("button", { name: "Configure columns and groups" }).click();
  const panel = page.getByRole("dialog", { name: "Configure income view" });
  await panel.getByLabel("Freeze first visible columns").selectOption("12");
  await panel.getByLabel("01 Stay", { exact: true }).uncheck();
  await panel.getByLabel("03 Invoicing", { exact: true }).uncheck();
  await panel.getByLabel("04 Payment & review", { exact: true }).uncheck();
  await expect(panel.getByLabel("Show Country column")).toBeVisible();
  await expect(panel.getByLabel("Show Room column")).toHaveCount(0);
  await expect(panel.getByLabel("Show Invoice number column")).toHaveCount(0);
  await panel.getByLabel("Filter fields by group").selectOption("stayV2");
  await expect(panel.getByLabel("Show Room column")).toBeVisible();
  await expect(panel.getByLabel("Show Country column")).toHaveCount(0);
  await panel.getByRole("button", { name: "Add color" }).click();
  await panel.getByLabel("Color name 1").fill("Stay color");
  await panel.getByLabel("Color value 1").fill("#ff0000");
  await panel.getByLabel("Apply color to 01 Stay").selectOption({ label: "Stay color" });
  await expect(panel.getByLabel("Color for Room").locator("option:checked")).toHaveText("Stay color");
  await panel.getByLabel("Apply color to 01 Stay").selectOption("");
  await expect(panel.getByLabel("Color for Check-in")).toHaveValue("");
  await panel.getByLabel("Apply color to 01 Stay").selectOption({ label: "Stay color" });
  await panel.getByLabel("Color for Room").selectOption("");
  await expect(panel.getByLabel("Apply color to 01 Stay").locator("option:checked")).toHaveText("Mixed colors");
  await panel.getByLabel("Apply color to 01 Stay").selectOption({ label: "Stay color" });
  await panel.getByLabel("Show Room column").uncheck();
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await editor.getByRole("button", { name: "01 Stay", exact: true }).click();
  await editor.getByRole("button", { name: "02 Registration", exact: true }).click();
  await expect(editor.getByRole("button", { name: "01 Stay", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(editor.getByRole("button", { name: "Guest", exact: true })).toBeVisible();
  await expect(editor.getByRole("button", { name: "Room", exact: true })).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "Country", exact: true })).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "Guest", exact: true }).locator("..")).toHaveCSS("background-color", "rgb(255, 179, 179)");
  await expect(editor.getByLabel("Guest for First guest").locator("..")).toHaveCSS("background-color", "rgb(255, 235, 235)");
  await editor.getByRole("button", { name: "All groups", exact: true }).click();
  await editor.getByRole("button", { name: "Configure columns and groups" }).click();
  await expect(panel.getByLabel("Freeze first visible columns")).toHaveValue("12");
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await editor.getByRole("button", { name: "02 Registration", exact: true }).click();
  await editor.getByRole("button", { name: "03 Invoicing", exact: true }).click();
  await editor.getByRole("button", { name: "04 Payment & review", exact: true }).click();
  await editor.getByRole("button", { name: "Configure columns and groups" }).click();
  await panel.getByLabel("View name").fill("Stay focus");
  await panel.getByRole("button", { name: "Save as new view" }).click();
  await expect.poll(() => views.length).toBe(1);
  expect(views[0].hiddenGroups).toEqual(["registrationV2", "invoicingV2", "reviewV2"]);
  expect(views[0].frozenColumns).toBe(12);
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await editor.getByRole("button", { name: "Close editor" }).click();
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  await editor.getByLabel("Income grid view").selectOption("group-view");
  await expect(editor.getByRole("button", { name: "01 Stay", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(editor.getByRole("button", { name: "Guest", exact: true }).locator("..")).toHaveCSS("background-color", "rgb(255, 179, 179)");
  await expect(editor.getByRole("button", { name: "Country", exact: true })).toHaveCount(0);
  await editor.getByLabel("Filter columns by color").selectOption({ label: "Stay color" });
  await expect(editor.getByRole("button", { name: "Guest", exact: true })).toBeVisible();
  await expect(editor.getByRole("button", { name: "Pax", exact: true })).toBeVisible();
  await editor.getByLabel("Filter columns by color").selectOption("");
  await editor.getByRole("button", { name: "Configure columns and groups" }).click();
  await expect(panel.getByLabel("Apply color to 01 Stay").locator("option:checked")).toHaveText("Stay color");
  await expect(panel.getByLabel("Show Room column")).not.toBeChecked();
});

test("legacy and customized views retain settings and can show check-in columns first", async ({ page }) => {
  const defaultView = {
    columns: ["notes", "roomId", "date"], hiddenGroups: ["registrationV2"],
    hiddenColumns: [], frozenColumns: 2, widths: { roomId: 196 },
  };
  const views = [{
    id: "custom", name: "Custom", columns: ["roomId", "selfCheckIn", "checkInDesk", "notes"],
    hiddenGroups: [], hiddenColumns: [], frozenColumns: 1, widths: {},
  }, {
    id: "filtered", name: "Filtered legacy", columns: ["notes", "roomId"],
    hiddenGroups: [], hiddenColumns: ["checkInDesk"], frozenColumns: 1, widths: {},
    colorTags: [{ id: "stay", name: "Stay", color: "#ff0000" }],
    columnColors: { roomId: "stay" }, colorFilter: "stay",
  }];
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { bookings: [] } }));
  await page.route(/\/api\/pnl\/views(?:\/|$)/, (route) => route.fulfill({ headers, json: { views, defaultView } }));
  await page.goto(`${uiUrl}/pnl/income`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog", { name: "Income full-screen editor" });
  const table = editor.getByRole("table", { name: "Booking income grid" });
  await expect(editor.getByRole("button", { name: "Check-in desk", exact: true })).toHaveCount(0);
  expect((await table.locator("thead th > button").allTextContents()).slice(0, 4)).toEqual(["Notes", "Room", "Check-in", "Arrival time"]);
  await editor.getByRole("button", { name: "Configure columns and groups" }).click();
  const panel = page.getByRole("dialog", { name: "Configure income view" });
  await expect(panel.getByLabel("Freeze first visible columns")).toHaveValue("2");
  await expect(panel.getByLabel("02 Registration", { exact: true })).not.toBeChecked();
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await editor.getByRole("button", { name: "Show check-in columns first" }).click();
  expect((await table.locator("thead th > button").allTextContents()).slice(0, 4))
    .toEqual(["Check-in desk", "Self check-in", "Notes", "Room"]);
  page.once("dialog", (dialog) => dialog.accept());
  await editor.getByLabel("Income grid view").selectOption("custom");
  expect((await table.locator("thead th > button").allTextContents()).slice(0, 4))
    .toEqual(["Room", "Self check-in", "Check-in desk", "Notes"]);
  await editor.getByRole("button", { name: "Show check-in columns first" }).click();
  expect((await table.locator("thead th > button").allTextContents()).slice(0, 4))
    .toEqual(["Check-in desk", "Self check-in", "Room", "Notes"]);
  page.once("dialog", (dialog) => dialog.accept());
  await editor.getByLabel("Income grid view").selectOption("filtered");
  expect((await table.locator("thead th > button").allTextContents()).slice(0, 1)).toEqual(["Room"]);
  await editor.getByRole("button", { name: "Configure columns and groups" }).click();
  await expect(panel.getByLabel("Freeze first visible columns")).toHaveValue("1");
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await editor.getByRole("button", { name: "Show check-in columns first" }).click();
  expect((await table.locator("thead th > button").allTextContents()).slice(0, 4))
    .toEqual(["Check-in desk", "Self check-in", "Notes", "Room"]);
});

test("named column colors and value filters are restored with a view", async ({ page }) => {
  const record = {
    id: "a".repeat(64), reference: "REC-1", source: "recorded", roomId, roomName: "Test room",
    checkIn: `${year}-01-02`, checkOut: `${year}-01-05`, status: "recorded", guestName: "First guest",
    phone: "", email: "", country: "", city: "", identifier: "", guestDetails: "", guestCount: 2, nights: 3,
    amountCents: 10000, currency: "EUR", reason: "", netAmountCents: 9000, unitAmountCents: 3000,
    invoiceRequired: null, invoiceCreated: null, invoiceNumber: "INV-1", paymentMethod: "", taxQuarter: "",
    overrides: { grossAmountCents: 10000, netAmountCents: 9000, invoiceNumber: "INV-1" },
  };
  const second = { ...record, id: "b".repeat(64), reference: "REC-2", guestName: "Second guest", invoiceNumber: "", overrides: { grossAmountCents: 10000 } };
  let views: Array<Record<string, unknown>> = [{ id: "old", name: "Old view", columns: ["roomId"], hiddenGroups: [], frozenColumns: 1, widths: {} }];
  await page.route(/\/api\/pnl\/entries(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, (route) => route.fulfill({ headers, json: { bookings: [record, second] } }));
  await page.route(/\/api\/pnl\/views(?:\/|$)/, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (request.method() === "GET") return route.fulfill({ headers, json: { views } });
    if (request.method() === "POST") {
      const saved = { ...request.postDataJSON(), id: "new" };
      views = [...views, saved];
      return route.fulfill({ status: 201, headers, json: saved });
    }
    return route.fulfill({ status: 500, headers });
  });
  await page.goto(`${uiUrl}/pnl/income`);
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const editor = page.getByRole("dialog", { name: "Income full-screen editor" });
  await editor.getByLabel("Income grid view").selectOption("old");
  expect((await editor.getByRole("table", { name: "Booking income grid" }).locator("thead th > button").allTextContents()).slice(0, 4)).toEqual(["Check-in desk", "Self check-in", "Notes", "Room"]);
  await editor.getByRole("button", { name: "Configure columns and groups" }).click();
  const panel = page.getByRole("dialog", { name: "Configure income view" });
  await expect(panel.getByLabel("Freeze first visible columns")).toHaveValue("4");
  await panel.getByRole("button", { name: "Add color" }).click();
  await panel.getByLabel("Color name 1").fill("Invoices");
  await panel.getByLabel("Color value 1").fill("#ff0000");
  await panel.getByLabel("Color for Room").selectOption({ label: "Invoices" });
  await panel.getByLabel("Color for Invoice number").selectOption({ label: "Invoices" });
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await expect(editor.getByLabel("Filter columns by color")).toHaveValue("");
  const invoiceHeader = editor.getByRole("button", { name: "Invoice number", exact: true }).locator("..");
  await expect(invoiceHeader).toHaveCSS("background-color", "rgb(255, 179, 179)");
  await expect(editor.getByLabel("Invoice number for First guest").locator("..")).toHaveCSS("background-color", "rgb(255, 235, 235)");
  await editor.getByRole("button", { name: "Show value filters" }).click();
  const filter = editor.getByLabel("Filter Invoice number by value");
  await expect(filter.locator("option")).toHaveText(["All values", "(Empty)", "INV-1"]);
  await filter.selectOption(JSON.stringify(""));
  await expect(editor.getByText("1 rows", { exact: true })).toBeVisible();
  await filter.selectOption(JSON.stringify("INV-1"));
  await expect(editor.getByText("1 rows", { exact: true })).toBeVisible();
  await expect(editor.getByLabel("Invoice number for First guest")).toBeVisible();
  await editor.getByLabel("Filter columns by color").selectOption({ label: "Invoices" });
  await expect(editor.getByRole("button", { name: "Guest", exact: true })).toHaveCount(0);
  await editor.getByRole("button", { name: "Configure columns and groups" }).click();
  await panel.getByLabel("Color name 1").fill("Accounting");
  await panel.getByLabel("View name").fill("Color view");
  await panel.getByRole("button", { name: "Save as new view" }).click();
  await expect.poll(() => views.length).toBe(2);
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await expect(editor.getByLabel("Filter columns by color").locator("option:checked")).toHaveText("Accounting");
  expect(views[1].columnFilters).toEqual({ invoiceNumber: "INV-1" });
  await editor.getByRole("button", { name: "Close editor" }).click();
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const reopened = page.getByRole("dialog");
  await reopened.getByLabel("Income grid view").selectOption("new");
  await expect(reopened.getByLabel("Filter columns by color").locator("option:checked")).toHaveText("Accounting");
  await reopened.getByRole("button", { name: "Show value filters" }).click();
  await expect(reopened.getByLabel("Filter Invoice number by value")).toHaveValue(JSON.stringify("INV-1"));
  await expect(reopened.getByText("1 rows", { exact: true })).toBeVisible();
  await expect(reopened.getByRole("button", { name: "Guest", exact: true })).toHaveCount(0);
  await reopened.getByLabel("Invoice number for First guest").fill("INV-3");
  await reopened.getByLabel("Room for First guest").focus();
  await expect(reopened.getByText("0 rows", { exact: true })).toBeVisible();
  await expect(reopened.getByLabel("Filter Invoice number by value").locator("option:checked")).toHaveText("INV-1 (not present)");
  await reopened.getByRole("button", { name: "Clear value filters" }).click();
  await expect(reopened.getByText("2 rows", { exact: true })).toBeVisible();
});
