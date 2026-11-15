const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const User = require("../src/models/user").default;
const telemetry = require("../src/lib/telemetry");

process.env.JWT_SECRET_KEY = "local-test-secret";
process.env.APPLICATIONINSIGHTS_APP_ID = "test-app";
process.env.APPLICATIONINSIGHTS_API_KEY = "test-key";
User.findById = () => ({ select: async () => ({ role: "admin" }) });

const app = express();
app.use(express.json(), cookieParser());
app.use("/telemetry", require("../src/routes/telemetry").default);
app.use("/traffic-insights", require("../src/routes/traffic-insights").default);
const realFetch = global.fetch;
const realTrackEvent = telemetry.trackTelemetryEvent;
const queries = [];
const events = [];
let server;
let url;

test.before(async () => {
  telemetry.trackTelemetryEvent = (name, properties) => events.push({ name, properties });
  global.fetch = (input, options) => {
    if (!String(input).startsWith("https://api.applicationinsights.io/")) return realFetch(input, options);
    const query = JSON.parse(options.body).query;
    queries.push(query);
    const rows = query.includes("pageCount24h") ? [[0, 0, 0, 0, 0]] : [];
    return Promise.resolve(new Response(JSON.stringify({ tables: [{ rows }] }), { status: 200 }));
  };
  server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  url = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  telemetry.trackTelemetryEvent = realTrackEvent;
  global.fetch = realFetch;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("records classified page views and preserves legacy events separately", async () => {
  for (const payload of [
    { path: "/search", trafficCategory: "customer" },
    { path: "/traffic-insights", trafficCategory: "admin" },
    { path: "/legacy" },
  ]) {
    const response = await realFetch(`${url}/telemetry/page-view`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    assert.equal(response.status, 204);
  }
  assert.deepEqual(events.map((event) => [event.name, event.properties.trafficCategory]), [
    ["page_view", "customer"], ["page_view", "admin"], ["public_page_view", undefined],
  ]);
  const invalid = await realFetch(`${url}/telemetry/page-view`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: "/", trafficCategory: "invalid" }),
  });
  assert.equal(invalid.status, 400);
});

test("dashboard enforces category filters and rejects invalid input", async () => {
  const headers = { authorization: `Bearer ${jwt.sign({ userId: "admin" }, process.env.JWT_SECRET_KEY)}` };
  for (const category of ["customer", "admin", "other"]) {
    queries.length = 0;
    const response = await realFetch(`${url}/traffic-insights/dashboard?category=${category}`, { headers });
    assert.equal(response.status, 200);
    const pageQueries = queries.filter((query) => query.includes("trafficCategory"));
    assert.equal(pageQueries.length, 5);
    assert.ok(pageQueries.every((query) => query.includes(`trafficCategory == "${category}"`)));
    assert.ok(pageQueries.every((query) => query.includes('name == "public_page_view", "other"')));
  }
  queries.length = 0;
  const invalid = await realFetch(`${url}/traffic-insights/dashboard?category=anything`, { headers });
  assert.equal(invalid.status, 400);
  assert.equal(queries.length, 0);
});
