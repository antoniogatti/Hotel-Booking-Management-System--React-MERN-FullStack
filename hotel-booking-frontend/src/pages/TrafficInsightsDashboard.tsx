import { lazy, Suspense, useMemo, useState } from "react";
import axios from "axios";
import { useQueryWithLoading } from "../hooks/useLoadingHooks";
import { fetchTrafficInsightsDashboard, type TrafficInsightsDashboardResponse } from "../api-client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  RefreshCw,
  Activity,
  Globe,
  Users,
  Monitor,
  Smartphone,
  Tablet,
  CircleHelp,
} from "lucide-react";

const TrafficLocationMap = lazy(() => import("../components/TrafficLocationMap"));

const resolveErrorMessage = (error: unknown) => {
  const response = axios.isAxiosError<{ details?: string; message?: string }>(error) ? error.response : undefined;
  const details = response?.data?.details;
  const message = response?.data?.message;

  if (typeof details === "string" && details.trim().length > 0) {
    return details;
  }

  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }

  return "Verify the Application Insights app ID and API key or Azure identity read access, then retry.";
};

const PIE_COLORS = ["#0f766e", "#f97316", "#1d4ed8", "#6d28d9", "#b45309"];
const number = new Intl.NumberFormat("en-GB");
const percentage = (value: number, total: number) =>
  new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 1 }).format(total > 0 ? value / total : 0);

const RankingChart = ({ rows, color, emptyMessage }: {
  rows: Array<{ label: string; views: number }>;
  color: string;
  emptyMessage: string;
}) => {
  const max = Math.max(0, ...rows.map((row) => row.views));
  if (max === 0) return <p className="py-8 text-center text-sm text-slate-500">{emptyMessage}</p>;
  return (
    <ol className="space-y-4" aria-label="Ranked page views">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1.5 flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0 break-words text-slate-700 [overflow-wrap:anywhere]">{row.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-900">{number.format(row.views)}<span className="sr-only"> page views</span></span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <div className="h-full rounded-full" style={{ width: `${row.views / max * 100}%`, backgroundColor: color }} />
          </div>
        </li>
      ))}
    </ol>
  );
};

