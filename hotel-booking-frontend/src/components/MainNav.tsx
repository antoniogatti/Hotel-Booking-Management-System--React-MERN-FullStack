import { Button } from "./ui/button";
import UsernameMenu from "./UsernameMenu";
import { Link } from "react-router-dom";
import useAppContext from "../hooks/useAppContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ChevronDown, FileText, Activity } from "lucide-react";
import { getHotelsSearchUrl } from "../lib/nav-utils";
import { siteConfig } from "../config/siteConfig";

const NAV_AUTH_WIDTH = "min-w-[120px]";

const navLinkClass =
  "flex items-center text-[#2b4463] hover:text-[#ea836c] px-4 py-2 rounded-lg font-medium hover:bg-[#eef1e7] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aab09a] focus-visible:ring-offset-2 focus-visible:ring-offset-white";

const MainNav = () => {
  const { isLoggedIn, isOwnerOrAdmin } = useAppContext();

  return (
    <nav className="flex items-center gap-1 lg:gap-2">
      <Link to="/" className={navLinkClass}>
        Home
      </Link>
      <Link
        to={siteConfig.singlePropertyMode ? "/rooms" : getHotelsSearchUrl()}
        className={navLinkClass}
      >
        {siteConfig.singlePropertyMode ? "Rooms" : "Hotels"}
      </Link>
      <Link to="/my-bookings" className={navLinkClass}>
        My Bookings
      </Link>

      {isOwnerOrAdmin && (
        <>
          {!siteConfig.singlePropertyMode && (
            <Link to="/business-insights" className={navLinkClass}>
              Business Insights
            </Link>
          )}
          <Link to="/my-hotels" className={navLinkClass}>
            Manage Rooms
          </Link>

          {!siteConfig.singlePropertyMode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`${navLinkClass} flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-[#aab09a] focus:ring-offset-2 focus:ring-offset-white rounded-lg`}
                >
                  API
                  <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white">
                <DropdownMenuItem asChild>
                  <Link
                    to="/api-docs"
                    className="flex items-center gap-2 cursor-pointer text-gray-900"
                  >
                    <FileText className="h-4 w-4" />
                    API Docs
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/api-status"
                    className="flex items-center gap-2 cursor-pointer text-gray-900"
                  >
                    <Activity className="h-4 w-4" />
                    API Status
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </>
      )}

      <div className={`flex items-center justify-end ${NAV_AUTH_WIDTH}`}>
        {isLoggedIn ? (
          <UsernameMenu />
        ) : (
          <Link to="/sign-in">
            <Button
              variant="ghost"
              className="font-bold bg-[#ea836c] text-white hover:bg-[#db755f] border border-[#db755f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aab09a] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Log In
            </Button>
          </Link>
        )}
      </div>
    </nav>
  );
};

export default MainNav;
