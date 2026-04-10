import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "react-query";
import { Link } from "react-router-dom";
import { CalendarClock, RefreshCw, Save, Settings2, ExternalLink, Copy, KeyRound, Link2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { useQueryWithLoading } from "../hooks/useLoadingHooks";
import useAppContext from "../hooks/useAppContext";
import * as apiClient from "../api-client";

type RoomDraftState = Record<
  string,
  {
    importUrl: string;
    syncEnabled: boolean;
    exportEnabled: boolean;
  }
>;

const statusClassName = (status?: string) => {
  switch (status) {
    case "success":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "error":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "configured":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "skipped":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
};

const formatDateTime = (value?: Date | string) => {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Never";
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const BookingComSyncAdmin = () => {
  const { showToast } = useAppContext();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<RoomDraftState>({});

  const { data: rooms, isLoading: roomsLoading } = useQueryWithLoading(
    ["bookingManagementRooms"],
    apiClient.fetchBookingManagementRooms,
    {
      loadingMessage: "Loading Booking.com sync settings...",
    }
  );

  const roomDrafts = useMemo(() => {
    const nextDrafts: RoomDraftState = {};

    (rooms || []).forEach((room) => {
      nextDrafts[room._id] = {
        importUrl:
          drafts[room._id]?.importUrl ?? room.bookingComIcal?.importUrl ?? "",
        syncEnabled:
          drafts[room._id]?.syncEnabled ?? Boolean(room.bookingComIcal?.syncEnabled),
        exportEnabled:
          drafts[room._id]?.exportEnabled ?? Boolean(room.bookingComIcal?.exportEnabled),
      };
    });

    return nextDrafts;
  }, [drafts, rooms]);

  const syncErrorRows = useMemo(
    () =>
      (rooms || [])
        .flatMap((room) =>
          (room.bookingComIcal?.syncErrorHistory || []).map((entry, index) => ({
            key: `${room._id}-${entry.at}-${index}`,
            roomName: room.name,
            roomId: room._id,
            at: entry.at,
            status: entry.status,
            message: entry.message,
            isCurrent:
              room.bookingComIcal?.lastSyncStatus === "error" &&
              room.bookingComIcal?.lastSyncError === entry.message,
          }))
        )
        .sort(
          (left, right) =>
            new Date(right.at).getTime() - new Date(left.at).getTime()
        ),
    [rooms]
  );

  const saveConfigMutation = useMutation(apiClient.saveBookingComRoomConfig, {
    onSuccess: async () => {
      showToast({ title: "Booking.com room configuration saved", type: "SUCCESS" });
      await queryClient.invalidateQueries(["bookingManagementRooms"]);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message || "Unable to save Booking.com room configuration";
      showToast({ title: message, type: "ERROR" });
    },
  });

  const regenerateExportTokenMutation = useMutation(apiClient.regenerateBookingComExportToken, {
    onSuccess: async () => {
      showToast({ title: "Booking.com export token regenerated", type: "SUCCESS" });
      await queryClient.invalidateQueries(["bookingManagementRooms"]);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message || "Unable to regenerate Booking.com export token";
      showToast({ title: message, type: "ERROR" });
    },
  });

  const syncMutation = useMutation(apiClient.syncBookingComCalendars, {
    onSuccess: async (result: any) => {
      const count = Array.isArray(result?.results) ? result.results.length : 0;
      showToast({
        title: count > 1 ? `Synced ${count} Booking.com room feeds` : "Booking.com sync completed",
        type: "SUCCESS",
      });
      await queryClient.invalidateQueries(["bookingManagementRooms"]);
      await queryClient.invalidateQueries(["bookingRoomCalendar"]);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || "Unable to sync Booking.com calendars";
      showToast({ title: message, type: "ERROR" });
    },
  });

  const updateDraft = (hotelId: string, changes: Partial<RoomDraftState[string]>) => {
    setDrafts((current) => ({
      ...current,
      [hotelId]: {
        ...roomDrafts[hotelId],
        ...current[hotelId],
        ...changes,
      },
    }));
  };

  const handleSave = (hotelId: string) => {
    const draft = roomDrafts[hotelId];
    saveConfigMutation.mutate({
      hotelId,
      importUrl: draft.importUrl.trim(),
      syncEnabled: draft.syncEnabled,
      exportEnabled: draft.exportEnabled,
    });
  };

  const handleGenerateExportUrl = (hotelId: string) => {
    updateDraft(hotelId, { exportEnabled: true });
    regenerateExportTokenMutation.mutate(hotelId);
  };

  const getExportFeedUrl = (room: NonNullable<typeof rooms>[number]) => {
    if (!room.bookingComIcal?.exportEnabled || !room.bookingComIcal?.exportToken) {
      return "";
    }

    return `${apiClient.getApiBaseUrl()}/api/integrations/booking-com/export/${room._id}/${room.bookingComIcal.exportToken}.ics`;
  };

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast({ title: "Feed URL copied", type: "SUCCESS" });
    } catch {
      showToast({ title: "Unable to copy feed URL", type: "ERROR" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Booking.com Sync</h1>
          <p className="text-gray-600">
            Configure room feed URLs, review sync state, and trigger imports before checking room calendars.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => syncMutation.mutate({})}
            disabled={syncMutation.isLoading || roomsLoading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync All Rooms
          </Button>
          <Link to="/manage-bookings">
            <Button>
              <CalendarClock className="mr-2 h-4 w-4" />
              Open Manage Bookings
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Settings2 className="h-5 w-5 text-primary-600" />
            Control Panel
          </CardTitle>
          <CardDescription>
            Booking.com is currently the availability source of truth for these rooms. Cleanup should only run before a fresh baseline import.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">Sync cadence</p>
            <p className="text-lg font-semibold text-gray-900">Every 2 hours</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">Configured rooms</p>
            <p className="text-lg font-semibold text-gray-900">{rooms?.length || 0}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">Manual action</p>
            <p className="text-lg font-semibold text-gray-900">Sync now available</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 md:col-span-3">
            <p className="text-sm text-gray-600">Export behavior</p>
            <p className="text-lg font-semibold text-gray-900">
              Booking.com pulls our iCal feed. Imported Booking.com blocks are excluded to avoid sync loops.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card id="sync-errors">
        <CardHeader>
          <CardTitle className="text-xl">Sync Errors and History</CardTitle>
          <CardDescription>
            Current and past Booking.com sync errors are kept here for troubleshooting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {syncErrorRows.length === 0 ? (
            <p className="text-sm text-gray-600">No sync errors recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {syncErrorRows.map((entry) => (
                <div key={entry.key} className="rounded-lg border border-rose-200 bg-rose-50/60 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900">{entry.roomName}</p>
                        <Badge className={entry.isCurrent ? "bg-rose-100 text-rose-800 border-rose-200" : "bg-slate-100 text-slate-800 border-slate-200"}>
                          {entry.isCurrent ? "Current issue" : "History"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-gray-700">{entry.message}</p>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>{formatDateTime(entry.at)}</p>
                      <p className="capitalize">Status: {entry.status}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {(rooms || []).map((room) => {
          const draft = roomDrafts[room._id];
          const exportFeedUrl = getExportFeedUrl(room);

          return (
            <Card key={room._id}>
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-xl">{room.name}</CardTitle>
                  <CardDescription>
                    {room.city}, {room.country}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={statusClassName(room.bookingComIcal?.lastSyncStatus)}>
                    {room.bookingComIcal?.lastSyncStatus || "idle"}
                  </Badge>
                  <Badge className={draft?.syncEnabled ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-slate-100 text-slate-800 border-slate-200"}>
                    {draft?.syncEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                  <Badge className={exportFeedUrl ? "bg-blue-100 text-blue-800 border-blue-200" : "bg-slate-100 text-slate-800 border-slate-200"}>
                    {exportFeedUrl ? "Export URL ready" : "No export URL"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Booking.com iCal import URL</label>
                    <input
                      type="url"
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      value={draft?.importUrl || ""}
                      onChange={(event) => updateDraft(room._id, { importUrl: event.target.value })}
                      placeholder="https://ical.booking.com/v1/export?..."
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={Boolean(draft?.exportEnabled)}
                      onChange={(event) =>
                        updateDraft(room._id, { exportEnabled: event.target.checked })
                      }
                    />
                    Enable local iCal export for Booking.com pull sync
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={Boolean(draft?.syncEnabled)}
                      onChange={(event) =>
                        updateDraft(room._id, { syncEnabled: event.target.checked })
                      }
                    />
                    Enable Booking.com import for this room
                  </label>
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Local iCal export URL</label>
                    <div className="mt-1 flex flex-col gap-2 md:flex-row">
                      <input
                        type="text"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        value={exportFeedUrl}
                        readOnly
                        placeholder="Generate URL to make this feed available for Booking.com copy and paste"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="default"
                          onClick={() => handleGenerateExportUrl(room._id)}
                          disabled={regenerateExportTokenMutation.isLoading}
                        >
                          <Link2 className="mr-2 h-4 w-4" />
                          {exportFeedUrl ? "Refresh URL" : "Generate URL"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => copyToClipboard(exportFeedUrl)}
                          disabled={!exportFeedUrl}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copy
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => regenerateExportTokenMutation.mutate(room._id)}
                          disabled={regenerateExportTokenMutation.isLoading || !exportFeedUrl}
                        >
                          <KeyRound className="mr-2 h-4 w-4" />
                          Regenerate
                        </Button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Generate the URL here, then copy and paste it into Booking.com&apos;s calendar import field. Booking.com will pull it periodically rather than receiving an instant push.
                    </p>
                  </div>
                  <div className="grid gap-2 text-sm text-gray-600 md:grid-cols-2">
                    <p>Last sync: {formatDateTime(room.bookingComIcal?.lastSyncAt)}</p>
                    <p>Error: {room.bookingComIcal?.lastSyncError || "None"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch">
                  <Button
                    onClick={() => handleSave(room._id)}
                    disabled={saveConfigMutation.isLoading}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => syncMutation.mutate({ hotelId: room._id })}
                    disabled={syncMutation.isLoading || !draft?.syncEnabled}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Now
                  </Button>
                  <Link to="/manage-bookings">
                    <Button variant="outline" className="w-full">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Calendar
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default BookingComSyncAdmin;