const formatDay = (value: string) => {
  const date = new Date(value);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

const TrafficInsightsDashboard = () => {
  const [days, setDays] = useState(7);
  const [category, setCategory] = useState<"customer" | "admin" | "other">("customer");

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQueryWithLoading<TrafficInsightsDashboardResponse>(
    ["traffic-insights-dashboard", days, category],
    () => fetchTrafficInsightsDashboard(days, category),
    {
      retry: 2,
      retryDelay: 1000,
      loadingMessage: "Loading traffic insights dashboard...",
    }
  );

  const totalDeviceSessions = useMemo(() => {
    return (data?.sessionsByDevice || []).reduce((sum, row) => sum + row.sessions, 0);
  }, [data?.sessionsByDevice]);

  const deviceRows = useMemo(() =>
    [...(data?.sessionsByDevice || [])].sort((a, b) => b.sessions - a.sessions),
  [data?.sessionsByDevice]);
  const countries = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of data?.geoTraffic || []) totals.set(row.country, (totals.get(row.country) || 0) + row.hits);
    return [...totals].map(([label, views]) => ({ label, views })).sort((a, b) => b.views - a.views);
  }, [data?.geoTraffic]);
  const cities = useMemo(() =>
    [...(data?.geoTraffic || [])].sort((a, b) => b.hits - a.hits).map((row) => ({
      label: `${row.city || "Unknown city"}, ${row.country}`,
      views: row.hits,
    })),
  [data?.geoTraffic]);

  const errorMessage = useMemo(() => resolveErrorMessage(error), [error]);

  return (
    <div className="min-h-screen bg-[#f5f6f8] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <Globe className="h-4 w-4" />
                Traffic Insights
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Website traffic dashboard</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Page views are separated by audience. Staff browsing public pages counts as admin traffic when signed in; signed-out staff may count as customers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label="Date range"
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-teal-700"
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
              </select>

              <button
                onClick={() => refetch()}
                className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Traffic category">
            {([
              ["customer", "Customer traffic"],
              ["admin", "Admin and staff"],
              ["other", "Other and unclassified"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={category === value}
                onClick={() => setCategory(value)}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold ${category === value ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Older page views cannot be reliably identified as customer or staff and are shown under Other. Categories apply to new page views only; search and error telemetry in Application Insights is not audience-filtered.
          </p>
          {data && <p className="mt-4 text-xs text-slate-500">Last updated: {new Date(data.lastUpdated).toLocaleString("en-GB")}</p>}
        </section>

        {isLoading ? (
          <div role="status" className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600">
            Loading page views and locations...
          </div>
        ) : error || !data ? (
          <div role="alert" className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <p className="text-lg font-semibold text-rose-700">Unable to load traffic insights</p>
            <p className="mt-2 text-sm text-rose-600">{errorMessage}</p>
            <button onClick={() => refetch()} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Retry
            </button>
          </div>
        ) : (
        <>
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-sm font-medium">Page Views (24h)</span>
              <Activity className="h-4 w-4 text-teal-600" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{data.metrics.pageViews24h}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-sm font-medium">Unique IP addresses (24h)</span>
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{data.metrics.uniqueVisitors24h}</p>
          </div>

        </section>

        <p className="text-sm text-slate-600">Charts below cover the last {data.range.days} days for the selected audience. Summary cards above cover 24 hours.</p>
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Traffic by date</h2>
            {data.trafficByDate.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No page views for this category yet.</p> : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.trafficByDate}>
                <defs>
                  <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f766e" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#0f766e" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatDay} />
                <YAxis allowDecimals={false} width={45} />
                <Tooltip labelFormatter={formatDay} formatter={(value) => [number.format(Number(value)), "Page views"]} />
                <Area type="monotone" dataKey="pageViews" stroke="#0f766e" fill="url(#trafficFill)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>

          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Page views by device</h2>
            <p className="mt-1 text-xs text-slate-500">Share of page views, not unique visitors or sessions.</p>
            {totalDeviceSessions === 0 ? <p className="py-8 text-center text-sm text-slate-500">No device data for this category yet.</p> : (
            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative w-full min-w-0 sm:w-1/2" aria-hidden="true">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={deviceRows} dataKey="sessions" nameKey="device" innerRadius={65} outerRadius={90} paddingAngle={deviceRows.length > 1 ? 3 : 0} strokeWidth={0} isAnimationActive={false}>
                  {deviceRows.map((row, index) => (
                    <Cell key={row.device} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${number.format(Number(value))} (${percentage(Number(value), totalDeviceSessions)})`, "Page views"]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tabular-nums text-slate-900">{number.format(totalDeviceSessions)}</span>
              <span className="text-xs text-slate-500">page views</span>
            </div>
            </div>
            <ul className="w-full min-w-0 flex-1 space-y-4" aria-label="Device page view breakdown">
              {deviceRows.map((row, index) => {
                const Icon = row.device === "Desktop" ? Monitor : row.device === "Mobile" ? Smartphone : row.device === "Tablet" ? Tablet : CircleHelp;
                return (
                  <li key={row.device} className="flex items-center gap-3">
                    <span className="rounded-lg p-2" style={{ color: PIE_COLORS[index % PIE_COLORS.length], backgroundColor: `${PIE_COLORS[index % PIE_COLORS.length]}15` }}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1 text-sm font-medium text-slate-700">{row.device || "Unknown"}</div>
                    <div className="text-right text-sm tabular-nums">
                      <p className="font-semibold text-slate-900">{number.format(row.sessions)}<span className="sr-only"> page views</span></p>
                      <p className="text-xs text-slate-500">{percentage(row.sessions, totalDeviceSessions)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            </div>
            )}
            <p className="mt-3 text-xs text-slate-500">Total page views: {number.format(totalDeviceSessions)}. Device type is inferred from the browser user agent.</p>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Top pages</h2>
            <p className="mb-4 text-xs text-slate-500">Most viewed pages, ranked by page views.</p>
            <RankingChart rows={data.topPages.map((row) => ({ label: row.path, views: row.views }))} color="#0f766e" emptyMessage="No page views for this category yet." />
          </div>
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Top countries</h2>
            <p className="mb-4 text-xs text-slate-500">Page views by country among the top 100 city/country locations with available IP-based geography.</p>
            <RankingChart rows={countries.slice(0, 8)} color="#1d4ed8" emptyMessage="No country data for this category yet." />
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Visitors around the world</h2>
          <p className="mb-5 mt-1 text-sm text-slate-600">Explore the top 100 city/country locations by page views. IP-based geography is approximate and may be unavailable.</p>
          {data.geoTraffic.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No location data for this category yet.</p>
          ) : (
            <Suspense fallback={<p role="status" className="py-12 text-center text-slate-500">Loading interactive map...</p>}>
              <TrafficLocationMap locations={data.geoTraffic} />
            </Suspense>
          )}
          <div className="mt-6 border-t border-slate-200 pt-4">
            <h3 className="mb-4 text-base font-semibold text-slate-900">Top cities</h3>
            <RankingChart rows={cities.slice(0, 8)} color="#0f766e" emptyMessage="No city data for this category yet." />
          </div>
          <details className="mt-6 border-t border-slate-200 pt-4">
            <summary className="cursor-pointer rounded text-sm font-semibold text-slate-700 hover:text-teal-700 focus-visible:ring-2 focus-visible:ring-teal-700">All reported cities ({cities.length})</summary>
            <div className="mt-4 max-h-80 overflow-y-auto pr-2">
              <RankingChart rows={cities} color="#0f766e" emptyMessage="No city data for this category yet." />
            </div>
          </details>
        </section>
        </>
        )}
      </div>
    </div>
  );
};

export default TrafficInsightsDashboard;
