const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const User = require("../src/models/user").default;

process.env.JWT_SECRET_KEY = "local-test-secret";
process.env.N8N_MONITOR_ORIGIN = "https://n8n.example.test";
User.findById = (id) => ({ select: async () => ({ role: id === "admin" ? "admin" : "user" }) });
const app = express();
app.use(cookieParser());
app.use("/n8n-monitor", require("../src/routes/n8n-monitor").default);
const realFetch = global.fetch;
const calls = [];
let mode = "ok";
let server;
let baseUrl;
const token = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET_KEY);
const request = (userId) => realFetch(`${baseUrl}/n8n-monitor`, {
  headers: userId ? { Authorization: `Bearer ${token(userId)}` } : {},
});

test.before(async () => {
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith("/healthz")) {
      if (mode === "unhealthy") return Response.json({ status: "error" }, { status: 503 });
      return Response.json({ status: "ok" });
    }
    if (mode === "denied") return Response.json({ message: "denied" }, { status: 401 });
    if (mode === "invalid") return Response.json({ data: "not-an-array" });
    if (String(url).includes("/workflows?")) {
      return Response.json({
        data: [{ id: "w1", name: "Test", active: true, nodes: [{ secret: "private" }] }],
        nextCursor: "more",
      });
    }
    return Response.json({
      data: [{ id: "e1", workflowId: "w1", status: "error", startedAt: "2026-01-01T10:00:00Z", stoppedAt: null, data: { private: "private" } }],
      nextCursor: null,
    });
  };
  server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  global.fetch = realFetch;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});
test.beforeEach(() => {
  calls.length = 0;
  mode = "ok";
  delete process.env.N8N_API_KEY;
});

test("requires an admin before contacting n8n", async () => {
  assert.equal((await request()).status, 401);
  assert.equal((await request("user")).status, 403);
  assert.equal(calls.length, 0);
});

test("distinguishes a healthy service from an unconfigured workflow API", async () => {
  const response = await request("admin");
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.service, "healthy");
  assert.equal(data.api, "not_configured");
  assert.equal(calls.length, 1);
});

test("reads and sanitizes workflow and execution summaries", async () => {
  process.env.N8N_API_KEY = "test-key";
  const response = await request("admin");
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.api, "connected");
  assert.deepEqual(data.workflows, [{ id: "w1", name: "Test", active: true, updatedAt: null }]);
  assert.equal(data.executions[0].status, "error");
  assert.equal(data.workflowsTruncated, true);
  assert.equal(JSON.stringify(data).includes("private"), false);
  assert.equal(JSON.stringify(data).includes("test-key"), false);
  assert.equal(calls.filter((call) => call.options.headers?.["X-N8N-API-KEY"] === "test-key").length, 2);
});

test("surfaces API authorization and malformed response errors", async () => {
  process.env.N8N_API_KEY = "test-key";
  for (const value of ["denied", "invalid"]) {
    mode = value;
    const response = await request("admin");
    assert.equal(response.status, 502);
    assert.equal(JSON.stringify(await response.json()).includes("test-key"), false);
  }
});

test("reports unhealthy services and rejects insecure monitor origins", async () => {
  mode = "unhealthy";
  assert.equal((await request("admin")).status, 502);
  calls.length = 0;
  process.env.N8N_MONITOR_ORIGIN = "http://n8n.example.test";
  try {
    assert.equal((await request("admin")).status, 502);
    assert.equal(calls.length, 0);
  } finally {
    process.env.N8N_MONITOR_ORIGIN = "https://n8n.example.test";
  }
});
