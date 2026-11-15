export type TrafficCategory = "customer" | "admin" | "other";

const customerPages = new Set([
  "/", "/rooms", "/search", "/contact-us", "/self-checkin", "/reach-us",
  "/our-recommendations", "/privacy-cookie-policy", "/terms-conditions",
]);
const adminPages = new Set([
  "/api-docs", "/api-status", "/business-insights", "/my-hotels",
  "/admin-portal", "/admin-portal/check-in", "/admin-portal/self-checkins",
  "/booking-dashboard", "/vacancy-management", "/booking-com-sync",
  "/scheduler-monitor", "/n8n-workflows", "/traffic-insights", "/pnl", "/pnl/income",
  "/pnl/expenses", "/manage-bookings", "/wa-inbox", "/add-hotel",
]);

export const classifyTrafficPage = (pathname: string, isStaff: boolean): {
  path: string;
  category: TrafficCategory;
} => {
  let path = "/other";
  let category: TrafficCategory = "other";

  if (customerPages.has(pathname)) {
    path = pathname;
    category = "customer";
  } else if (/^\/rooms\/[^/]+$/.test(pathname)) {
    path = "/rooms/:roomSlug";
    category = "customer";
  } else if (/^\/detail\/[^/]+$/.test(pathname)) {
    path = "/detail/:hotelId";
    category = "customer";
  } else if (/^\/hotel\/[^/]+\/(booking|checkout)$/.test(pathname)) {
    path = pathname.replace(/^\/hotel\/[^/]+/, "/hotel/:hotelId");
    category = "customer";
  } else if (adminPages.has(pathname)) {
    path = pathname;
    category = "admin";
  } else if (/^\/admin-portal\/self-checkins\/[^/]+$/.test(pathname)) {
    path = "/admin-portal/self-checkins/:id";
    category = "admin";
  } else if (/^\/booking\/[^/]+$/.test(pathname)) {
    path = "/booking/:bookingId";
    category = "admin";
  } else if (/^\/edit-hotel\/[^/]+$/.test(pathname)) {
    path = "/edit-hotel/:hotelId";
    category = "admin";
  } else if (/^\/hotel\/[^/]+\/check-in\/[^/]+$/.test(pathname)) {
    path = "/hotel/:hotelId/check-in/:bookingId";
    category = "admin";
  } else if (pathname === "/sign-in" || pathname === "/auth/callback") {
    path = pathname;
  }

  return { path, category: isStaff ? "admin" : category };
};
