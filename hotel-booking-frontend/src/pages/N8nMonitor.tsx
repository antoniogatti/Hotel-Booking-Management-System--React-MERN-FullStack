import { useQuery } from "react-query";
import { RefreshCw } from "lucide-react";
import { fetchN8nMonitor } from "../lib/n8n-monitor";

const formatDate = (value: string | null) => {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString("en-GB");
};

const N8nMonitor = () => {
  const { data, isLoading, isError, refetch, isFetching } = useQuery(
    "n8n-monitor", fetchN8nMonitor, { retry: false }
  );
  const names = new Map(data?.workflows.map((workflow) => [workflow.id, workflow.name]) || []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-950">n8n workflows</h1>
            <p className="mt-2 text-sm text-slate-600">Service health, workflow status and recent executions.</p>
          </div>
          <div className="flex gap-3">
            {data && <a href={data.origin} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">Open n8n</a>}
            <button type="button" onClick={() => refetch()} disabled={isFetching} className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </button>
          </div>
        </div>
      </section>
      {isLoading ? (
        <p role="status" className="rounded-2xl border border-slate-200 bg-white p-5">Checking n8n...</p>
      ) : isError || !data ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
          Unable to check n8n. Verify the service, API key and permissions, then retry.
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Service health</h2>
            <p className="mt-2 text-sm text-emerald-700">n8n health endpoint is responding.</p>
            <p className="mt-1 text-sm text-slate-600">A healthy service does not guarantee that workflows are active or succeeding.</p>
          </section>
          {data.api === "not_configured" ? (
            <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
              {data.message} Create a key with workflow:list and execution:list permissions in n8n, then configure N8N_API_KEY on the backend.
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-semibold">Workflows</h2>
                {data.workflowsTruncated && <p className="mt-2 text-sm text-amber-800">Showing the first 250 workflows.</p>}
                {data.workflows.length === 0 ? <p className="mt-3 text-sm text-slate-600">No workflows found.</p> : (
                  <ul className="mt-3 space-y-2">
                    {data.workflows.map((workflow) => (
                      <li key={workflow.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                        <span className="font-medium">{workflow.name}</span>
                        <span className={workflow.active ? "text-emerald-700" : "text-slate-600"}>{workflow.active ? "Active" : "Inactive"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-semibold">Recent executions</h2>
                <p className="mt-1 text-sm text-slate-600">Showing up to 100 saved executions. Workflows may not save every run.</p>
                {data.executions.length === 0 ? <p className="mt-3 text-sm text-slate-600">No saved executions found.</p> : (
                  <ul className="mt-3 space-y-2">
                    {data.executions.map((execution) => (
                      <li key={execution.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                        <span className="font-medium">{names.get(execution.workflowId) || "Workflow unavailable"}</span>
                        <span>{execution.status} · {formatDate(execution.startedAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default N8nMonitor;
