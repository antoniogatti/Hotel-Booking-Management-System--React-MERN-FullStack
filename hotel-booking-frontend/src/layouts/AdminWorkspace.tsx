import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  BarChart3,
  BedDouble,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  ChevronDown,
  CircleDollarSign,
  FileCheck2,
  FileText,
  LayoutDashboard,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Server,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import useAppContext from "../hooks/useAppContext";
import { siteConfig } from "../config/siteConfig";

type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  matches?: (path: string) => boolean;
};

const workspaceItems: NavItem[] = [
  { label: "Overview", to: "/admin-portal", icon: LayoutDashboard, matches: (path) => path === "/admin-portal" },
  {
    label: "Check-in desk",
    to: "/admin-portal/check-in",
    icon: ClipboardCheck,
    matches: (path) =>
      path === "/admin-portal/check-in" || /^\/hotel\/[^/]+\/check-in\/[^/]+\/?$/.test(path),
  },
  { label: "Room calendar", to: "/manage-bookings", icon: CalendarDays, adminOnly: true },
  { label: "WhatsApp inbox", to: "/wa-inbox", icon: MessageCircle },
  { label: "Self check-in", to: "/admin-portal/self-checkins", icon: FileCheck2 },
  {
    label: "Bookings & analytics",
    to: "/booking-dashboard",
    icon: BarChart3,
    matches: (path) => path === "/booking-dashboard" || path.startsWith("/booking/"),
  },
  { label: "Vacancy management", to: "/vacancy-management", icon: BedDouble },
];

const administrationItems: NavItem[] = [
  { label: "Sync center", to: "/booking-com-sync", icon: RefreshCw, adminOnly: true },
  { label: "Scheduler", to: "/scheduler-monitor", icon: Clock3, adminOnly: true },
  { label: "Traffic insights", to: "/traffic-insights", icon: Activity, adminOnly: true },
  { label: "Business insights", to: "/business-insights", icon: BarChart3, adminOnly: true },
  { label: "API docs", to: "/api-docs", icon: FileText, adminOnly: true },
  { label: "API status", to: "/api-status", icon: Server, adminOnly: true },
];

const pnlItems: NavItem[] = [
  { label: "P&L overview", to: "/pnl", icon: LayoutDashboard, adminOnly: true },
  { label: "Income", to: "/pnl/income", icon: BarChart3, adminOnly: true },
  { label: "Expenses", to: "/pnl/expenses", icon: FileText, adminOnly: true },
];

const isItemActive = (item: NavItem, path: string) =>
  item.matches ? item.matches(path) : item.to === "/pnl" ? path === item.to : path === item.to || path.startsWith(`${item.to}/`);

