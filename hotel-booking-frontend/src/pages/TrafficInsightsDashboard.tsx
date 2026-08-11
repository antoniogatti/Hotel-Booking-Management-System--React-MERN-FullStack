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
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import {
  RefreshCw,
  Activity,
  Globe,
  Users,
  Gauge,
  ServerCrash,
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

  return "Verify backend Application Insights app id and API key, then retry.";
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
    latitude: number;
    longitude: number;
  }>;
  lastUpdated: string;
}

const PIE_COLORS = ["#0f766e", "#f97316", "#1d4ed8", "#6d28d9", "#b45309"];

const formatDay = (value: string) => {
  const date = new Date(value);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

const shortEndpoint = (value: string) => {
  if (!value) return "unknown";

  try {
    const url = new URL(value);
    return url.pathname;
  } catch {
    return value.length > 30 ? `${value.slice(0, 30)}...` : value;
  }
};

const formatPercent = (part: number, total: number) => {
  if (!total) return "0.0%";
  return `${((part / total) * 100).toFixed(1)}%`;
};

const TrafficInsightsDashboard = () => {
  const [days, setDays] = useState(7);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQueryWithLoading<TrafficInsightsData>(
    ["traffic-insights-dashboard", days],
    () => fetchTrafficInsightsDashboard(days),
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50">
            <RefreshCw className="h-6 w-6 animate-spin text-teal-700" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Loading live traffic telemetry</h2>
          <p className="mt-2 text-sm text-slate-600">
            Pulling page views, sessions, API health, and geolocation signals from Application Insights.
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-3xl border border-rose-200 bg-rose-50 p-10 text-center">
          <p className="text-lg font-semibold text-rose-700">Unable to load traffic insights</p>
          <p className="mt-2 text-sm text-rose-600">
            {errorMessage}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const failedRate = formatPercent(data.metrics.failedRequests24h, data.metrics.requestCount24h);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(20,184,166,0.14),_transparent_42%),linear-gradient(180deg,#f8fbfb_0%,#edf4f5_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700">
                <Globe className="h-4 w-4" />
                Traffic Insights
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Live public traffic dashboard</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Dedicated telemetry view for visitor traffic, device sessions, API status, and global IP-based activity.
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
          <p className="mt-4 text-xs text-slate-500">Last updated: {new Date(data.lastUpdated).toLocaleString("en-GB")}</p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-sm font-medium">Page Views (24h)</span>
              <Activity className="h-4 w-4 text-teal-600" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{data.metrics.pageViews24h}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-sm font-medium">Unique Visitors (24h)</span>
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{data.metrics.uniqueVisitors24h}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-sm font-medium">Public API Calls (24h)</span>
              <Gauge className="h-4 w-4 text-indigo-600" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{data.metrics.requestCount24h}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-sm font-medium">Failed API Rate</span>
              <ServerCrash className="h-4 w-4 text-rose-600" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{failedRate}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-sm font-medium">Avg API Duration</span>
              <Gauge className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{Math.round(data.metrics.avgApiDurationMs24h)} ms</p>
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
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Sessions by device</h2>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data.sessionsByDevice} dataKey="sessions" nameKey="device" outerRadius={95} label>
                  {data.sessionsByDevice.map((_, index) => (
                    <Cell key={`device-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, "Sessions"]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 text-sm text-slate-600">Total sessions: {totalDeviceSessions}</div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Recent public API success vs failures</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.recentApi}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="endpoint" tickFormatter={shortEndpoint} interval={0} angle={-18} textAnchor="end" height={70} />
                <YAxis />
                <Tooltip labelFormatter={shortEndpoint} />
                <Bar dataKey="successCount" stackId="a" fill="#16a34a" name="Success" />
                <Bar dataKey="failedCount" stackId="a" fill="#dc2626" name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Top public pages</h2>
            <div className="space-y-2">
              {data.topPages.map((row) => (
                <div key={row.path} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <span className="max-w-[75%] truncate text-sm text-slate-700">{row.path}</span>
                  <span className="text-sm font-semibold text-slate-900">{row.views}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Global map (IP geolocation clusters)</h2>
          <ResponsiveContainer width="100%" height={340}>
            <ScatterChart margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="longitude" name="Longitude" domain={[-180, 180]} tickCount={9} />
              <YAxis type="number" dataKey="latitude" name="Latitude" domain={[-90, 90]} tickCount={7} />
              <ZAxis type="number" dataKey="hits" range={[70, 600]} name="Hits" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                formatter={(value, name) => [value, name === "hits" ? "Hits" : name]}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload;
                  return row ? `${row.city}, ${row.country}` : "";
                }}
              />
              <Scatter data={data.geoTraffic} fill="#0f766e" />
            </ScatterChart>
          </ResponsiveContainer>
        </section>
      </div>
    </div>
  );
};

export default TrafficInsightsDashboard;
