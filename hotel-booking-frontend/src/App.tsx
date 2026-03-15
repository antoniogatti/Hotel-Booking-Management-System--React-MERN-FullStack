import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useEffect } from "react";
import Layout from "./layouts/Layout";
import AuthLayout from "./layouts/AuthLayout";
import ScrollToTop from "./components/ScrollToTop";
import { Toaster } from "./components/ui/toaster";
import SignIn from "./pages/SignIn";
import AddHotel from "./pages/AddHotel";
import useAppContext from "./hooks/useAppContext";
import MyHotels from "./pages/MyHotels";
import EditHotel from "./pages/EditHotel";
import Search from "./pages/Search";
import Detail from "./pages/Detail";
import Booking from "./pages/Booking";
import MyBookings from "./pages/MyBookings";
import Home from "./pages/Home";
import ApiDocs from "./pages/ApiDocs";
import ApiStatus from "./pages/ApiStatus";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import AuthCallback from "./pages/AuthCallback";
import PrivacyCookiePolicy from "./pages/PrivacyCookiePolicy";
import { siteConfig } from "./config/siteConfig";

const BRAND_NAME = "Palazzo Pinto B&B";

const getPageTitle = (pathname: string): string => {
  if (pathname === "/") return `${BRAND_NAME} | Home`;
  if (pathname === "/search") return `${BRAND_NAME} | Search Rooms`;
  if (pathname === "/rooms") return `${BRAND_NAME} | Rooms`;
  if (pathname.startsWith("/detail/")) return `${BRAND_NAME} | Room Details`;
  if (pathname === "/api-docs") return `${BRAND_NAME} | API Documentation`;
  if (pathname === "/api-status") return `${BRAND_NAME} | API Status`;
  if (pathname === "/privacy-cookie-policy") {
    return `${BRAND_NAME} | Privacy and Cookie Policy`;
  }
  if (pathname === "/business-insights") {
    return `${BRAND_NAME} | Business Insights`;
  }
  if (pathname === "/register") return `${BRAND_NAME} | Register`;
  if (pathname === "/sign-in") return `${BRAND_NAME} | Sign In`;
  if (pathname === "/auth/callback") return `${BRAND_NAME} | Sign In`;
  if (pathname === "/my-hotels") return `${BRAND_NAME} | My Properties`;
  if (pathname === "/my-bookings") return `${BRAND_NAME} | My Bookings`;
  if (pathname.startsWith("/hotel/") && pathname.endsWith("/booking")) {
    return `${BRAND_NAME} | Complete Booking`;
  }
  if (pathname === "/add-hotel") return `${BRAND_NAME} | Add Property`;
  if (pathname.startsWith("/edit-hotel/")) return `${BRAND_NAME} | Edit Property`;

  return `${BRAND_NAME} | Book Your Stay`;
};

const PageTitleManager = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = getPageTitle(location.pathname);
  }, [location.pathname]);

  return null;
};

const App = () => {
  const { isLoggedIn, isOwnerOrAdmin } = useAppContext();
  return (
    <Router>
      <PageTitleManager />
      <ScrollToTop />
      <Routes>
        <Route
          path="/"
          element={
            <Layout>
              <Home />
            </Layout>
          }
        />
        <Route
          path="/search"
          element={
            <Layout>
              <Search />
            </Layout>
          }
        />
        {siteConfig.singlePropertyMode && (
          <Route
            path="/rooms"
            element={
              <Layout>
                <Search />
              </Layout>
            }
          />
        )}
        <Route
          path="/detail/:hotelId"
          element={
            <Layout>
              <Detail />
            </Layout>
          }
        />
        <Route
          path="/api-docs"
          element={
            <Layout>
              <ApiDocs />
            </Layout>
          }
        />
        <Route
          path="/api-status"
          element={
            <Layout>
              <ApiStatus />
            </Layout>
          }
        />
        <Route
          path="/privacy-cookie-policy"
          element={
            <Layout>
              <PrivacyCookiePolicy />
            </Layout>
          }
        />
        <Route
          path="/business-insights"
          element={
            <Layout>
              <AnalyticsDashboard />
            </Layout>
          }
        />
        <Route
          path="/register"
          element={<Navigate to="/sign-in" />}
        />
        <Route
          path="/sign-in"
          element={
            <AuthLayout>
              <SignIn />
            </AuthLayout>
          }
        />
        <Route
          path="/auth/callback"
          element={
            <Layout>
              <AuthCallback />
            </Layout>
          }
        />

        <Route
          path="/my-hotels"
          element={
            isOwnerOrAdmin ? (
              <Layout>
                <MyHotels />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/my-bookings"
          element={
            <Layout>
              <MyBookings />
            </Layout>
          }
        />

        {isLoggedIn && (
          <>
            <Route
              path="/hotel/:hotelId/booking"
              element={
                <Layout>
                  <Booking />
                </Layout>
              }
            />
            {isOwnerOrAdmin && (
              <>
                <Route
                  path="/add-hotel"
                  element={
                    <Layout>
                      <AddHotel />
                    </Layout>
                  }
                />
                <Route
                  path="/edit-hotel/:hotelId"
                  element={
                    <Layout>
                      <EditHotel />
                    </Layout>
                  }
                />
              </>
            )}
          </>
        )}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <Toaster />
    </Router>
  );
};

export default App;
