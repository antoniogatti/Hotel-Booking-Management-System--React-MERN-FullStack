import express from "express";
import verifyToken from "../middleware/auth";
import requireRole from "../middleware/requireRole";
import { logError } from "../lib/logger";

const router = express.Router();
const defaultOrigin = "https://n8n-palazzopinto.azurewebsites.net";

type N8nPage = { data: unknown[]; nextCursor?: string | null };
type N8nWorkflow = { id: string; name: string; active: boolean; updatedAt: string | null };
type N8nExecution = { id: string; workflowId: string; status: string; startedAt: string | null; stoppedAt: string | null };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readPage = (value: unknown): N8nPage => {
  if (!isRecord(value) || !Array.isArray(value.data) ||
      (value.nextCursor != null && typeof value.nextCursor !== "string")) {
    throw new Error("Invalid n8n API response");
  }
  return { data: value.data, nextCursor: typeof value.nextCursor === "string" ? value.nextCursor : null };
};

const nullableString = (value: unknown) => typeof value === "string" ? value : null;

const readWorkflows = (page: N8nPage): N8nWorkflow[] => page.data.map((item) => {
  if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string" ||
      (typeof item.active !== "boolean" && item.activeVersionId === undefined) ||
      (item.activeVersionId !== undefined && item.activeVersionId !== null && typeof item.activeVersionId !== "string")) {
    throw new Error("Invalid n8n workflow response");
  }
  return {
    id: item.id,
    name: item.name,
    active: item.activeVersionId !== undefined ? item.activeVersionId !== null : item.active === true,
    updatedAt: nullableString(item.updatedAt),
  };
});

const readExecutions = (page: N8nPage): N8nExecution[] => page.data.map((item) => {
  if (!isRecord(item) || typeof item.id !== "string" || typeof item.workflowId !== "string" ||
      typeof item.status !== "string") {
    throw new Error("Invalid n8n execution response");
  }
  return {
    id: item.id,
    workflowId: item.workflowId,
    status: item.status,
    startedAt: nullableString(item.startedAt),
    stoppedAt: nullableString(item.stoppedAt),
  };
});

router.get("/", verifyToken, requireRole("admin"), async (_req, res) => {
  try {
    const origin = new URL(process.env.N8N_MONITOR_ORIGIN || defaultOrigin);
    if (origin.protocol !== "https:" || origin.username || origin.password ||
        origin.pathname !== "/" || origin.search || origin.hash) {
      throw new Error("N8N_MONITOR_ORIGIN must be an HTTPS origin without a path");
    }

    const healthResponse = await fetch(new URL("/healthz", origin), {
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (!healthResponse.ok) throw new Error(`n8n health check returned ${healthResponse.status}`);
    const health: unknown = await healthResponse.json();
    if (!isRecord(health) || health.status !== "ok") throw new Error("n8n health check did not report ok");

    const apiKey = process.env.N8N_API_KEY?.trim();
    if (!apiKey) {
      return res.json({
        service: "healthy",
        origin: origin.origin,
        api: "not_configured",
        message: "Configure a read-only n8n API key to see workflows and executions.",
        workflows: [],
        executions: [],
      });
    }

    const getPage = async (path: string) => {
      const response = await fetch(new URL(path, origin), {
        headers: { "X-N8N-API-KEY": apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      });
      if (!response.ok) throw new Error(`n8n API returned ${response.status}`);
      return readPage(await response.json());
    };
    const [workflowPage, executionPage] = await Promise.all([
      getPage("/api/v1/workflows?limit=250&excludePinnedData=true"),
      getPage("/api/v1/executions?limit=100&includeData=false"),
    ]);
    return res.json({
      service: "healthy",
      origin: origin.origin,
      api: "connected",
      workflows: readWorkflows(workflowPage),
      executions: readExecutions(executionPage),
      workflowsTruncated: !!workflowPage.nextCursor,
      executionsTruncated: !!executionPage.nextCursor,
    });
  } catch (error) {
    logError("Unable to fetch n8n workflow status", error);
    return res.status(502).json({ message: "Unable to check n8n. Verify its health, API key and permissions." });
  }
});

export default router;
