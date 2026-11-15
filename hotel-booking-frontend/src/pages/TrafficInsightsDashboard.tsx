import { useMemo, useState } from "react";
import { useQueryWithLoading } from "../hooks/useLoadingHooks";
import { fetchTrafficInsightsDashboard } from "../api-client";
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
} from "lucide-react";

const resolveErrorMessage = (error: unknown) => {
  const axiosError = error as any;
  const details = axiosError?.response?.data?.details;
  const message = axiosError?.response?.data?.message;

  if (typeof details === "string" && details.trim().length > 0) {
    return details;
  }

  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }

  return "Verify the Application Insights app ID and API key or Azure identity read access, then retry.";
};

interface TrafficInsightsData {
  range: {
    days: number;
  };
  metrics: {
    pageViews24h: number;
    uniqueVisitors24h: number;
    requestCount24h: number;
    failedRequests24h: number;
    avgApiDurationMs24h: number;
  };
  trafficByDate: Array<{
    date: string;
    pageViews: number;
  }>;
  sessionsByDevice: Array<{
    device: string;
    sessions: number;
  }>;
  topPages: Array<{
    path: string;
    views: number;
  }>;
  recentApi: Array<{
    endpoint: string;
    successCount: number;
    failedCount: number;
    avgDurationMs: number;
  }>;
  geoTraffic: Array<{
    country: string;
    city: string;
    hits: number;
    lastSeen: string | null;
  }>;
  lastUpdated: string;
}

const PIE_COLORS = ["#0f766e", "#f97316", "#1d4ed8", "#6d28d9", "#b45309"];

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
  } = useQueryWithLoading<TrafficInsightsData>(
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
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
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

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Traffic by date</h2>
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
                <YAxis />
                <Tooltip labelFormatter={formatDay} />
                <Area type="monotone" dataKey="pageViews" stroke="#0f766e" fill="url(#trafficFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Page views by device</h2>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data.sessionsByDevice} dataKey="sessions" nameKey="device" outerRadius={95} label>
                  {data.sessionsByDevice.map((_, index) => (
                    <Cell key={`device-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, "Page views"]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 text-sm text-slate-600">Total page views: {totalDeviceSessions}</div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Top pages</h2>
            <div className="space-y-2">
              {data.topPages.length === 0 && <p className="text-sm text-slate-500">No page views for this category yet.</p>}
              {data.topPages.map((row) => (
                <div key={row.path} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <span className="max-w-[75%] truncate text-sm text-slate-700">{row.path}</span>
                  <span className="text-sm font-semibold text-slate-900">{row.views}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Countries and cities</h2>
            <p className="mb-3 text-xs text-slate-500">Approximate IP-based location; some locations may be unavailable.</p>
            <div className="space-y-2">
              {data.geoTraffic.length === 0 && <p className="text-sm text-slate-500">No location data for this category yet.</p>}
              {data.geoTraffic.map((row) => (
                <div key={`${row.country}-${row.city}`} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <span className="text-sm text-slate-700">{row.city ? `${row.city}, ` : ""}{row.country}</span>
                  <span className="text-sm font-semibold text-slate-900">{row.hits}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        </>
        )}
      </div>
    </div>
  );
};

export default TrafficInsightsDashboard;
