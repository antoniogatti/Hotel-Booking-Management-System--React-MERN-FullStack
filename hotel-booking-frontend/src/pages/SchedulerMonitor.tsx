import { useState } from "react";
import { useQuery } from "react-query";
import { CalendarDays, Clock3, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import * as apiClient from "../api-client";

const toDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateTime = (value?: string) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDuration = (durationMs: number) => {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "0s";
  }

  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
};

const statusBadgeClassName = (status: apiClient.SchedulerRunRow["status"]) => {
  switch (status) {
    case "success":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "failed":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "skipped":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
};

const SchedulerMonitor = () => {
  const [selectedDate, setSelectedDate] = useState<string>(toDateInputValue());

  const { data, isLoading, isError } = useQuery(
    ["bookingEnrichmentSchedulerRuns", selectedDate],
    () => apiClient.fetchBookingEnrichmentSchedulerRuns(selectedDate),
    {
      keepPreviousData: true,
    }
  );

  const runs = data?.runs || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Scheduler Monitor</h1>
          <p className="mt-2 text-sm text-slate-600">
            Review historical booking enrichment runs. This scheduler is inactive and no new runs will occur.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          <input
            type="date"
            className="text-sm text-gray-900"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            max={toDateInputValue()}
          />
        </div>
      </div>

      <Card className="border-slate-200 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
            <ShieldCheck className="h-5 w-5 text-slate-700" />
            Booking Enrichment Scheduler
          </CardTitle>
          <CardDescription>
            Authorized admin-only monitor. Date: {data?.date || selectedDate}. Time zone: {data?.timeZone || "Europe/Rome"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-gray-600">Total runs</p>
            <p className="text-xl font-semibold text-gray-900">{runs.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-gray-600">Success</p>
            <p className="text-xl font-semibold text-emerald-700">
              {runs.filter((run) => run.status === "success").length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-gray-600">Failed</p>
            <p className="text-xl font-semibold text-rose-700">
              {runs.filter((run) => run.status === "failed").length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-gray-600">Skipped</p>
            <p className="text-xl font-semibold text-amber-700">
              {runs.filter((run) => run.status === "skipped").length}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">Run history</CardTitle>
          <CardDescription>
            {isLoading ? "Loading scheduler runs..." : "Most recent runs first."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-gray-600">Loading scheduler runs...</p>
          ) : isError ? (
            <p className="text-sm text-rose-700">Unable to load scheduler history.</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-gray-600">No scheduler logs available for this day.</p>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <div key={run._id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900">{run.slotKey}</p>
                        <Badge className={statusBadgeClassName(run.status)}>{run.status}</Badge>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-700">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatDateTime(run.startedAt)}
                        </span>
                        <span>Duration: {formatDuration(run.durationMs)}</span>
                        <span>Processed: {run.processed}</span>
                        <span>Names: {run.enrichedNames}</span>
                        <span>Errors: {run.errors}</span>
                      </div>

                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SchedulerMonitor;
