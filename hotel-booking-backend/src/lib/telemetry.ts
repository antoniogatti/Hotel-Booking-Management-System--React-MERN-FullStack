import appInsights from "applicationinsights";

let initialized = false;

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

  appInsights
    .setup(connectionString)
    .setAutoCollectRequests(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectPerformance(true, true)
    .setUseDiskRetryCaching(true)
    .setInternalLogging(false, false)
    .start();

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
  if (!appInsights.defaultClient) {
    return;
  }

  appInsights.defaultClient.trackEvent({
    name,
    properties,
    measurements,
  });
};
