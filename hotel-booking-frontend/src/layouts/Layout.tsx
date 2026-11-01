import Footer from "../components/Footer";
import Header from "../components/Header";
import { useLocation } from "react-router-dom";

interface Props {
  children: React.ReactNode;
}

const ADMIN_PATHS = [
  "/admin-portal",
  "/wa-inbox",
  "/manage-bookings",
  "/booking-com-sync",
  "/my-hotels",
  "/add-hotel",
  "/business-insights",
  "/api-docs",
  "/api-status",
];

const Layout = ({ children }: Props) => {
  const location = useLocation();
  const isHomePage = location.pathname === "/";
  const isAdminPage = ADMIN_PATHS.some((p) => location.pathname.startsWith(p));

  return (
    <div className="flex flex-col min-h-screen overflow-x-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:bg-white focus:text-[#2b4463] focus:px-4 focus:py-2 focus:rounded-md focus:shadow"
      >
        Skip to main content
      </a>
      <Header />
      <main id="main-content" className="flex-1">
        {isHomePage ? (
          <div>{children}</div>
        ) : isAdminPage ? (
          <div className="w-full">{children}</div>
        ) : (
          <div className="w-full px-3 sm:px-5 lg:px-8 py-6 sm:py-10">{children}</div>
        )}
      </main>
      {!isAdminPage && <Footer />}
    </div>
  );
};

export default Layout;
