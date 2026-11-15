import axiosInstance from "./api-client";

export type N8nMonitorResponse = {
  service: "healthy";
  origin: string;
  api: "not_configured" | "connected";
  message?: string;
  workflows: Array<{ id: string; name: string; active: boolean; updatedAt: string | null }>;
  executions: Array<{ id: string; workflowId: string; status: string; startedAt: string | null; stoppedAt: string | null }>;
  workflowsTruncated?: boolean;
  executionsTruncated?: boolean;
};

export const fetchN8nMonitor = async (): Promise<N8nMonitorResponse> => {
  const response = await axiosInstance.get<N8nMonitorResponse>("/api/n8n-monitor");
  return response.data;
};
