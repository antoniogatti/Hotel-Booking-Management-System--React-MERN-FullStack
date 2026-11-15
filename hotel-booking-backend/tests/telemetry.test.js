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

test("normalizes forwarded addresses for geographic enrichment", () => {
  const ip = telemetry.getClientIp({ headers: { "x-forwarded-for": "8.8.8.8:12345, 10.0.0.1" } });
  assert.equal(ip, "8.8.8.8");
  assert.deepEqual(telemetry.withClientIp({}, ip), { "microsoft.client.ip": "8.8.8.8" });
  assert.equal(telemetry.getClientIp({ headers: {}, ip: "[2001:4860:4860::8888]:443" }), "2001:4860:4860::8888");
  assert.deepEqual(telemetry.withClientIp({}, "not-an-ip"), {});
  assert.deepEqual(telemetry.withClientIp({}, "127.0.0.1"), {});
});
