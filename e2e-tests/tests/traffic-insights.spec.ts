import { expect, test, type Page } from "@playwright/test";

const uiUrl = process.env.ADMIN_TEST_URL || "http://localhost:5174";
const dashboard = {
  range: { days: 7 },
  metrics: { pageViews24h: 50, uniqueVisitors24h: 20, requestCount24h: 0, failedRequests24h: 0, avgApiDurationMs24h: 0 },
  trafficByDate: [{ date: "2026-11-15", pageViews: 40 }, { date: "2026-11-16", pageViews: 60 }],
  sessionsByDevice: [{ device: "Mobile", sessions: 60 }, { device: "Desktop", sessions: 30 }, { device: "Tablet", sessions: 10 }],
  topPages: [{ path: "/", views: 70 }, { path: "/search", views: 30 }],
  recentApi: [],
  geoTraffic: [
    { country: "France", city: "Paris", hits: 50, lastSeen: null, coordinates: { latitude: 48.85341, longitude: 2.3488 } },
    { country: "Italy", city: "Bari", hits: 30, lastSeen: null, coordinates: { latitude: 41.12066, longitude: 16.86982 } },
    { country: "Italy", city: "", hits: 20, lastSeen: null, coordinates: null },
  ],
  lastUpdated: "2026-11-16T12:00:00Z",
};

async function mockDashboard(page: Page, empty = false) {
  await page.addInitScript(() => {
    localStorage.setItem("session_id", "test-session");
    localStorage.setItem("user_role", "admin");
  });
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const headers = {
      "access-control-allow-origin": uiUrl, "access-control-allow-credentials": "true",
      "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,OPTIONS",
    };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === "/api/auth/validate-token") return route.fulfill({ headers, json: { role: "admin", userId: "test-user" } });
    if (path === "/api/traffic-insights/dashboard") {
      return route.fulfill({ headers, json: empty ? {
        ...dashboard, trafficByDate: [], sessionsByDevice: [], topPages: [], geoTraffic: [],
      } : dashboard });
    }
    return route.fulfill({ status: 200, headers, json: [] });
  });
}

test("shows clear device shares, ranked pages and countries, and an interactive full-row city map", async ({ page }) => {
  await mockDashboard(page);
  await page.goto(`${uiUrl}/traffic-insights`);
  const devices = page.getByRole("list", { name: "Device page view breakdown" });
  await expect(devices.getByRole("listitem").filter({ hasText: "Mobile" })).toContainText("60%");
  await expect(devices.getByRole("listitem").filter({ hasText: "Desktop" })).toContainText("30%");
  await expect(devices.getByRole("listitem").filter({ hasText: "Tablet" })).toContainText("10%");
  const pages = page.locator("div").filter({ has: page.getByRole("heading", { name: "Top pages", exact: true }) }).last();
  await expect(pages.getByRole("listitem").first()).toContainText("/70");
  const countries = page.getByRole("heading", { name: "Top countries", exact: true }).locator("..");
  await expect(countries.getByRole("listitem").filter({ hasText: "Italy" })).toContainText("50");
  await expect(page.getByRole("heading", { name: "Top cities", exact: true })).toBeVisible();
  const map = page.getByRole("region", { name: "Interactive world map of page views by city" });
  await expect(map).toBeVisible();
  const bounds = await map.boundingBox();
  const row = await page.getByRole("heading", { name: "Visitors around the world" }).locator("..").boundingBox();
  expect(bounds!.width).toBeGreaterThan(row!.width * 0.9);
  await expect(page.getByText("80 of 100 location page views mapped.", { exact: false })).toBeVisible();
  await page.getByLabel("Explore a city").selectOption("Paris, France");
  await expect(page.locator(".leaflet-popup-content")).toHaveText("Paris, France: 50 page views");
  await page.getByRole("button", { name: "Reset world view" }).click();
  await expect(page.getByLabel("Explore a city")).toHaveValue("");
  await expect(page.locator(".leaflet-popup-content")).toHaveCount(0);
  await expect(page.getByRole("alert").filter({ hasText: "Map tiles could not load" })).toBeVisible();
  await page.getByText("All reported cities (3)", { exact: true }).click();
  await expect(page.locator("details").getByText("Unknown city, Italy")).toBeVisible();
  const rangeRequest = page.waitForRequest((request) => request.url().includes("/api/traffic-insights/dashboard?days=30&category=customer"));
  await page.getByLabel("Date range").selectOption("30");
  await rangeRequest;
  const audienceRequest = page.waitForRequest((request) => request.url().includes("days=30&category=admin"));
  await page.getByRole("button", { name: "Admin and staff", exact: true }).click();
  await audienceRequest;
});

test("stacks charts on mobile without horizontal overflow and handles empty data", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDashboard(page);
  await page.goto(`${uiUrl}/traffic-insights`);
  await expect(page.getByRole("list", { name: "Device page view breakdown" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Interactive world map of page views by city" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.unroute("**/api/**");
  await mockDashboard(page, true);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByText("No device data for this category yet.")).toBeVisible();
  await expect(page.getByText("No location data for this category yet.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Interactive world map of page views by city" })).toHaveCount(0);
});
