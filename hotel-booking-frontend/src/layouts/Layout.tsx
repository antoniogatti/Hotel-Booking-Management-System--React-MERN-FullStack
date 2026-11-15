import Footer from "../components/Footer";
import Header from "../components/Header";
import AdminWorkspace from "./AdminWorkspace";
import { useLocation } from "react-router-dom";

interface Props {
  children: React.ReactNode;
  admin?: boolean;
}

const Layout = ({ children, admin = false }: Props) => {
  const location = useLocation();
  const isHomePage = location.pathname === "/";

  return (
    <div className={`flex min-h-screen flex-col ${admin ? "overflow-x-clip" : "overflow-x-hidden"}`}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:bg-white focus:text-[#2b4463] focus:px-4 focus:py-2 focus:rounded-md focus:shadow"
      >
        Skip to main content
      </a>
      <Header />
      <main id="main-content" className="flex-1">
        {admin ? (
          <AdminWorkspace>{children}</AdminWorkspace>
        ) : isHomePage ? (
          <div>{children}</div>
        ) : (
          <div className="w-full px-3 sm:px-5 lg:px-8 py-6 sm:py-10">{children}</div>
        )}
      </main>
      {!admin && <Footer />}
    </div>
  );
};

export default Layout;
