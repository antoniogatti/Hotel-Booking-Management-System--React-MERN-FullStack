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

test("income grid edits independent records, calculates unit price, and protects booking fields", async ({ page }) => {
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
  await expect(editor.getByLabel("Guest for Booking Guest")).toHaveCount(0);
  await editor.getByLabel("Notes for Independent Guest").fill("Call guest");
  await editor.getByLabel("Room for Independent Guest").focus();
  await expect.poll(() => (saved?.details as Record<string, unknown>)?.notes).toBe("Call guest");
  await editor.getByLabel("Notes for Booking Guest").fill("Booking note");
  await editor.getByLabel("Country for Booking Guest").focus();
  await expect.poll(() => (saved as Record<string, unknown>)?.notes).toBe("Booking note");
  await editor.getByLabel("Nights for Independent Guest").fill("4");
  await editor.getByLabel("Guests for Independent Guest").focus();
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
  await editor.getByLabel("Identifier for Booking Guest").focus();
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

test("income starts with stay keys and proposes site and booking.com matches without linking", async ({ page }) => {
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
  expect((await editor.locator("thead th > button").allTextContents()).slice(0, 5)).toEqual(["Notes", "Room", "Check-in", "Check-out", "Guest"]);
  const gridRow = editor.getByLabel("Guest for Recorded guest").locator("xpath=ancestor::tr");
  const region = editor.getByRole("region", { name: "Editable grid" });
  const grid = editor.getByRole("table", { name: "Booking income grid" });
  const checkPinnedColumns = async (offsets: number[]) => {
    const positions = await grid.evaluate((table) => {
      const region = table.parentElement!;
      return {
        left: region.getBoundingClientRect().left,
        headers: Array.from(table.querySelectorAll("thead th")).slice(0, 5).map((cell) => cell.getBoundingClientRect().left),
        cells: Array.from(table.querySelectorAll("tbody tr:first-child td")).slice(0, 5).map((cell) => cell.getBoundingClientRect().left),
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
  await checkPinnedColumns([0, 220, 400, 545, 690]);
  await editor.getByRole("separator", { name: "Resize Room column" }).focus();
  await page.keyboard.press("ArrowRight");
  await region.evaluate((element) => { element.scrollLeft = 1000; });
  await checkPinnedColumns([0, 220, 416, 561, 706]);
  await editor.getByRole("separator", { name: "Resize Check-in column" }).focus();
  await page.keyboard.press("ArrowRight");
  await region.evaluate((element) => { element.scrollLeft = 1000; });
  await checkPinnedColumns([0, 220, 416, 577, 722]);
  await expect(gridRow).toContainText("Check-out matches");
  await expect(gridRow).toContainText("Check-out differs");
  await editor.getByLabel("Nights for Recorded guest").fill("4");
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
  const editor = page.getByRole("dialog");
  const table = editor.getByRole("table", { name: "Booking income grid" });
  await editor.getByLabel("Drag Guest column").dragTo(editor.getByRole("button", { name: "Reference", exact: true }));
  expect((await table.locator("thead th > button").allTextContents()).slice(0, 6)).toEqual(["Notes", "Room", "Check-in", "Check-out", "Reference", "Guest"]);
  await editor.getByText("Configure columns and groups").click();
  await editor.getByLabel("Freeze first visible columns").selectOption("2");
  await editor.getByLabel("Guest details", { exact: true }).uncheck();
  await editor.getByLabel("Show Invoice number column").uncheck();
  await expect(editor.getByRole("button", { name: "Invoice number", exact: true })).toHaveCount(0);
  await editor.getByRole("separator", { name: "Resize Room column" }).focus();
  await page.keyboard.press("ArrowRight");
  await editor.getByLabel("View name").fill("Invoice review");
  failSave = true;
  await editor.getByRole("button", { name: "Save as new view" }).click();
  await expect(editor.getByRole("alert")).toContainText("Could not save this view");
  expect(views).toHaveLength(0);
  failSave = false;
  await editor.getByRole("button", { name: "Save as new view" }).click();
  await expect.poll(() => views.length).toBe(1);
  expect(views[0].columns.slice(0, 6)).toEqual(["notes", "roomId", "date", "checkOut", "reference", "guestName"]);
  expect(views[0].hiddenGroups).toEqual(["guest"]);
  expect(views[0].hiddenColumns).toEqual(["invoiceNumber"]);
  expect(views[0].frozenColumns).toBe(2);
  expect(views[0].widths.roomId).toBe(196);
  await editor.getByLabel("View name").fill("Second view");
  await editor.getByLabel("Freeze first visible columns").selectOption("1");
  await editor.getByRole("button", { name: "Save as new view" }).click();
  await expect.poll(() => views.length).toBe(2);
  await editor.getByLabel("Income grid view").selectOption("1");
  await expect(editor.getByLabel("Freeze first visible columns")).toHaveValue("2");
  await expect(editor.getByLabel("Guest details", { exact: true })).not.toBeChecked();
  await expect(editor.getByRole("separator", { name: "Resize Room column" })).toHaveAttribute("aria-valuenow", "196");
  await editor.getByLabel("Income grid view").selectOption("");
  expect((await table.locator("thead th > button").allTextContents()).slice(0, 5)).toEqual(["Notes", "Room", "Check-in", "Check-out", "Guest"]);
  await expect(editor.getByRole("button", { name: "Invoice number", exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Close editor" }).click();
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const reopened = page.getByRole("dialog");
  await reopened.getByLabel("Income grid view").selectOption("1");
  await reopened.getByText("Configure columns and groups").click();
  await expect(reopened.getByLabel("Freeze first visible columns")).toHaveValue("2");
  await expect(reopened.getByLabel("Guest details", { exact: true })).not.toBeChecked();
  await expect(reopened.getByLabel("Show Invoice number column")).not.toBeChecked();
  await expect(reopened.getByRole("button", { name: "Invoice number", exact: true })).toHaveCount(0);
  await expect(reopened.getByRole("button", { name: "Email", exact: true })).toHaveCount(0);
  expect((await reopened.getByRole("table", { name: "Booking income grid" }).locator("thead th > button").allTextContents()).slice(0, 6))
    .toEqual(["Notes", "Room", "Check-in", "Check-out", "Reference", "Guest"]);
  const positions = await reopened.getByRole("table", { name: "Booking income grid" }).locator("thead th").evaluateAll(
    (cells) => cells.slice(0, 3).map((cell) => getComputedStyle(cell).position)
  );
  expect(positions).toEqual(["sticky", "sticky", "relative"]);
  await reopened.getByLabel("Show Invoice number column").check();
  await expect(reopened.getByRole("button", { name: "Invoice number", exact: true })).toBeVisible();
  await reopened.getByLabel("Show Invoice number column").uncheck();
  await reopened.getByLabel("Freeze first visible columns").selectOption("3");
  await reopened.getByRole("button", { name: "Save view", exact: true }).click();
  await expect.poll(() => views.find((view) => view.id === "1")?.frozenColumns).toBe(3);
  await reopened.getByRole("button", { name: "Move Guest left" }).click();
  await expect(reopened.getByText("Unsaved view changes")).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await reopened.getByLabel("Income grid view").selectOption("2");
  await expect(reopened.getByLabel("Income grid view")).toHaveValue("1");
  page.once("dialog", (dialog) => dialog.accept());
  await reopened.getByLabel("Income grid view").selectOption("2");
  await expect(reopened.getByLabel("Freeze first visible columns")).toHaveValue("1");
  page.once("dialog", (dialog) => dialog.accept());
  await reopened.getByRole("button", { name: "Delete view" }).click();
  await expect.poll(() => views.length).toBe(1);
  await expect(reopened.getByLabel("Income grid view")).toHaveValue("");
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
  const editor = page.getByRole("dialog");
  await editor.getByLabel("Income grid view").selectOption("old");
  expect((await editor.getByRole("table", { name: "Booking income grid" }).locator("thead th > button").allTextContents()).slice(0, 2)).toEqual(["Notes", "Room"]);
  await editor.getByText("Configure columns and groups").click();
  await expect(editor.getByLabel("Freeze first visible columns")).toHaveValue("2");
  await expect(editor.getByLabel("Filter columns by color")).toHaveValue("");
  await editor.getByRole("button", { name: "Add color" }).click();
  await editor.getByLabel("Color name 1").fill("Invoices");
  await editor.getByLabel("Color value 1").fill("#ff0000");
  await editor.getByLabel("Color for Room").selectOption({ label: "Invoices" });
  await editor.getByLabel("Color for Invoice number").selectOption({ label: "Invoices" });
  const invoiceHeader = editor.getByRole("button", { name: "Invoice number", exact: true }).locator("..");
  await expect(invoiceHeader).toHaveCSS("background-color", "rgb(255, 179, 179)");
  await expect(editor.getByLabel("Invoice number for First guest").locator("..")).toHaveCSS("background-color", "rgb(255, 235, 235)");
  const filter = editor.getByLabel("Filter Invoice number by value");
  await expect(filter.locator("option")).toHaveText(["All values", "(Empty)", "INV-1"]);
  await filter.selectOption(JSON.stringify(""));
  await expect(editor.getByText("1 rows", { exact: true })).toBeVisible();
  await filter.selectOption(JSON.stringify("INV-1"));
  await expect(editor.getByText("1 rows", { exact: true })).toBeVisible();
  await expect(editor.getByLabel("Invoice number for First guest")).toBeVisible();
  await editor.getByLabel("Filter columns by color").selectOption({ label: "Invoices" });
  await expect(editor.getByRole("button", { name: "Guest", exact: true })).toHaveCount(0);
  await editor.getByLabel("Color name 1").fill("Accounting");
  await expect(editor.getByLabel("Filter columns by color").locator("option:checked")).toHaveText("Accounting");
  await editor.getByLabel("View name").fill("Color view");
  await editor.getByRole("button", { name: "Save as new view" }).click();
  await expect.poll(() => views.length).toBe(2);
  expect(views[1].columnFilters).toEqual({ invoiceNumber: "INV-1" });
  await editor.getByRole("button", { name: "Close editor" }).click();
  await page.getByRole("button", { name: "Open full-screen editor" }).click();
  const reopened = page.getByRole("dialog");
  await reopened.getByLabel("Income grid view").selectOption("new");
  await expect(reopened.getByLabel("Filter columns by color").locator("option:checked")).toHaveText("Accounting");
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
