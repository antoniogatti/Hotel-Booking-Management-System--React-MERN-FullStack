import { expect, test, type Page } from "@playwright/test";

const uiUrl = process.env.ADMIN_TEST_URL || "http://localhost:5174";

test("booking and check-in screens use booking data without retired integration controls", async ({ page }) => {
  await mockSession(page, "admin");
  await page.route("**/api/bookings/test-booking", async (route) => {
    await route.fulfill({
      headers: {
        "access-control-allow-origin": uiUrl,
        "access-control-allow-credentials": "true",
      },
      json: {
        _id: "test-booking", hotelId: "test-room", hotelName: "Test room",
        reservationNumber: "LOCAL-1", firstName: "Alex", lastName: "Guest",
        email: "guest@example.test", phone: "12345", nationality: "Italian",
        adultCount: 2, childCount: 0, status: "confirmed",
        checkIn: "2026-03-01", checkOut: "2026-03-02", totalCost: 100,
        checkInInfo: { arrivalTime: "14:30", phone: "12345", nationality: "Italian", bookingChannel: "Direct", paymentDetails: "Cash at check-in", specialNotes: "Late arrival" },
      },
    });
  });
  await page.goto(`${uiUrl}/booking/test-booking`);
  await expect(page.getByText("Alex", { exact: true })).toBeVisible();
  await expect(page.getByText("Cash at check-in", { exact: true })).toBeVisible();
  await expect(page.getByText(/OneNote|Excel/i)).toHaveCount(0);

  await page.goto(`${uiUrl}/hotel/test-room/check-in/test-booking`);
  await expect(page.getByText("Arrival Time", { exact: true }).locator("..").locator("input")).toHaveValue("14:30");
  await expect(page.getByText("Phone Number", { exact: true }).locator("..").locator("input")).toHaveValue("12345");
  await expect(page.getByText("Payment Details", { exact: true }).locator("..").locator("select")).toHaveValue("Cash at check-in");
  await expect(page.getByText("Special Notes", { exact: true }).locator("..").locator("textarea")).toHaveValue("Late arrival");
  await expect(page.getByText(/OneNote|Excel/i)).toHaveCount(0);
});

async function mockSession(page: Page, role: "admin" | "hotel_owner") {
  await page.addInitScript((userRole) => {
    localStorage.setItem("session_id", "test-session");
    localStorage.setItem("user_role", userRole);
  }, role);

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = {
      "access-control-allow-origin": uiUrl,
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "authorization,content-type",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }

    let body: unknown = { message: "Not available in navigation test" };
    let status = 503;
    if (path === "/api/auth/validate-token") {
      body = { role, userId: "test-user" };
      status = 200;
    } else if (path === "/api/bookings/rooms") {
      body = [];
      status = 200;
    } else if (path === "/api/bookings/dashboard/upcoming-check-ins") {
      body = {
        rows: [{
          _id: "test-booking",
          hotelId: "test-room",
          hotelName: "Test room",
          firstName: "Alex",
          lastName: "Guest",
          email: "",
          phone: "",
          nationality: "",
          status: "confirmed",
          source: "local",
          sourceLabel: "Direct",
          checkIn: new Date().toISOString(),
          checkOut: new Date().toISOString(),
          arrivalTime: "14:00",
          isCheckedIn: false,
          isImported: false,
        }],
        range: { start: "", end: "", days: 7 },
        summary: {
          arrivalsToday: 1,
          upcomingArrivals: 1,
          inHouseToday: 0,
          checkedInToday: 0,
          sync: { totalRooms: 0, enabledRooms: 0, issueRooms: 0, lastSuccessfulSyncAt: null },
        },
      };
      status = 200;
    }
    await route.fulfill({ status, headers, json: body });
  });
}

