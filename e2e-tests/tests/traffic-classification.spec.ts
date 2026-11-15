import { test, expect } from "@playwright/test";
import { classifyTrafficPage } from "../../hotel-booking-frontend/src/lib/trafficPage";

test("separates customer, staff and other page views without exposing identifiers", () => {
  expect(classifyTrafficPage("/search", false)).toEqual({ path: "/search", category: "customer" });
  expect(classifyTrafficPage("/search", true)).toEqual({ path: "/search", category: "admin" });
  expect(classifyTrafficPage("/traffic-insights", true)).toEqual({ path: "/traffic-insights", category: "admin" });
  expect(classifyTrafficPage("/hotel/room123/checkout", false)).toEqual({ path: "/hotel/:hotelId/checkout", category: "customer" });
  expect(classifyTrafficPage("/booking/private-id", true)).toEqual({ path: "/booking/:bookingId", category: "admin" });
  expect(classifyTrafficPage("/unknown/private-id", false)).toEqual({ path: "/other", category: "other" });
  expect(classifyTrafficPage("/sign-in", false).category).toBe("other");
});
