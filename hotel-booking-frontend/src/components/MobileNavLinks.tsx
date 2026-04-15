import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import {
  FileText,
  Activity,
  BarChart3,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  LogIn,
  LogOut,
  Hotel,
  Mail,
  MapPin,
  Sparkles,
  Shield,
} from "lucide-react";
import useAppContext from "../hooks/useAppContext";
import { getHotelsSearchUrl } from "../lib/nav-utils";
import { siteConfig } from "../config/siteConfig";
import * as apiClient from "../api-client";

const linkClass =
  "flex w-full items-center gap-3 rounded-2xl px-3 py-3 font-bold text-gray-900 transition-colors hover:bg-[#f6f8f2] hover:text-primary-600";

const nestedLinkClass =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold text-slate-600 transition-colors hover:bg-[#f8fbf3] hover:text-[#2b4463]";

const sectionToggleClass =
  "flex w-full items-center justify-between rounded-2xl border border-[#e7e9df] bg-[#f8faf7] px-4 py-3 text-left text-[15px] font-semibold text-[#2b4463] transition-colors hover:bg-[#f1f6ed]";

type MobileNavLinksProps = {
  onNavigate?: () => void;
};

const MobileNavLinks = ({ onNavigate }: MobileNavLinksProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, userRole, isOwnerOrAdmin } = useAppContext();
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isApiOpen, setIsApiOpen] = useState(false);

  const email = localStorage.getItem("user_email");
  const name = localStorage.getItem("user_name") || "Palazzo Pinto";
  const avatar = localStorage.getItem("user_image") || apiClient.DEFAULT_PROFILE_IMAGE;

  const adminLinks = useMemo(
    () => [
      { to: "/admin-portal", label: "Admin Portal", icon: Shield },
      { to: "/admin-portal/check-in", label: "Check-In Desk", icon: CalendarClock },
      { to: "/manage-bookings", label: "Room Calendar", icon: CalendarDays },
      { to: "/booking-com-sync", label: "Sync Center", icon: Activity },
      ...(!siteConfig.singlePropertyMode
        ? [{ to: "/business-insights", label: "Business Insights", icon: BarChart3 }]
        : []),
    ],
    []
  );

  useEffect(() => {
    if (
      adminLinks.some(({ to }) =>
        to === "/admin-portal"
          ? location.pathname.startsWith("/admin-portal")
          : location.pathname.startsWith(to)
      )
    ) {
      setIsAdminOpen(true);
    }

    if (location.pathname.startsWith("/api-")) {
      setIsApiOpen(true);
    }
  }, [adminLinks, location.pathname]);

  const handleLogout = async () => {
    await apiClient.signOut();
    onNavigate?.();
    navigate("/");
    window.location.reload();
  };

  const isPathActive = (path: string) =>
    path === "/admin-portal"
      ? location.pathname.startsWith("/admin-portal")
      : location.pathname.startsWith(path);

  return (
    <div className="flex flex-col gap-1">
      <Link
        to={siteConfig.singlePropertyMode ? "/rooms" : getHotelsSearchUrl()}
        onClick={onNavigate}
        className={linkClass}
      >
        <Hotel className="h-4 w-4" />
        {siteConfig.singlePropertyMode ? "Rooms" : "Hotels"}
      </Link>
      <Link to="/contact-us" onClick={onNavigate} className={linkClass}>
        <Mail className="h-4 w-4" />
        Contact Us
      </Link>
      <Link to="/our-recommendations" onClick={onNavigate} className={linkClass}>
        <Sparkles className="h-4 w-4" />
        Our Recommendations
      </Link>
      <Link to="/reach-us" onClick={onNavigate} className={linkClass}>
        <MapPin className="h-4 w-4" />
        Reach Us
      </Link>

      <div className="h-px bg-border my-4" />

      <div className="min-h-[52px] flex items-center justify-center">
        {isLoggedIn ? (
          <div className="w-full space-y-4">
            <div className="rounded-[26px] border border-[#e7e9df] bg-white px-4 py-4 shadow-[0_12px_35px_rgba(43,68,99,0.08)]">
              <div className="flex items-center gap-3">
                <img
                  src={avatar}
                  alt={name}
                  className="h-12 w-12 rounded-full border-2 border-[#8ad8cf] object-cover"
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    event.currentTarget.src = apiClient.DEFAULT_PROFILE_IMAGE;
                  }}
                />
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-slate-900">{name}</p>
                  {email && <p className="truncate text-sm text-slate-500">{email}</p>}
                </div>
              </div>
            </div>

            {isOwnerOrAdmin && (
              <div className="space-y-2">
                <button
                  type="button"
                  className={sectionToggleClass}
                  onClick={() => setIsAdminOpen((current) => !current)}
                >
                  <span className="flex items-center gap-3">
                    <Shield className="h-4 w-4" />
                    Admin Tools
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isAdminOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isAdminOpen && (
                  <div className="space-y-1 rounded-[22px] border border-[#edf0e7] bg-[#fcfdfa] p-3">
                    {adminLinks.map(({ to, label, icon: Icon }) => (
                      <Link
                        key={to}
                        to={to}
                        onClick={onNavigate}
                        className={`${nestedLinkClass} ${isPathActive(to) ? "bg-[#eef4ea] text-[#2b4463]" : ""}`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </Link>
                    ))}

                    {!siteConfig.singlePropertyMode && userRole === "admin" && (
                      <div className="space-y-1 pt-1">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-500 transition-colors hover:bg-[#f3f7ef] hover:text-[#2b4463]"
                          onClick={() => setIsApiOpen((current) => !current)}
                        >
                          <span className="flex items-center gap-3">
                            <FileText className="h-4 w-4" />
                            API
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${isApiOpen ? "rotate-180" : ""}`}
                          />
                        </button>

                        {isApiOpen && (
                          <div className="space-y-1 border-l border-[#dde7d7] pl-3">
                            <Link
                              to="/api-docs"
                              onClick={onNavigate}
                              className={`${nestedLinkClass} ${isPathActive("/api-docs") ? "bg-[#eef4ea] text-[#2b4463]" : ""}`}
                            >
                              <FileText className="h-4 w-4" />
                              API Docs
                            </Link>
                            <Link
                              to="/api-status"
                              onClick={onNavigate}
                              className={`${nestedLinkClass} ${isPathActive("/api-status") ? "bg-[#eef4ea] text-[#2b4463]" : ""}`}
                            >
                              <Activity className="h-4 w-4" />
                              API Status
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <Button onClick={handleLogout} className="w-full font-bold">
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </Button>
          </div>
        ) : (
          <Link to="/sign-in" onClick={onNavigate} className="w-full">
            <Button className="w-full font-bold">
              <LogIn className="h-4 w-4 mr-2" />
              Log In
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
};

export default MobileNavLinks;
