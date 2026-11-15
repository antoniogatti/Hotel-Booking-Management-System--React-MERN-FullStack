const test = require("node:test");
const assert = require("node:assert/strict");
const appInsights = require("applicationinsights");
const telemetry = require("../src/lib/telemetry");

test("initializes the Application Insights SDK when configured", () => {
  const previous = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  process.env.APPLICATIONINSIGHTS_CONNECTION_STRING =
    "InstrumentationKey=00000000-0000-0000-0000-000000000001";
  try {
    telemetry.initializeTelemetry();
    assert.equal(telemetry.isTelemetryInitialized(), true);
  } finally {
    appInsights.dispose();
    if (previous === undefined) {
      delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    } else {
      process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = previous;
    }
  }
});
