import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "react-query";
import { ArrowLeft, Download, Eye, Trash2 } from "lucide-react";
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

const AdminSelfCheckinDetail = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const [fileAction, setFileAction] = useState<{
    fileId: string;
    action: "download" | "view";
  } | null>(null);

  const { data, isLoading } = useQuery(["selfCheckinAdminById", id], () =>
    apiClient.fetchSelfCheckinAdminById(id),
    { enabled: !!id }
  );

  const deleteMutation = useMutation(apiClient.deleteSelfCheckinAdminById, {
    onSuccess: () => {
      toast({
        title: "Deleted",
        description: "Self check-in submission removed.",
      });
      navigate("/admin-portal/self-checkins");
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Unable to delete submission.",
        variant: "destructive",
      });
    },
  });

  const onDelete = () => {
    if (!id || deleteMutation.isLoading) {
      return;
    }

    const accepted = window.confirm("Delete this self check-in submission? This cannot be undone.");
    if (!accepted) {
      return;
    }

    deleteMutation.mutate(id);
  };

  const fetchFileBlob = async (fileId: string) =>
    apiClient.downloadSelfCheckinAdminFile({
      checkinId: id,
      fileId,
    });

  const downloadFile = async (fileId: string, filename: string) => {
    try {
      setFileAction({ fileId, action: "download" });
      const blob = await fetchFileBlob(fileId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "Download failed",
        description: "Unable to download file.",
        variant: "destructive",
      });
    } finally {
      setFileAction(null);
    }
  };

  const viewFile = async (fileId: string) => {
    try {
      setFileAction({ fileId, action: "view" });
      const blob = await fetchFileBlob(fileId);
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch {
      toast({
        title: "Open failed",
        description: "Unable to open file preview.",
        variant: "destructive",
      });
    } finally {
      setFileAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <Link to="/admin-portal/self-checkins" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-800">
            <ArrowLeft className="h-4 w-4" />
            Back to submissions
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Self Check-In Details</h1>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleteMutation.isLoading}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {deleteMutation.isLoading ? "Deleting..." : "Delete submission"}
          </button>
        </div>

        {isLoading || !data ? (
          <div className="rounded-3xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
            Loading details...
          </div>
        ) : (
          <>
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <p className="text-xs uppercase tracking-wide text-slate-500">Submitted</p>
              <p className="text-sm text-slate-700">{formatDateTime(data.createdAt)}</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <p><strong>Primary guest:</strong> {data.fullName}</p>
                <p><strong>Nights:</strong> {data.numberOfNights}</p>
                <p><strong>Breakfast time:</strong> {data.breakfastTime}</p>
                <p><strong>Source code:</strong> {data.sourceCode || "-"}</p>
              </div>
            </div>

            <div className="space-y-4">
              {data.guests.map((guest, index) => (
                <article key={`${guest.givenName}-${guest.familyName}-${index}`} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900">Guest {index + 1}</h2>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <p><strong>Name:</strong> {guest.givenName} {guest.familyName}</p>
                    <p><strong>Breakfast:</strong> {guest.breakfastChoice}</p>
                    <p><strong>Document type:</strong> {guest.documentType}</p>
                    <p><strong>Document number:</strong> {guest.documentNumber}</p>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-semibold text-slate-800">Uploaded files</p>
                    {guest.documents.length === 0 ? (
                      <p className="mt-1 text-sm text-slate-500">No files uploaded.</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {guest.documents.map((doc) => (
                          <div
                            key={doc.gridFsId}
                            className="w-full rounded-2xl border border-slate-300 px-2.5 py-2 sm:w-auto"
                          >
                            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                              <span className="block min-w-0 flex-1 truncate text-sm">{doc.filename}</span>
                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-xs"
                                  onClick={() => viewFile(doc.gridFsId)}
                                  disabled={
                                    fileAction?.fileId === doc.gridFsId && fileAction.action === "view"
                                  }
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  {fileAction?.fileId === doc.gridFsId && fileAction.action === "view"
                                    ? "Opening..."
                                    : "View"}
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-xs"
                                  onClick={() => downloadFile(doc.gridFsId, doc.filename)}
                                  disabled={
                                    fileAction?.fileId === doc.gridFsId && fileAction.action === "download"
                                  }
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  {fileAction?.fileId === doc.gridFsId && fileAction.action === "download"
                                    ? "Downloading..."
                                    : "Download"}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminSelfCheckinDetail;