const AdminWorkspace = ({ children }: { children: React.ReactNode }) => {
  const { userRole } = useAppContext();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("admin-sidebar-collapsed") === "true"
  );
  const [closedGroups, setClosedGroups] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("admin-sidebar-closed-groups") || "[]");
      return Array.isArray(saved) ? saved.filter((value): value is string => typeof value === "string") : [];
    } catch {
      return [];
    }
  });
  const toggleGroup = (label: string) => {
    setClosedGroups((previous) => {
      const next = previous.includes(label) ? previous.filter((value) => value !== label) : [...previous, label];
      localStorage.setItem("admin-sidebar-closed-groups", JSON.stringify(next));
      return next;
    });
  };
  const toggleSidebar = () => {
    const next = !collapsed;
    localStorage.setItem("admin-sidebar-collapsed", String(next));
    setCollapsed(next);
  };
  const visible = (items: NavItem[]) =>
    items.filter((item) => !item.adminOnly || userRole === "admin");
  const groups = [
    { label: "Workspace", icon: LayoutDashboard, items: visible(workspaceItems) },
    { label: "P&L management", icon: CircleDollarSign, items: visible(pnlItems) },
    { label: "Administration", icon: Settings2, items: visible(administrationItems) },
  ];

  const renderLink = (item: NavItem, mobile = false) => {
    const active = isItemActive(item, pathname);
    const Icon = item.icon;
    return (
      <Link
        key={item.to}
        to={item.to}
        title={!mobile && collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className={
          mobile
            ? `shrink-0 rounded-full px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 ${
                active ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
              }`
            : `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${collapsed ? "justify-center" : ""} ${
                active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`
        }
      >
        {!mobile && <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />}
        <span className={!mobile && collapsed ? "sr-only" : undefined}>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1680px] items-start">
        <aside className={`sticky top-[104px] hidden max-h-[calc(100vh-104px)] min-h-[calc(100vh-104px)] shrink-0 flex-col overflow-y-auto bg-[#111827] py-6 lg:flex ${collapsed ? "w-[72px] px-3" : "w-60 px-4"}`}>
          <div className={`mb-8 flex gap-3 ${collapsed ? "flex-col items-center" : "items-center px-2"}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
              <Building2 aria-hidden="true" className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{siteConfig.brand.shortName}</p>
                <p className="text-xs text-slate-400">Property workspace</p>
              </div>
            )}
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              aria-controls="admin-sidebar-navigation"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {collapsed ? <PanelLeftOpen aria-hidden="true" className="h-5 w-5" /> : <PanelLeftClose aria-hidden="true" className="h-5 w-5" />}
            </button>
          </div>
          <nav id="admin-sidebar-navigation" aria-label="Admin navigation" className="space-y-7">
            {groups.filter((group) => group.items.length > 0).map((group) => (
              <div key={group.label}>
                <button
                  type="button"
                  aria-expanded={!closedGroups.includes(group.label)}
                  aria-controls={`sidebar-group-${group.label.replace(/\W+/g, "-")}`}
                  aria-label={group.label}
                  title={collapsed ? group.label : undefined}
                  onClick={() => toggleGroup(group.label)}
                  className={`mb-2 flex w-full items-center rounded-lg px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${collapsed ? "justify-center" : "justify-between"}`}
                >
                  {collapsed ? <group.icon aria-hidden="true" className="h-4 w-4" /> : <><span>{group.label}</span><ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${closedGroups.includes(group.label) ? "-rotate-90" : ""}`} /></>}
                </button>
                <div id={`sidebar-group-${group.label.replace(/\W+/g, "-")}`} className="space-y-1" hidden={closedGroups.includes(group.label)}>{group.items.map((item) => renderLink(item))}</div>
              </div>
            ))}
          </nav>
          <div className={`mt-auto border-t border-white/10 pt-5 ${collapsed ? "sr-only" : "px-3"}`}>
            <p className="text-xs font-medium text-slate-300">{siteConfig.brand.fullName}</p>
            <p className="mt-1 text-[11px] text-slate-500">Admin workspace</p>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <nav aria-label="Admin navigation" className="space-y-2 px-4 pt-4 pb-2 sm:px-6 lg:hidden">
            {groups.filter((group) => group.items.length > 0).map((group) => (
              <div key={group.label}>
                <button type="button" aria-expanded={!closedGroups.includes(group.label)} aria-controls={`mobile-group-${group.label.replace(/\W+/g, "-")}`} onClick={() => toggleGroup(group.label)} className="flex w-full items-center justify-between py-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  {group.label}<ChevronDown aria-hidden="true" className={`h-4 w-4 ${closedGroups.includes(group.label) ? "-rotate-90" : ""}`} />
                </button>
                <div id={`mobile-group-${group.label.replace(/\W+/g, "-")}`} hidden={closedGroups.includes(group.label)} className={`${closedGroups.includes(group.label) ? "hidden" : "flex"} gap-2 overflow-x-auto pb-2`}>
                  {group.items.map((item) => renderLink(item, true))}
                </div>
              </div>
            ))}
          </nav>
          {children}
        </div>
      </div>
    </div>
  );
};

export default AdminWorkspace;
