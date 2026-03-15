import Footer from "../components/Footer";
import Header from "../components/Header";
import { useLocation } from "react-router-dom";
// import Hero from "../components/Hero";
// import SearchBar from "../components/SearchBar";

interface Props {
  children: React.ReactNode;
}

const Layout = ({ children }: Props) => {
  const location = useLocation();
  // const isBusinessInsightsPage = location.pathname === "/business-insights";
  // const isSearchPage = location.pathname === "/search";
  const isHomePage = location.pathname === "/";

  return (
    <div className="flex flex-col min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:bg-white focus:text-[#2b4463] focus:px-4 focus:py-2 focus:rounded-md focus:shadow"
      >
        Skip to main content
      </a>
      <Header />
      {/* <Hero /> */}
      {/* <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
        <SearchBar />
      </div> */}
      <main id="main-content" className="flex-1">
        {isHomePage ? (
          <div>{children}</div>
        ) : (
          <div className="w-full px-2 sm:px-6 lg:px-8 py-10">{children}</div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