test("n8n monitor distinguishes setup, workflow status and failures", async ({ page }) => {
  await mockSession(page, "admin");
  let state: "not_configured" | "connected" | "error" = "not_configured";
  await page.route("**/api/n8n-monitor", async (route) => {
    const headers = { "access-control-allow-origin": uiUrl, "access-control-allow-credentials": "true" };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: { ...headers, "access-control-allow-headers": "authorization,content-type" } });
      return;
    }
    if (state === "error") {
      await route.fulfill({ status: 502, headers, json: { message: "Unavailable" } });
      return;
    }
    await route.fulfill({ headers, json: {
      service: "healthy", origin: "https://n8n.example.test", api: state,
      message: "Configure a read-only n8n API key.",
      workflows: state === "connected" ? [{ id: "w1", name: "Knowledge sync", active: true, updatedAt: null }] : [],
      executions: state === "connected" ? [{ id: "e1", workflowId: "w1", status: "error", startedAt: null, stoppedAt: null }] : [],
    } });
  });
  await page.goto(`${uiUrl}/scheduler-monitor`);
  await expect(page).toHaveURL(/\/n8n-workflows$/);
  await expect(page.getByText("n8n health endpoint is responding.")).toBeVisible();
  await expect(page.getByText(/Configure a read-only n8n API key/)).toBeVisible();
  state = "connected";
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
  await expect(page.getByText(/error · Not available/)).toBeVisible();
  state = "error";
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to check n8n");
});

