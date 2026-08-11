import express, { Request, Response } from "express";
import verifyToken from "../middleware/auth";
import requireRole from "../middleware/requireRole";
import { logError } from "../lib/logger";

const router = express.Router();

const defaultPublicApiPrefixes = [
  "/api/health",
  "/api/contact",
  "/api/rooms",
  "/api/telemetry/page-view",
];

const getPublicApiPrefixes = () => {
  const configured = String(process.env.PUBLIC_API_PATH_PREFIXES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : defaultPublicApiPrefixes;
};

const getAppInsightsAppId = () => {
  const explicitAppId = (
    process.env.APPLICATIONINSIGHTS_APP_ID ||
    process.env.APPINSIGHTS_APP_ID ||
    process.env.APP_INSIGHTS_APP_ID ||
    ""
  ).trim();

  if (explicitAppId) {
    return explicitAppId;
  }

  const connectionString = String(
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING ||
      process.env.APPINSIGHTS_CONNECTION_STRING ||
      ""
  );

  const match = connectionString.match(/(?:^|;)\s*ApplicationId=([^;]+)/i);
  return match?.[1]?.trim() || "";
};

const getAppInsightsApiKey = () => {
  const rawKey = (
    process.env.APPLICATIONINSIGHTS_API_KEY ||
    process.env.APPINSIGHTS_API_KEY ||
    process.env.APP_INSIGHTS_API_KEY ||
    ""
  ).trim();

  // Ignore template placeholders so config issues are explicit in local/prod.
  if (!rawKey || /^replace_with_/i.test(rawKey)) {
    return "";
  }

  return rawKey;
};

const parseDays = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 7;
  }

  return Math.min(30, Math.max(1, Math.floor(parsed)));
};

const classifyDevice = (userAgent: string) => {
  const ua = String(userAgent || "").toLowerCase();
  if (!ua) {
    return "Unknown";
  }

  if (/(iphone|android|mobile|windows phone)/.test(ua)) {
    return "Mobile";
  }

  if (/(ipad|tablet)/.test(ua)) {
    return "Tablet";
  }

  return "Desktop";
};

type AppInsightsTable = {
  rows?: any[][];
};

type AppInsightsQueryResponse = {
  tables?: AppInsightsTable[];
};

const runAppInsightsQuery = async (appId: string, apiKey: string, query: string) => {
  const url = `https://api.applicationinsights.io/v1/apps/${encodeURIComponent(appId)}/query`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`App Insights query failed (${response.status}): ${body.slice(0, 400)}`);
  }

  const data = (await response.json()) as AppInsightsQueryResponse;
  return data.tables?.[0]?.rows || [];
};

