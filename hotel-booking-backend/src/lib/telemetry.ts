import appInsightsModule from "applicationinsights";

const appInsights =
  (appInsightsModule as any)?.setup
    ? (appInsightsModule as any)
    : (appInsightsModule as any)?.default;

let initialized = false;

const defaultPublicApiPrefixes = [
  "/api/health",
  "/api/contact",
  "/api/rooms",
  "/api/telemetry/page-view",
];

const getPublicApiPrefixes = () => {
  const configured = (process.env.PUBLIC_API_PATH_PREFIXES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : defaultPublicApiPrefixes;
};

const tryExtractPath = (value?: string): string => {
  if (!value) {
    return "";
  }

  try {
    // Absolute URL path extraction for request telemetry records.
    return new URL(value).pathname;
  } catch {
    // Fallback for request name patterns like "GET /api/contact".
    const parts = value.split(" ");
    if (parts.length > 1 && parts[1].startsWith("/")) {
      return parts[1];
    }

    return value.startsWith("/") ? value : "";
  }
};

const isPublicApiRequest = (envelope: any) => {
  const telemetryType = String(envelope?.data?.baseType || "");
  if (telemetryType !== "RequestData") {
    return true;
  }

  const baseData = envelope?.data?.baseData || {};
  const pathFromUrl = tryExtractPath(String(baseData.url || ""));
  const pathFromName = tryExtractPath(String(baseData.name || ""));
  const path = pathFromUrl || pathFromName;

  if (!path) {
    return false;
  }

  const publicPrefixes = getPublicApiPrefixes();
  return publicPrefixes.some((prefix) => path === prefix || path.startsWith(prefix));
};

const resolveConnectionString = (): string | undefined => {
  if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
    return process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  }

  if (process.env.APPINSIGHTS_CONNECTION_STRING) {
    return process.env.APPINSIGHTS_CONNECTION_STRING;
  }

  if (process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
    return `InstrumentationKey=${process.env.APPINSIGHTS_INSTRUMENTATIONKEY}`;
  }

  return undefined;
};

export const initializeTelemetry = () => {
  if (initialized) {
    return;
  }

  const connectionString = resolveConnectionString();
  if (!connectionString) {
    return;
  }

  if (!appInsights?.setup) {
    return;
  }

  appInsights
    .setup(connectionString)
    .setAutoCollectRequests(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectPerformance(true, true)
    .setUseDiskRetryCaching(true)
    .setInternalLogging(false, false)
    .start();

  appInsights.defaultClient?.addTelemetryProcessor((envelope) => {
    // Keep Request telemetry scoped to public API endpoints only.
    return isPublicApiRequest(envelope);
  });

  if (appInsights.defaultClient) {
    appInsights.defaultClient.context.tags[
      appInsights.defaultClient.context.keys.cloudRole
    ] = "hotel-booking-backend";
  }

  initialized = true;
};

export const trackTelemetryEvent = (
  name: string,
  properties?: Record<string, string>,
  measurements?: Record<string, number>
) => {
  if (!appInsights?.defaultClient) {
    return;
  }

  if (!appInsights.defaultClient) {
    return;
  }

  appInsights.defaultClient.trackEvent({
    name,
    properties,
    measurements,
  });
};

export const trackTelemetryException = (
  error: unknown,
  properties?: Record<string, string>
) => {
  if (!appInsights?.defaultClient) {
    return;
  }

  const normalizedError =
    error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");

  appInsights.defaultClient.trackException({
    exception: normalizedError,
    properties,
  });
};

export const isTelemetryInitialized = (): boolean => {
  return !!appInsights?.defaultClient;
};

export const sendTestEvent = (
  name: string,
  properties?: Record<string, string>,
  measurements?: Record<string, number>
): boolean => {
  if (!appInsights?.defaultClient) {
    return false;
  }

  try {
    appInsights.defaultClient.trackEvent({ name, properties, measurements });
    return true;
  } catch (e) {
    return false;
  }
};