test("admin navigation remains available and marks the active page", async ({ page }) => {
  await mockSession(page, "admin");
  await page.goto(`${uiUrl}/admin-portal`);
  const nav = page.getByRole("navigation", { name: "Admin navigation" });

  await expect(nav.getByRole("link")).toHaveText([
    "Overview",
    "Check-in desk",
    "Room calendar",
    "WhatsApp inbox",
    "Self check-in",
    "Bookings & analytics",
    "Vacancy management",
    "P&L overview",
    "Income",
    "Expenses",
    "Sync center",
    "n8n workflows",
    "Traffic insights",
    "Business insights",
    "API docs",
    "API status",
  ]);
  await expect(nav.getByRole("link", { name: "Properties", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Add property", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Overview", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Sections", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Upcoming check-ins", { exact: true })).toBeVisible();
  const arrival = page.getByRole("row").filter({ hasText: "Alex Guest" });
  await expect(arrival).toContainText("Test room");
  await expect(arrival.getByRole("link", { name: "Check in" })).toHaveAttribute("href", "/hotel/test-room/check-in/test-booking");
  await expect(arrival.getByRole("link", { name: "Booking" })).toHaveAttribute("href", "/booking/test-booking");
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(page.locator("aside").getByRole("link", { name: "Overview", exact: true })).toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, 0));
  await nav.getByRole("link", { name: "Check-in desk" }).click();
  await expect(page).toHaveURL(/\/admin-portal\/check-in(?:\?.*)?$/);
  await expect(nav.getByRole("link", { name: "Check-in desk" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Overview", exact: true })).not.toHaveAttribute("aria-current", "page");

  for (const [path, label] of [
    ["/booking-dashboard", "Bookings & analytics"],
    ["/manage-bookings", "Room calendar"],
    ["/admin-portal/self-checkins/example", "Self check-in"],
    ["/booking/example", "Bookings & analytics"],
    ["/hotel/example/check-in/example", "Check-in desk"],
    ["/booking-com-sync", "Sync center"],
    ["/n8n-workflows", "n8n workflows"],
    ["/traffic-insights", "Traffic insights"],
    ["/pnl", "P&L overview"],
    ["/pnl/income", "Income"],
    ["/pnl/expenses", "Expenses"],
    ["/vacancy-management", "Vacancy management"],
    ["/wa-inbox", "WhatsApp inbox"],
    ["/business-insights", "Business insights"],
    ["/api-docs", "API docs"],
    ["/api-status", "API status"],
  ]) {
    await page.goto(`${uiUrl}${path}`);
    await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
  }

  for (const path of ["/my-hotels", "/edit-hotel/example", "/add-hotel"]) {
    await page.goto(`${uiUrl}${path}`);
    await expect(nav).toBeVisible();
    await expect(nav.locator('a[aria-current="page"]')).toHaveCount(0);
  }
});

test("navigation sections collapse independently and remain accessible in icon mode", async ({ page }) => {
  await mockSession(page, "admin");
  await page.goto(`${uiUrl}/admin-portal`);
  const nav = page.getByRole("navigation", { name: "Admin navigation" });
  const workspace = nav.getByRole("button", { name: "Workspace", exact: true });
  const pnl = nav.getByRole("button", { name: "P&L management" });
  const admin = nav.getByRole("button", { name: "Administration" });
  await workspace.click();
  await expect(workspace).toHaveAttribute("aria-expanded", "false");
  await expect(nav.getByRole("link", { name: "Check-in desk" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Income" })).toBeVisible();
  await admin.click();
  await expect(nav.getByRole("link", { name: "Sync center" })).toHaveCount(0);
  await pnl.click();
  await expect(nav.getByRole("link", { name: "Income" })).toHaveCount(0);
  await page.reload();
  await expect(nav.getByRole("button", { name: "Workspace", exact: true })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await nav.getByRole("button", { name: "P&L management" }).click();
  await expect(nav.getByRole("link", { name: "Income" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Income" })).toHaveAttribute("title", "Income");
});

test("desktop sidebar collapses to accessible icons and remembers the choice", async ({ page }) => {
  await mockSession(page, "admin");
  await page.goto(`${uiUrl}/admin-portal`);
  const sidebar = page.locator("aside");
  const nav = page.getByRole("navigation", { name: "Admin navigation" });
  const expandedWidth = (await sidebar.boundingBox())!.width;

  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");
  expect((await sidebar.boundingBox())!.width).toBeLessThan(expandedWidth);
  const checkIn = nav.getByRole("link", { name: "Check-in desk" });
  await expect(checkIn).toHaveAttribute("title", "Check-in desk");
  await checkIn.click();
  await expect(page).toHaveURL(/\/admin-portal\/check-in/);
  await expect(nav.getByRole("link", { name: "Check-in desk" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(page.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute("aria-expanded", "true");
  expect((await sidebar.boundingBox())!.width).toBe(expandedWidth);
  await page.reload();
  await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
});

test("admin overview shows real traffic metrics and links to the dashboard", async ({ page }) => {
  await mockSession(page, "admin");
  await page.route("**/api/traffic-insights/dashboard**", async (route) => {
    const headers = {
      "access-control-allow-origin": uiUrl,
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "authorization,content-type",
      "access-control-allow-methods": "GET,OPTIONS",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    await route.fulfill({
      headers,
      json: {
        range: { days: 7 },
        metrics: { pageViews24h: 123, uniqueVisitors24h: 45, requestCount24h: 67, failedRequests24h: 2, avgApiDurationMs24h: 80 },
        trafficByDate: [], sessionsByDevice: [], topPages: [], recentApi: [], geoTraffic: [], lastUpdated: new Date().toISOString(),
      },
    });
  });
  await page.goto(`${uiUrl}/admin-portal`);
  const section = page.getByRole("region", { name: "Traffic insights" });
  await expect(section.locator("dl > div")).toHaveText(["Page views123", "Unique visitors45", "API requests67", "Failed requests2"]);
  await expect(section.getByRole("link", { name: "View traffic dashboard" })).toHaveAttribute("href", "/traffic-insights");
});

test("traffic errors are visible and can be retried", async ({ page }) => {
  await mockSession(page, "admin");
  let requests = 0;
  await page.route("**/api/traffic-insights/dashboard**", async (route) => {
    const headers = {
      "access-control-allow-origin": uiUrl,
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "authorization,content-type",
      "access-control-allow-methods": "GET,OPTIONS",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    requests += 1;
    await route.fulfill({ status: 503, headers, json: { message: "Unavailable" } });
  });
  await page.goto(`${uiUrl}/admin-portal`);
  const section = page.getByRole("region", { name: "Traffic insights" });
  await expect(section.getByRole("alert")).toContainText("Unable to load traffic insights");
  await expect(section.locator("dl")).toHaveCount(0);
  await section.getByRole("button", { name: "Retry traffic insights" }).click();
  await expect.poll(() => requests).toBe(2);
  await expect(section.getByRole("alert")).toBeVisible();
});

test("income details and invoice tracking can be recorded for a booking", async ({ page }) => {
  await mockSession(page, "admin");
  const year = new Date().getFullYear();
  const roomId = "507f1f77bcf86cd799439011";
  const headers = {
    "access-control-allow-origin": uiUrl,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "authorization,content-type",
    "access-control-allow-methods": "GET,PUT,OPTIONS",
  };
  let details: Record<string, unknown> = {};
  await page.route("**/api/bookings/rooms", (route) =>
    route.fulfill({ headers, json: [{ _id: roomId, name: "Test room", city: "", country: "" }] })
  );
  await page.route("**/api/pnl/entries**", (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (route.request().method() === "PUT") {
      details = route.request().postDataJSON();
      await route.fulfill({ headers, json: { message: "Saved" } });
      return;
    }
    await route.fulfill({ headers, json: { bookings: [{
      id: "local1", reference: "LOCAL-123", source: "local", roomId,
      checkIn: `${year}-01-07`, checkOut: `${year}-01-10`, status: "confirmed",
      guestName: "Test Guest", email: "", phone: "", nationality: "",
      country: details.country || "Italy", city: details.city || "Rome",
      identifier: details.identifier || "", guestDetails: details.guestDetails || "",
      guestCount: details.guestCount || 2, nights: 3,
      amountCents: details.grossAmountCents || 10000, currency: "EUR", reason: "",
      netAmountCents: details.netAmountCents ?? null,
      unitAmountCents: details.netAmountCents ? Number(details.netAmountCents) / 3 : null,
      invoiceRequired: details.invoiceRequired ?? null,
      invoiceCreated: details.invoiceCreated ?? null,
      invoiceNumber: details.invoiceNumber || "", overrides: details,
    }] } });
  });
  await page.goto(`${uiUrl}/pnl/income`);
  const row = page.getByRole("row").filter({ hasText: "LOCAL-123" });
  await expect(row).toContainText("Italy");
  await expect(row).toContainText("Not specified");
  await page.getByRole("button", { name: "Edit income details for LOCAL-123" }).click();
  await page.getByLabel("Country override").fill("France");
  await page.getByLabel("City override").fill("Paris");
  await page.getByLabel("Guest identifier").fill("ID-123");
  await page.getByLabel("Guest count override").fill("3");
  await page.getByLabel("Guest ages / details", { exact: true }).fill("F 44 - M 45");
  await page.getByLabel("Booking value override (EUR)").fill("240");
  await page.getByLabel("Before tourist tax override (EUR)").fill("210");
  await page.locator("label").filter({ hasText: "Invoice required" }).locator("select").selectOption("yes");
  await page.locator("label").filter({ hasText: "Invoice status" }).locator("select").selectOption("no");
  await page.getByRole("button", { name: "Save income details" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect.poll(() => details.country).toBe("France");
  await expect(row).toContainText("France");
  await expect(row).toContainText("Paris");
  await expect(row).toContainText("ID-123");
  await expect(row).toContainText("F 44 - M 45");
  await expect(row).toContainText("€240.00");
  await expect(row).toContainText("€210.00");
  await expect(row).toContainText("€70.00");
  await expect(row).toContainText("Pending");
  expect(details).toMatchObject({ guestCount: 3, grossAmountCents: 24000, netAmountCents: 21000, invoiceRequired: true, invoiceCreated: false });

  await page.getByRole("button", { name: "Edit income details for LOCAL-123" }).click();
  await page.locator("label").filter({ hasText: "Invoice status" }).locator("select").selectOption("yes");
  await expect(page.getByLabel("Invoice number", { exact: true })).toHaveAttribute("required", "");
  await page.getByLabel("Invoice number", { exact: true }).fill("INV-2026-1");
  await page.getByRole("button", { name: "Save income details" }).click();
  await expect(row).toContainText("Created");
  await expect(row).toContainText("INV-2026-1");
  expect(details).toMatchObject({ invoiceRequired: true, invoiceCreated: true, invoiceNumber: "INV-2026-1" });
});

test("standalone income records remain editable without a booking link", async ({ page }) => {
  await mockSession(page, "admin");
  const headers = {
    "access-control-allow-origin": uiUrl, "access-control-allow-credentials": "true",
    "access-control-allow-headers": "authorization,content-type",
    "access-control-allow-methods": "GET,PUT,OPTIONS",
  };
  const id = "a".repeat(64);
  let details: Record<string, unknown> = { grossAmountCents: 10000, netAmountCents: 9000, invoiceNumber: "INV-1" };
  let identity: Record<string, unknown> = {
    reference: "", guestName: "Standalone Guest", phone: "", email: "", roomId: "", roomName: "",
    date: `${new Date().getFullYear()}-02-01`, nights: 3,
  };
  await page.route("**/api/pnl/entries**", (route) => route.fulfill({ headers, json: { entries: [] } }));
  await page.route(/\/api\/pnl\/bookings(?:\/|\?|$)/, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
    } else if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      details = body.details;
      identity = body;
      await route.fulfill({ headers, json: { message: "Saved" } });
    } else {
      await route.fulfill({ headers, json: { bookings: [{
        id, ...identity, source: "recorded", checkIn: identity.date, checkOut: "", status: "recorded",
        country: "", city: "", identifier: "", guestDetails: "", guestCount: null,
        amountCents: details.grossAmountCents, netAmountCents: details.netAmountCents,
        unitAmountCents: 3000, currency: "EUR", reason: details.excludeFromTotals ? "Excluded by administrator" : "",
        invoiceRequired: null, invoiceCreated: null, invoiceNumber: details.invoiceNumber,
        paymentMethod: "", taxQuarter: "", overrides: details,
      }] } });
    }
  });
  await page.goto(`${uiUrl}/pnl/income`);
  const row = page.getByRole("row").filter({ hasText: "Standalone Guest" });
  await expect(row).toContainText("Recorded income");
  await expect(row.getByRole("link")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit income details for Standalone Guest" }).click();
  await page.getByLabel("Guest name", { exact: true }).fill("Updated Guest");
  await page.getByLabel("Nights", { exact: true }).fill("4");
  await expect(page.getByLabel("Invoice number", { exact: true })).toHaveValue("INV-1");
  expect(await page.locator("form").evaluate((form: HTMLFormElement) =>
    [...form.elements].filter((element): element is HTMLInputElement => element instanceof HTMLInputElement && !element.validity.valid)
      .map((element) => `${element.type}: ${element.validationMessage}`)
  )).toEqual([]);
  const [response] = await Promise.all([
    page.waitForResponse((response) => response.request().method() === "PUT" && response.url().includes("/api/pnl/bookings/recorded/"), { timeout: 5000 }),
    page.getByRole("button", { name: "Save income details" }).click(),
  ]);
  expect(response.status()).toBe(200);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect.poll(() => identity.guestName).toBe("Updated Guest");
  expect(identity.nights).toBe(4);
  expect(details.invoiceNumber).toBe("INV-1");
  const updatedRow = page.getByRole("row").filter({ hasText: "Updated Guest" });
  await updatedRow.getByRole("button", { name: "Exclude from totals" }).click();
  await expect(updatedRow).toContainText("Excluded by administrator");
});

test("P&L overview and ledgers track room and shared entries", async ({ page }) => {
  await mockSession(page, "admin");
  const year = new Date().getFullYear();
  const roomId = "507f1f77bcf86cd799439011";
  type Entry = {
    _id: string;
    type: "income" | "expense";
    date: string;
    amountCents: number;
    category: string;
    description: string;
    roomId: string | null;
    status: "paid" | "pending";
  };
  let entries: Entry[] = [
    { _id: "1", type: "income", date: `${year}-01-02`, amountCents: 12345, category: "Room", description: "Test stay", roomId, status: "paid" },
    { _id: "2", type: "expense", date: `${year}-01-03`, amountCents: 2525, category: "Cleaning", description: "Room cleaning", roomId, status: "pending" },
    { _id: "3", type: "expense", date: `${year}-01-04`, amountCents: 500, category: "Utilities", description: "Shared utilities", roomId: null, status: "paid" },
  ];
  const headers = {
    "access-control-allow-origin": uiUrl,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "authorization,content-type",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  };
  await page.route("**/api/bookings/rooms", (route) =>
    route.fulfill({ headers, json: [{ _id: roomId, name: "Test room", city: "", country: "" }] })
  );
  await page.route("**/api/pnl/bookings**", (route) => route.fulfill({
    headers,
    json: { bookings: [
      { id: "local1", reference: "LOCAL-123", source: "local", roomId, checkIn: `${year}-01-07`, checkOut: `${year}-01-09`, status: "confirmed", guestName: "Test Guest", email: "guest@example.test", phone: "", nationality: "", amountCents: 10000, currency: "EUR", reason: "" },
      { id: "external1", reference: "BOOKING-123", source: "booking_com", roomId, checkIn: `${year}-02-01`, checkOut: `${year}-02-02`, status: "imported", guestName: "", email: "", phone: "", nationality: "", amountCents: null, currency: "", reason: "Amount unavailable" },
    ] },
  }));
  await page.route("**/api/pnl/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.startsWith("/api/pnl/entries")) {
      await route.fallback();
      return;
    }
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (request.method() === "POST") {
      const saved = { ...request.postDataJSON(), _id: "4" } as Entry;
      entries.push(saved);
      await route.fulfill({ status: 201, headers, json: saved });
    } else if (request.method() === "PUT") {
      const id = path.split("/").pop();
      const saved = { ...request.postDataJSON(), _id: id } as Entry;
      entries = entries.map((entry) => entry._id === id ? saved : entry);
      await route.fulfill({ headers, json: saved });
    } else if (request.method() === "DELETE") {
      const id = path.split("/").pop();
      entries = entries.filter((entry) => entry._id !== id);
      await route.fulfill({ status: 204, headers });
    } else {
      const selectedYear = new URL(request.url()).searchParams.get("year");
      await route.fulfill({ headers, json: { entries: entries.filter((entry) => entry.date.startsWith(`${selectedYear}-`)) } });
    }
  });

  await page.goto(`${uiUrl}/pnl`);
  const totals = page.getByRole("region", { name: "Annual P&L totals" });
  await expect(totals).toContainText("223.45");
  await expect(totals).toContainText("30.25");
  await expect(totals).toContainText("193.20");
  const roomRow = page.getByRole("row", { name: /Test room/ });
  await expect(roomRow.locator("td").first()).toContainText("198.20");
  await expect(page.getByRole("row", { name: /Shared \/ unassigned/ }).locator("td").first()).toContainText("-€5.00");

  await page.getByRole("link", { name: "Manage income" }).click();
  await expect(page.getByRole("link", { name: "LOCAL-123" })).toHaveAttribute("href", "/booking/local1");
  await expect(page.getByRole("row", { name: /LOCAL-123/ })).toContainText(`${year}-01-07`);
  await expect(page.getByRole("row", { name: /LOCAL-123/ })).toContainText(`${year}-01-09`);
  await expect(page.getByRole("row", { name: /LOCAL-123/ })).toContainText("Test Guest");
  await expect(page.getByRole("row", { name: /BOOKING-123/ })).toContainText("Amount unavailable");
  const incomeTable = page.getByRole("table", { name: "Booking income" });
  const referenceHeader = incomeTable.getByRole("columnheader", { name: /Reference \/ source/ });
  await incomeTable.getByRole("button", { name: "Sort by Reference / source" }).click();
  await expect(referenceHeader).toHaveAttribute("aria-sort", "ascending");
  await expect(incomeTable.locator("tbody tr").first()).toContainText("BOOKING-123");
  await incomeTable.getByRole("button", { name: "Sort by Reference / source" }).click();
  await expect(incomeTable.locator("tbody tr").first()).toContainText("LOCAL-123");
  expect(await incomeTable.locator("tbody td").first().evaluate((element) => getComputedStyle(element).whiteSpace)).toBe("normal");
  const resize = incomeTable.getByRole("separator", { name: "Resize Reference / source column" });
  await resize.focus();
  await page.keyboard.press("ArrowRight");
  await expect(resize).toHaveAttribute("aria-valuenow", "176");
  const box = (await resize.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2);
  await page.mouse.up();
  await expect(resize).toHaveAttribute("aria-valuenow", "216");
  await page.goto(`${uiUrl}/pnl`);
  await page.getByRole("link", { name: "Manage expenses" }).click();
  await expect(page.getByText("Room cleaning")).toBeVisible();
  await page.getByRole("button", { name: "Add expense" }).click();
  await page.getByLabel("Date", { exact: true }).fill(`${year}-02-01`);
  await page.getByLabel("Amount (EUR)").fill("12.34");
  await page.getByLabel("Category", { exact: true }).fill("Supplies");
  await page.getByLabel("Description", { exact: true }).fill("Test supplies");
  await page.getByLabel("Room", { exact: true }).selectOption(roomId);
  await page.getByLabel("Payment status").selectOption("pending");
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.getByText("Test supplies")).toBeVisible();
  expect(entries.find((entry) => entry._id === "4")).toMatchObject({ amountCents: 1234, roomId, status: "pending" });
  await page.getByRole("button", { name: "Edit Test supplies" }).click();
  await page.getByLabel("Amount (EUR)").fill("15,50");
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect.poll(() => entries.find((entry) => entry._id === "4")?.amountCents).toBe(1550);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Test supplies" }).click();
  await expect(page.getByText("Test supplies")).toHaveCount(0);
  expect(entries.some((entry) => entry._id === "4")).toBe(false);
});

test("P&L shows a load error instead of fabricated totals", async ({ page }) => {
  await mockSession(page, "admin");
  await page.goto(`${uiUrl}/pnl`);
  await expect(page.getByRole("alert")).toContainText("Unable to load P&L data");
  await expect(page.getByRole("region", { name: "Annual P&L totals" })).toHaveCount(0);
});

test("calendar distinguishes imported and booked reservations consistently", async ({ page }) => {
  await mockSession(page, "admin");
  const month = new Date().toISOString().slice(0, 7);
  const room = { _id: "test-room", name: "Test room", city: "", country: "" };
  await page.route("**/api/bookings/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path !== "/api/bookings/rooms" && !path.startsWith("/api/bookings/calendar/")) {
      await route.fallback();
      return;
    }
    const headers = {
      "access-control-allow-origin": uiUrl,
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "authorization,content-type",
      "access-control-allow-methods": "GET,OPTIONS",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const booking = {
      email: "", totalCost: 0, adultCount: 1, childCount: 0,
    };
    const calendar = {
      room,
      month,
      days: [
        { date: `${month}-02`, status: "Booked", bookedCount: 1, requestedCount: 0, importedCount: 0, closed: false },
        { date: `${month}-06`, status: "Imported", bookedCount: 0, requestedCount: 0, importedCount: 1, closed: false },
      ],
      bookings: [
        { ...booking, _id: "booked", firstName: "Alice", lastName: "Guest", checkIn: `${month}-02T00:00:00Z`, checkOut: `${month}-04T00:00:00Z`, status: "Booked" },
        { ...booking, _id: "imported", firstName: "", lastName: "", checkIn: `${month}-06T00:00:00Z`, checkOut: `${month}-08T00:00:00Z`, status: "Imported", isImported: true, sourceLabel: "Imported example" },
      ],
    };
    await route.fulfill({ status: 200, headers, json: path === "/api/bookings/rooms" ? [room] : calendar });
  });
  await page.goto(`${uiUrl}/manage-bookings`);

  const bookedBar = page.getByRole("button", { name: "Alice Guest" }).first();
  const importedBar = page.getByRole("button", { name: "Imported example" }).first();
  await expect(bookedBar).toBeVisible();
  await expect(importedBar).toBeVisible();
  const background = (selector: import("@playwright/test").Locator) =>
    selector.evaluate((element) => getComputedStyle(element).backgroundColor);
  const bookedColor = await background(bookedBar);
  const importedColor = await background(importedBar);
  const rgb = (color: string) => color.match(/\d+/g)!.map(Number);
  const distance = Math.hypot(...rgb(bookedColor).map((value, i) => value - rgb(importedColor)[i]));
  const luminance = rgb(importedColor)
    .map((value) => value / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  expect(distance).toBeGreaterThan(70);
  expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(4.5);
  expect(await background(page.locator("span").filter({ hasText: /^Booked$/ }).locator("span"))).toBe(bookedColor);
  expect(await background(page.locator("span").filter({ hasText: /^Imported$/ }).locator("span"))).toBe(importedColor);
  await importedBar.click();
  await expect(page.getByText("Current Status").locator("..").getByText("Imported")).toHaveCSS("background-color", importedColor);
});

test("mobile navigation includes all permitted destinations for an owner", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSession(page, "hotel_owner");
  let trafficRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/traffic-insights/dashboard") trafficRequests += 1;
  });
  await page.goto(`${uiUrl}/admin-portal`);
  const nav = page.getByRole("navigation", { name: "Admin navigation" });

  await expect(nav.getByRole("link")).toHaveText([
    "Overview",
    "Check-in desk",
    "WhatsApp inbox",
    "Self check-in",
    "Bookings & analytics",
    "Vacancy management",
  ]);
  await expect(nav.getByRole("link", { name: "WhatsApp inbox" })).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Vacancy management" })).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Self check-in" })).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Room calendar" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Sync center" })).toHaveCount(0);
  await expect(nav.getByRole("button", { name: "P&L management" })).toHaveCount(0);
  await nav.getByRole("button", { name: "Workspace" }).click();
  await expect(nav.getByRole("link", { name: "Self check-in" })).toHaveCount(0);
  await nav.getByRole("button", { name: "Workspace" }).click();
  await expect(page.getByRole("region", { name: "Traffic insights" })).toHaveCount(0);
  expect(trafficRequests).toBe(0);
  await nav.getByRole("link", { name: "Self check-in" }).click();
  await expect(nav.getByRole("link", { name: "Self check-in" })).toHaveAttribute("aria-current", "page");

  await page.goto(`${uiUrl}/`);
  await expect(page.getByRole("navigation", { name: "Admin navigation" })).toHaveCount(0);
  await page.goto(`${uiUrl}/pnl`);
  await expect(page).not.toHaveURL(/\/pnl$/);
});