router.get(
  "/dashboard",
  verifyToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const appId = getAppInsightsAppId();
    const apiKey = getAppInsightsApiKey();

    if (!appId || !apiKey) {
      const missingConfig: string[] = [];
      if (!appId) {
        missingConfig.push("APPLICATIONINSIGHTS_APP_ID (or ApplicationId in APPLICATIONINSIGHTS_CONNECTION_STRING)");
      }
      if (!apiKey) {
        missingConfig.push("APPLICATIONINSIGHTS_API_KEY");
      }

      return res.status(500).json({
        message: "Traffic Insights is not configured on backend environment variables.",
        details: `Missing: ${missingConfig.join(", ")}`,
      });
    }

    const days = parseDays(req.query.days);
    const apiPrefixes = getPublicApiPrefixes();
    const prefixFilter = apiPrefixes
      .map((prefix) => {
        const safePrefix = prefix.replace(/\"/g, '\\\"');
        return `url contains \"${safePrefix}\"`;
      })
      .join(" or ");

    try {
      const [
        trafficRows,
        pageRows,
        requestRows,
        geoRows,
        summaryRows,
        sessionRows,
      ] = await Promise.all([
        runAppInsightsQuery(
          appId,
          apiKey,
          `customEvents\n| where name == \"public_page_view\"\n| where timestamp >= ago(${days}d)\n| summarize pageCount = count() by day = bin(timestamp, 1d)\n| order by day asc`
        ),
        runAppInsightsQuery(
          appId,
          apiKey,
          `customEvents\n| where name == \"public_page_view\"\n| where timestamp >= ago(${days}d)\n| extend pagePath = tostring(customDimensions[\"path\"])\n| summarize viewCount = count() by pagePath\n| sort by viewCount desc\n| take 8`
        ),
        runAppInsightsQuery(
          appId,
          apiKey,
          `requests\n| where timestamp >= ago(${days}d)\n| where ${prefixFilter}\n| summarize successCount = countif(success == true), failedCount = countif(success == false), avgDurationMs = avg(duration) by endpoint = url\n| sort by failedCount desc\n| take 12`
        ),
        runAppInsightsQuery(
          appId,
          apiKey,
          `customEvents\n| where name == \"public_page_view\"\n| where timestamp >= ago(${days}d)\n| extend country = tostring(customDimensions[\"country\"]), city = tostring(customDimensions[\"city\"]), latitude = todouble(customDimensions[\"latitude\"]), longitude = todouble(customDimensions[\"longitude\"])\n| where isnotempty(country) and isnotempty(city)\n| summarize hitCount = count(), lastSeen = max(timestamp), latitude = any(latitude), longitude = any(longitude) by country, city\n| sort by hitCount desc\n| take 100`
        ),
        runAppInsightsQuery(
          appId,
          apiKey,
          `let publicPageEvents = customEvents\n| where name == \"public_page_view\"\n| where timestamp >= ago(24h);\nlet publicRequests = requests\n| where timestamp >= ago(24h)\n| where ${prefixFilter};\npublicPageEvents\n| summarize pageCount24h = count(), uniqueVisitors24h = dcount(tostring(customDimensions[\"ip\"]))\n| join kind=fullouter (publicRequests | summarize requestCount24h = count(), failedRequests24h = countif(success == false), avgApiDurationMs24h = avg(duration)) on $left.pageCount24h == $right.requestCount24h\n| project pageCount24h = coalesce(pageCount24h, 0), uniqueVisitors24h = coalesce(uniqueVisitors24h, 0), requestCount24h = coalesce(requestCount24h, 0), failedRequests24h = coalesce(failedRequests24h, 0), avgApiDurationMs24h = coalesce(avgApiDurationMs24h, 0.0)`
        ),
        runAppInsightsQuery(
          appId,
          apiKey,
          `customEvents\n| where name == \"public_page_view\"\n| where timestamp >= ago(${days}d)\n| project userAgent = tostring(customDimensions[\"userAgent\"]), sessionId = operation_Id\n| summarize sessions = dcount(sessionId) by userAgent`
        ),
      ]);

      const trafficByDate = trafficRows.map((row) => ({
        date: new Date(String(row[0])).toISOString().split("T")[0],
        pageViews: Number(row[1] || 0),
      }));

      const topPages = pageRows.map((row) => ({
        path: String(row[0] || "unknown"),
        views: Number(row[1] || 0),
      }));

      const recentApi = requestRows.map((row) => ({
        endpoint: String(row[0] || ""),
        successCount: Number(row[1] || 0),
        failedCount: Number(row[2] || 0),
        avgDurationMs: Number(row[3] || 0),
      }));

      const geoTraffic = geoRows
        .map((row) => ({
          country: String(row[0] || ""),
          city: String(row[1] || ""),
          hits: Number(row[2] || 0),
          lastSeen: row[3] ? new Date(String(row[3])).toISOString() : null,
          latitude: Number(row[4]),
          longitude: Number(row[5]),
        }))
        .filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));

      const metricsRow = summaryRows[0] || [0, 0, 0, 0, 0];
      const metrics = {
        pageViews24h: Number(metricsRow[0] || 0),
        uniqueVisitors24h: Number(metricsRow[1] || 0),
        requestCount24h: Number(metricsRow[2] || 0),
        failedRequests24h: Number(metricsRow[3] || 0),
        avgApiDurationMs24h: Number(metricsRow[4] || 0),
      };

      const deviceMap = sessionRows.reduce(
        (acc, row) => {
          const device = classifyDevice(String(row[0] || ""));
          acc[device] = (acc[device] || 0) + Number(row[1] || 0);
          return acc;
        },
        {} as Record<string, number>
      );

      const sessionsByDevice = Object.entries(deviceMap).map(([device, sessions]) => ({
        device,
        sessions,
      }));

      res.status(200).json({
        range: { days },
        metrics,
        trafficByDate,
        sessionsByDevice,
        topPages,
        recentApi,
        geoTraffic,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      logError("Failed to fetch traffic insights dashboard", error, {
        days,
      });

      res.status(500).json({
        message: "Failed to fetch traffic insights dashboard",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export default router;
