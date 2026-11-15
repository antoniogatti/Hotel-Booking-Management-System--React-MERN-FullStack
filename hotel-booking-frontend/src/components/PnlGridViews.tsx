import { useEffect, useState } from "react";
import * as api from "../api-client";
import { Button } from "./ui/button";

type ViewColumn = { key: string; label: string; group: string };
type Group = { id: string; label: string };

export function moveGridColumn(columns: string[], from: string, to: string): string[] {
  const start = columns.indexOf(from);
  const end = columns.indexOf(to);
  if (start < 0 || end < 0 || start === end) return columns;
  const result = [...columns];
  result.splice(start, 1);
  result.splice(end, 0, from);
  return result;
}

export default function PnlGridViews({ layout, defaultLayout, columns, groups, onChange, onDirtyChange }: {
  layout: api.PnlGridLayout;
  defaultLayout: api.PnlGridLayout;
  columns: ViewColumn[];
  groups: Group[];
  onChange: (layout: api.PnlGridLayout) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [views, setViews] = useState<api.PnlGridView[]>([]);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [baseline, setBaseline] = useState(() => JSON.stringify(defaultLayout));
  const [baselineName, setBaselineName] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const dirty = JSON.stringify(layout) !== baseline || (selected !== "" && name !== baselineName);
  const visibleCount = columns.filter((column) => !layout.hiddenGroups.includes(column.group)).length;

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setLoadFailed(false);
    api.fetchPnlGridViews().then((items) => {
      if (active) setViews(items);
    }).catch(() => {
      if (active) { setLoadFailed(true); setError("Could not load saved views. Retry before saving or selecting a view."); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const normalize = (view: api.PnlGridLayout): api.PnlGridLayout => {
    const known = new Set(columns.map((column) => column.key));
    const order = view.columns.filter((key) => known.has(key));
    return {
      columns: [...order, ...columns.map((column) => column.key).filter((key) => !order.includes(key))],
      hiddenGroups: view.hiddenGroups.filter((key) => groups.some((group) => group.id === key)),
      frozenColumns: view.frozenColumns,
      widths: Object.fromEntries(Object.entries(view.widths).filter(([key]) => known.has(key))),
    };
  };
  const selectView = (id: string) => {
    if (dirty && !window.confirm("Discard unsaved view changes?")) return;
    const view = views.find((item) => item.id === id);
    if (id && !view) return;
    const next = view ? normalize(view) : defaultLayout;
    onChange(next);
    setSelected(id);
    setName(view?.name || "");
    setBaseline(JSON.stringify(next));
    setBaselineName(view?.name || "");
    setError("");
  };
  const save = async (asNew: boolean) => {
    if (!name.trim()) { setError("Enter a name for the view."); return; }
    if (views.some((view) => (asNew || view.id !== selected) && view.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase())) {
      setError("A view with this name already exists. Choose a different name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await api.savePnlGridView(name.trim(), layout, asNew ? undefined : selected);
      setViews((previous) => [...previous.filter((view) => view.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)));
      setSelected(saved.id);
      setName(saved.name);
      setBaselineName(saved.name);
      setBaseline(JSON.stringify(layout));
    } catch {
      setError("Could not save this view. Your changes are still available; retry saving.");
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!selected || !window.confirm("Delete this saved view?")) return;
    setBusy(true);
    setError("");
    try {
      await api.deletePnlGridView(selected);
      setViews((previous) => previous.filter((view) => view.id !== selected));
      setSelected("");
      setName("");
      onChange(defaultLayout);
      setBaseline(JSON.stringify(defaultLayout));
      setBaselineName("");
    } catch {
      setError("Could not delete this view. Try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <label>View <select aria-label="Income grid view" value={selected} disabled={loading || busy || loadFailed} onChange={(event) => selectView(event.target.value)} className="ml-1 rounded border border-slate-300 bg-white px-2 py-1">
          <option value="">Default</option>
          {views.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
        </select></label>
        <label>View name <input aria-label="View name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} className="ml-1 rounded border border-slate-300 px-2 py-1" /></label>
        {selected && <Button size="sm" variant="outline" disabled={busy || loading} onClick={() => void save(false)}>Save view</Button>}
        <Button size="sm" variant="outline" disabled={busy || loading || loadFailed} onClick={() => void save(true)}>Save as new view</Button>
        {selected && <Button size="sm" variant="outline" disabled={busy} onClick={() => void remove()}>Delete view</Button>}
        <span aria-live="polite" className="text-slate-600">{loading ? "Loading views…" : busy ? "Saving view…" : dirty ? "Unsaved view changes" : "View unchanged"}</span>
      </div>
      {error && <p role="alert" className="mt-1 text-rose-700">{error} {loadFailed && <button type="button" className="underline" onClick={() => setReload((value) => value + 1)}>Retry</button>}</p>}
      <details className="mt-2">
        <summary className="cursor-pointer font-semibold">Configure columns and groups</summary>
        <div className="mt-2 flex flex-wrap items-start gap-4">
          <fieldset className="flex flex-wrap gap-3"><legend className="font-medium">Show groups</legend>
            {groups.map((group) => <label key={group.id} className="flex items-center gap-1"><input type="checkbox" checked={!layout.hiddenGroups.includes(group.id)} onChange={(event) => {
              const hiddenGroups = event.target.checked ? layout.hiddenGroups.filter((id) => id !== group.id) : [...layout.hiddenGroups, group.id];
              const count = columns.filter((column) => !hiddenGroups.includes(column.group)).length;
              onChange({ ...layout, hiddenGroups, frozenColumns: Math.min(layout.frozenColumns, count) });
            }} />{group.label}</label>)}
          </fieldset>
          <label>Freeze first visible columns <select aria-label="Freeze first visible columns" value={Math.min(layout.frozenColumns, visibleCount)} onChange={(event) => onChange({ ...layout, frozenColumns: Number(event.target.value) })} className="ml-1 rounded border border-slate-300 bg-white px-2 py-1">
            {Array.from({ length: visibleCount + 1 }, (_, index) => <option key={index} value={index}>{index}</option>)}
          </select></label>
        </div>
        <p className="mt-2 text-xs text-slate-600">Drag column handles in the grid, or use these buttons to change the order. The first visible columns are frozen.</p>
        <ol aria-label="Column order" className="mt-2 flex max-h-40 flex-wrap gap-1 overflow-auto">
          {layout.columns.map((key, index) => {
            const column = columns.find((item) => item.key === key);
            if (!column) return null;
            return <li key={key} className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1">
              <span>{column.label}</span>
              <button type="button" aria-label={`Move ${column.label} left`} disabled={index === 0} className="px-1 disabled:opacity-30" onClick={() => onChange({ ...layout, columns: moveGridColumn(layout.columns, key, layout.columns[index - 1]) })}>←</button>
              <button type="button" aria-label={`Move ${column.label} right`} disabled={index === layout.columns.length - 1} className="px-1 disabled:opacity-30" onClick={() => onChange({ ...layout, columns: moveGridColumn(layout.columns, key, layout.columns[index + 1]) })}>→</button>
            </li>;
          })}
        </ol>
      </details>
    </div>
  );
}
