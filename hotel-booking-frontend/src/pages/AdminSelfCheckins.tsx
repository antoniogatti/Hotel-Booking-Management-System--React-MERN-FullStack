import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { ArrowLeft, Eye, Trash2 } from "lucide-react";
import * as apiClient from "../api-client";
import { useToast } from "../hooks/use-toast";

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const AdminSelfCheckins = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(["selfCheckinsAdminList", 100, 0], () =>
    apiClient.fetchSelfCheckinAdminList({ limit: 100, skip: 0 })
  );

  const deleteMutation = useMutation(apiClient.deleteSelfCheckinAdminById, {
    onSuccess: () => {
      toast({
        title: "Deleted",
        description: "Self check-in submission removed.",
      });
      queryClient.invalidateQueries(["selfCheckinsAdminList"]);
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Unable to delete submission.",
        variant: "destructive",
      });
    },
  });

  const onDelete = (id: string) => {
    if (deleteMutation.isLoading) {
      return;
    }

    const accepted = window.confirm("Delete this self check-in submission? This cannot be undone.");
    if (!accepted) {
      return;
    }

    deleteMutation.mutate(id);
  };

  const items = data?.items || [];

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <Link to="/admin-portal" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-800">
            <ArrowLeft className="h-4 w-4" />
            Back to Admin Portal
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Self Check-In Submissions</h1>
          <p className="mt-2 text-sm text-slate-600">Table view of all guest self check-in submissions.</p>
        </div>

        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading submissions...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-500">No submissions found.</p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {items.map((item) => (
                  <article key={item._id} className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">{formatDateTime(item.createdAt)}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{item.fullName}</p>
                    <p className="text-sm text-slate-600">Breakfast: {item.breakfastTime}</p>
                    <p className="text-sm text-slate-600">Guests: {item.guests.length}</p>
                    <Link
                      to={`/admin-portal/self-checkins/${item._id}`}
                      className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-sm text-white"
                    >
                      <Eye className="h-4 w-4" />
                      Open details
                    </Link>
                    <button
                      type="button"
                      onClick={() => onDelete(item._id)}
                      disabled={deleteMutation.isLoading}
                      className="ml-2 mt-3 inline-flex items-center gap-2 rounded-full border border-rose-300 px-3 py-1.5 text-sm text-rose-700 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3">Submitted</th>
                      <th className="px-3 py-3">Guest</th>
                      <th className="px-3 py-3">Breakfast</th>
                      <th className="px-3 py-3">Guests</th>
                      <th className="px-3 py-3">Source</th>
                      <th className="px-3 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <tr key={item._id}>
                        <td className="px-3 py-3">{formatDateTime(item.createdAt)}</td>
                        <td className="px-3 py-3 font-medium text-slate-900">{item.fullName}</td>
                        <td className="px-3 py-3">{item.breakfastTime}</td>
                        <td className="px-3 py-3">{item.guests.length}</td>
                        <td className="px-3 py-3">{item.sourceCode || "-"}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/admin-portal/self-checkins/${item._id}`}
                              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs text-white"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Open
                            </Link>
                            <button
                              type="button"
                              onClick={() => onDelete(item._id)}
                              disabled={deleteMutation.isLoading}
                              className="inline-flex items-center gap-2 rounded-full border border-rose-300 px-3 py-1.5 text-xs text-rose-700 disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSelfCheckins;
