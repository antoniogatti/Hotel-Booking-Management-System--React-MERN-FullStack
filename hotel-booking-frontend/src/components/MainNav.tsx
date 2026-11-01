import { useEffect, useState } from "react";
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
import { ChevronDown, FileText, Activity, MessageCircle } from "lucide-react";
import { getHotelsSearchUrl } from "../lib/nav-utils";
import { siteConfig } from "../config/siteConfig";
import * as apiClient from "../api-client";

const NAV_AUTH_WIDTH = "min-w-[120px]";

const navLinkClass =
  "flex items-center text-[#2b4463] hover:text-[#ea836c] px-4 py-2 rounded-lg font-medium hover:bg-[#eef1e7] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aab09a] focus-visible:ring-offset-2 focus-visible:ring-offset-white";

const MainNav = () => {
  const { isLoggedIn, userRole } = useAppContext();
  const isAdminOrOwner = userRole === "admin" || userRole === "hotel_owner";
  const [unreadWA, setUnreadWA] = useState(0);

  useEffect(() => {
    if (!isAdminOrOwner) return;
    const check = async () => {
      try {
        const page = await apiClient.getWAConversations({ limit: 50 });
        setUnreadWA(page.conversations.filter((c) => c.unread).length);
      } catch { /* ignore */ }
    };
    void check();
    const id = setInterval(() => void check(), 15_000);
    return () => clearInterval(id);
  }, [isAdminOrOwner]);

  return (
    <nav className="flex items-center gap-1 lg:gap-2">
      <Link
        to={siteConfig.singlePropertyMode ? "/rooms" : getHotelsSearchUrl()}
        className={navLinkClass}
      >
        {siteConfig.singlePropertyMode ? "Rooms" : "Hotels"}
      </Link>
      <Link to="/contact-us" className={navLinkClass}>
        Contact
      </Link>
      <Link to="/our-recommendations" className={navLinkClass}>
        Local Tips
      </Link>
      <Link to="/reach-us" className={navLinkClass}>
        Directions
      </Link>

      {isAdminOrOwner && (
        <Link to="/wa-inbox" className={navLinkClass} title="WhatsApp Inbox">
          <span className="relative">
            <MessageCircle className="h-4 w-4 text-[#25D366]" />
            {unreadWA > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center leading-none">
                {unreadWA > 9 ? "9+" : unreadWA}
              </span>
            )}
          </span>
        </Link>
      )}

      {userRole === "admin" && (
        <>
          {!siteConfig.singlePropertyMode && (
            <Link to="/business-insights" className={navLinkClass}>
              Business Insights
            </Link>
          )}
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
