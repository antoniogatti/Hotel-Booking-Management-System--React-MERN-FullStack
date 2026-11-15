import { useEffect, useRef, useState } from "react";
import * as api from "../api-client";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";

type ViewColumn = { key: string; label: string; group: string };
type Group = { id: string; label: string };

const legacyGroups: Record<string, string[]> = {
  stay: ["roomId", "date", "checkOut", "guestName", "month", "nights", "guestCount"],
  booking: ["notes", "reference", "possibleBookings", "status", "includePossibleOverlap", "excludeFromTotals"],
  guest: ["phone", "email", "country", "identifier", "city", "guestDetails"],
  amounts: ["grossAmountCents", "sourceAmount", "unit", "netAmountCents", "paymentMethod", "taxQuarter"],
  invoices: ["invoiceNumber", "invoiceRequired", "invoiceCreated"],
};

export function moveGridColumn(columns: string[], from: string, to: string): string[] {
  const start = columns.indexOf(from);
  const end = columns.indexOf(to);
  if (start < 0 || end < 0 || start === end) return columns;
  const result = [...columns];
  result.splice(start, 1);
  result.splice(end, 0, from);
  return result;
}

function normalizeView(view: api.PnlGridLayout, columns: ViewColumn[], groups: Group[]): api.PnlGridLayout {
  const known = new Set(columns.map((column) => column.key));
  const order = view.columns.filter((key) => known.has(key));
  const addNotes = known.has("notes") && !order.includes("notes");
  const hiddenColumns = [...new Set([...(view.hiddenColumns ?? []), ...view.hiddenGroups.flatMap((id) => legacyGroups[id] ?? [])])].filter((key) => known.has(key));
  return {
    columns: [...(addNotes ? ["notes"] : []), ...order, ...columns.map((column) => column.key).filter((key) => key !== "notes" && !order.includes(key))],
    hiddenGroups: view.hiddenGroups.filter((key) => groups.some((group) => group.id === key)),
    hiddenColumns,
    frozenColumns: view.frozenColumns + (addNotes && view.frozenColumns > 0 &&
      !hiddenColumns.includes("notes") && !view.hiddenGroups.includes(columns.find((column) => column.key === "notes")!.group) &&
      (!view.colorFilter || view.colorFilter === "uncolored") ? 1 : 0),
    widths: Object.fromEntries(Object.entries(view.widths).filter(([key]) => known.has(key))),
    colorTags: view.colorTags ?? [],
    columnColors: Object.fromEntries(Object.entries(view.columnColors ?? {}).filter(([key]) => known.has(key))),
    colorFilter: view.colorFilter ?? "",
    columnFilters: Object.fromEntries(Object.entries(view.columnFilters ?? {}).filter(([key]) => known.has(key))),
  };
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
  const [savedDefault, setSavedDefault] = useState<api.PnlGridLayout | null>(null);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [baseline, setBaseline] = useState(() => JSON.stringify(defaultLayout));
  const [baselineName, setBaselineName] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [colorError, setColorError] = useState("");
  const [reload, setReload] = useState(0);
  const [fieldGroup, setFieldGroup] = useState("visible");
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const dirty = JSON.stringify(layout) !== baseline || (selected !== "" && name !== baselineName);
  const visibleCount = columns.filter((column) => {
    const color = layout.columnColors[column.key];
    return !layout.hiddenColumns.includes(column.key) && !layout.hiddenGroups.includes(column.group) &&
      (!layout.colorFilter || (layout.colorFilter === "uncolored" ? !color : color === layout.colorFilter));
  }).length;
  const usedColors = new Set(Object.values(layout.columnColors));
  const shownColumns = layout.columns.flatMap((key) => {
    const column = columns.find((item) => item.key === key);
    if (!column || (fieldGroup === "visible" && layout.hiddenGroups.includes(column.group)) ||
        (fieldGroup !== "visible" && fieldGroup !== "all" && column.group !== fieldGroup)) return [];
    return [column];
  });

  const changeColors = (keys: string[], color: string, colorTags = layout.colorTags) => {
    const columnColors = { ...layout.columnColors };
    for (const key of keys) {
      if (color) columnColors[key] = color;
      else delete columnColors[key];
    }
    const colorFilter = layout.colorFilter && layout.colorFilter !== "uncolored" && !Object.values(columnColors).includes(layout.colorFilter) ? "" :
      layout.colorFilter === "uncolored" && columns.every((item) => columnColors[item.key]) ? "" : layout.colorFilter;
    onChange({ ...layout, colorTags, columnColors, colorFilter });
  };

  const pickGroupColor = (group: Group, keys: string[], color: string) => {
    const existing = layout.colorTags.find((tag) => tag.color.toLowerCase() === color.toLowerCase());
    if (existing) {
      setColorError("");
      changeColors(keys, existing.id);
      return;
    }
    const prefix = `group-${group.id}-`;
    const reusable = layout.colorTags.find((tag) => tag.id.startsWith(prefix) &&
      Object.entries(layout.columnColors).every(([key, id]) => id !== tag.id || keys.includes(key)));
    if (reusable) {
      setColorError("");
      changeColors(keys, reusable.id, layout.colorTags.map((tag) => tag.id === reusable.id ? { ...tag, color } : tag));
      return;
    }
    if (layout.colorTags.length >= 20) {
      setColorError("This view already has 20 colors. Remove one or choose an existing color.");
      return;
    }
    const names = new Set(layout.colorTags.map((tag) => tag.name.trim().toLocaleLowerCase()));
    let name = group.label;
    let suffix = 2;
    while (names.has(name.toLocaleLowerCase())) name = `${group.label} ${suffix++}`;
    const tag = { id: `${prefix}${crypto.randomUUID()}`, name, color };
    setColorError("");
    changeColors(keys, tag.id, [...layout.colorTags, tag]);
  };

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setLoadFailed(false);
    api.fetchPnlGridViews().then(({ views: items, defaultView }) => {
      if (!active) return;
      const next = defaultView ? normalizeView(defaultView, columns, groups) : defaultLayout;
      setViews(items);
      setSavedDefault(defaultView ? next : null);
      setBaseline(JSON.stringify(next));
      if (JSON.stringify(layoutRef.current) === JSON.stringify(defaultLayout)) onChange(next);
    }).catch(() => {
      if (active) { setLoadFailed(true); setError("Could not load saved views. Retry before saving or selecting a view."); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload, columns, groups, defaultLayout, onChange]);

  const selectView = (id: string) => {
    if (dirty && !window.confirm("Discard unsaved view changes?")) return;
    const view = views.find((item) => item.id === id);
    if (id && !view) return;
    const next = view ? normalizeView(view, columns, groups) : savedDefault || defaultLayout;
    onChange(next);
    setSelected(id);
    setName(view?.name || "");
    setBaseline(JSON.stringify(next));
    setBaselineName(view?.name || "");
    setError("");
    setColorError("");
  };
  const validColorNames = () => {
    const colorNames = layout.colorTags.map((tag) => tag.name.trim().toLocaleLowerCase());
    if (colorNames.some((value) => !value) || new Set(colorNames).size !== colorNames.length) {
      setError("Give each color a unique, non-empty name before saving.");
      return false;
    }
    return true;
  };
  const save = async (asNew: boolean) => {
    if (!name.trim()) { setError("Enter a name for the view."); return; }
    if (!validColorNames()) return;
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
  const saveDefault = async () => {
    if (!validColorNames()) return;
    setBusy(true);
    setError("");
    try {
      const saved = normalizeView(await api.saveDefaultPnlGridView(layout), columns, groups);
      setSavedDefault(saved);
      setSelected("");
      setName("");
      setBaselineName("");
      setBaseline(JSON.stringify(saved));
    } catch {
      setError("Could not save the default view. Your changes are still available; retry saving.");
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
      const next = savedDefault || defaultLayout;
      onChange(next);
      setBaseline(JSON.stringify(next));
      setBaselineName("");
      setColorError("");
    } catch {
      setError("Could not delete this view. Try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <label>View <select aria-label="Income grid view" value={selected} disabled={loading || busy || loadFailed} onChange={(event) => selectView(event.target.value)} className="ml-1 rounded border border-slate-300 bg-white px-2 py-1">
          <option value="">Default</option>
          {views.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
        </select></label>
        <div role="group" aria-label="Quick group views" className="flex min-w-0 flex-wrap items-center gap-1">
          <Button size="sm" variant="outline" className="aria-pressed:bg-teal-700 aria-pressed:text-white" aria-pressed={layout.hiddenGroups.length === 0} onClick={() => onChange({ ...layout, hiddenGroups: [] })}>All groups</Button>
          {groups.map((group) => <Button key={group.id} size="sm" variant="outline" className="aria-pressed:bg-teal-700 aria-pressed:text-white" aria-pressed={!layout.hiddenGroups.includes(group.id)} onClick={() => onChange({ ...layout, hiddenGroups: layout.hiddenGroups.includes(group.id) ? layout.hiddenGroups.filter((id) => id !== group.id) : [...layout.hiddenGroups, group.id] })}>{group.label}</Button>)}
        </div>
        <Sheet>
          <SheetTrigger asChild><Button size="sm" variant="outline">Configure columns and groups</Button></SheetTrigger>
          <SheetContent overlayClassName="z-[110] bg-black/40" className="z-[120] w-full overflow-y-auto sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>Configure income view</SheetTitle>
              <SheetDescription>Save your view to keep column widths, order, colors and frozen columns.</SheetDescription>
            </SheetHeader>
            <div className="mt-4 flex flex-wrap items-end gap-2">
              <label>View name <input aria-label="View name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} className="ml-1 rounded border border-slate-300 px-2 py-1" /></label>
              {selected && <Button size="sm" variant="outline" disabled={busy || loading} onClick={() => void save(false)}>Save view</Button>}
              <Button size="sm" variant="outline" disabled={busy || loading || loadFailed} onClick={() => void saveDefault()}>Save as default</Button>
              <Button size="sm" variant="outline" disabled={busy || loading || loadFailed} onClick={() => void save(true)}>Save as new view</Button>
              {selected && <Button size="sm" variant="outline" disabled={busy} onClick={() => void remove()}>Delete view</Button>}
            </div>
            {error && <p role="alert" className="mt-2 text-rose-700">{error}</p>}
            {colorError && <p role="alert" className="mt-2 text-rose-700">{colorError}</p>}
            <div className="mt-4">
              <label>Freeze first visible columns <select aria-label="Freeze first visible columns" value={Math.min(layout.frozenColumns, visibleCount)} onChange={(event) => onChange({ ...layout, frozenColumns: Number(event.target.value) })} className="ml-1 rounded border border-slate-300 bg-white px-2 py-1">
                {Array.from({ length: visibleCount + 1 }, (_, index) => <option key={index} value={index}>{index}</option>)}
              </select></label>
            </div>
            <fieldset className="mt-4 space-y-2"><legend className="font-medium">Show groups and apply group colors</legend>
              {groups.map((group) => {
                const keys = columns.filter((column) => column.group === group.id).map((column) => column.key);
                const colors = new Set(keys.map((key) => layout.columnColors[key] || ""));
                const selectedColor = colors.size === 1 ? [...colors][0] : "__mixed";
                const pickerColor = layout.colorTags.find((tag) => tag.id === selectedColor)?.color || "#808080";
                return <div key={group.id} className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-1"><input type="checkbox" checked={!layout.hiddenGroups.includes(group.id)} onChange={(event) => {
                    const hiddenGroups = event.target.checked ? layout.hiddenGroups.filter((id) => id !== group.id) : [...layout.hiddenGroups, group.id];
                    onChange({ ...layout, hiddenGroups });
                  }} />{group.label}</label>
                  <div className="flex items-center gap-1">
                    <label className="flex items-center gap-1 text-xs text-slate-600">Pick
                      <input type="color" aria-label={`Pick color for ${group.label}`} value={pickerColor} onChange={(event) => pickGroupColor(group, keys, event.target.value)} className="h-8 w-10 cursor-pointer" />
                    </label>
                    <button type="button" aria-label={`Apply picker color to ${group.label}`} onClick={() => pickGroupColor(group, keys, pickerColor)} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">Apply</button>
                    <select aria-label={`Apply color to ${group.label}`} value={selectedColor} onChange={(event) => changeColors(keys, event.target.value)} className="max-w-36 rounded border border-slate-300 bg-white px-2 py-1">
                      {selectedColor === "__mixed" && <option value="__mixed" disabled>Mixed colors</option>}
                      <option value="">No color</option>
                      {layout.colorTags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name || "Unnamed color"}</option>)}
                    </select>
                  </div>
                </div>;
              })}
            </fieldset>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-3">
                <span className="font-medium">Column colors</span>
                <button type="button" disabled={layout.colorTags.length >= 20} className="rounded border border-slate-300 bg-white px-2 py-1 disabled:opacity-40" onClick={() => {
                  const names = new Set(layout.colorTags.map((tag) => tag.name.trim().toLocaleLowerCase()));
                  let index = 1;
                  while (names.has(`color ${index}`)) index++;
                  const palette = ["#2f80ed", "#27ae60", "#f2994a", "#9b51e0", "#eb5757"];
                  onChange({ ...layout, colorTags: [...layout.colorTags, { id: crypto.randomUUID(), name: `Color ${index}`, color: palette[(index - 1) % palette.length] }] });
                }}>Add color</button>
              </div>
              {layout.colorTags.map((tag, index) => <div key={tag.id} className="flex flex-wrap items-center gap-2">
                <label>Color name <input aria-label={`Color name ${index + 1}`} maxLength={50} value={tag.name} onChange={(event) => onChange({ ...layout, colorTags: layout.colorTags.map((item) => item.id === tag.id ? { ...item, name: event.target.value } : item) })} onBlur={() => onChange({ ...layout, colorTags: layout.colorTags.map((item) => item.id === tag.id ? { ...item, name: item.name.trim() } : item) })} className="ml-1 rounded border border-slate-300 px-2 py-1" /></label>
                <label>Color <input aria-label={`Color value ${index + 1}`} type="color" value={tag.color} onChange={(event) => onChange({ ...layout, colorTags: layout.colorTags.map((item) => item.id === tag.id ? { ...item, color: event.target.value } : item) })} className="ml-1 h-8 w-10 align-middle" /></label>
                <button type="button" aria-label={`Remove color ${tag.name || index + 1}`} className="rounded border border-slate-300 bg-white px-2 py-1" onClick={() => { setColorError(""); onChange({ ...layout, colorTags: layout.colorTags.filter((item) => item.id !== tag.id), columnColors: Object.fromEntries(Object.entries(layout.columnColors).filter(([, color]) => color !== tag.id)), colorFilter: layout.colorFilter === tag.id ? "" : layout.colorFilter }); }}>Remove</button>
              </div>)}
            </div>
            <p className="mt-4 text-xs text-slate-600">Pick a group color directly, or add a named color and apply it to a group or individual columns. Applying a group color replaces colors on all its columns. Uncheck columns to hide them. Drag headers in the grid or use the arrows to reorder.</p>
            <label className="mt-3 block">Filter fields by group <select aria-label="Filter fields by group" value={fieldGroup} onChange={(event) => setFieldGroup(event.target.value)} className="ml-1 rounded border border-slate-300 bg-white px-2 py-1">
              <option value="visible">Visible groups</option>
              <option value="all">All groups</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
            </select></label>
            {shownColumns.length === 0 && <p className="mt-2 text-slate-600">No fields in the selected groups.</p>}
            <ol aria-label="Column order" className="mt-2 space-y-1">
              {shownColumns.map((column, index) => {
                const key = column.key;
                return <li key={key} className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1">
                  <label className="flex flex-1 items-center gap-1"><input type="checkbox" aria-label={`Show ${column.label} column`} checked={!layout.hiddenColumns.includes(key)} onChange={(event) => {
                    const hiddenColumns = event.target.checked ? layout.hiddenColumns.filter((item) => item !== key) : [...layout.hiddenColumns, key];
                    onChange({ ...layout, hiddenColumns });
                  }} />{column.label}</label>
                  <select aria-label={`Color for ${column.label}`} value={layout.columnColors[column.key] || ""} onChange={(event) => changeColors([key], event.target.value)} className="max-w-28 rounded border border-slate-300 bg-white px-1 py-1">
                    <option value="">No color</option>
                    {layout.colorTags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name || "Unnamed color"}</option>)}
                  </select>
                  <button type="button" aria-label={`Move ${column.label} left`} disabled={index === 0} className="px-1 disabled:opacity-30" onClick={() => onChange({ ...layout, columns: moveGridColumn(layout.columns, key, shownColumns[index - 1].key) })}>←</button>
                  <button type="button" aria-label={`Move ${column.label} right`} disabled={index === shownColumns.length - 1} className="px-1 disabled:opacity-30" onClick={() => onChange({ ...layout, columns: moveGridColumn(layout.columns, key, shownColumns[index + 1].key) })}>→</button>
                </li>;
              })}
            </ol>
          </SheetContent>
        </Sheet>
        <span aria-live="polite" className="text-slate-600">{loading ? "Loading views…" : busy ? "Saving view…" : dirty ? "Unsaved view changes" : "View unchanged"}</span>
        <label>Filter columns by color <select aria-label="Filter columns by color" value={layout.colorFilter} onChange={(event) => onChange({ ...layout, colorFilter: event.target.value })} className="ml-1 rounded border border-slate-300 bg-white px-2 py-1">
          <option value="">All colors</option>
          {columns.some((column) => !layout.columnColors[column.key]) && <option value="uncolored">Uncolored</option>}
          {layout.colorTags.filter((tag) => usedColors.has(tag.id)).map((tag) => <option key={tag.id} value={tag.id}>{tag.name || "Unnamed color"}</option>)}
        </select></label>
        {Object.keys(layout.columnFilters).length > 0 && <span>
          {Object.keys(layout.columnFilters).length} value filter(s) active (including hidden columns).
          <button type="button" className="ml-2 underline" onClick={() => onChange({ ...layout, columnFilters: {} })}>Clear value filters</button>
        </span>}
      </div>
      {error && <p role="alert" className="mt-1 text-rose-700">{error} {loadFailed && <button type="button" className="underline" onClick={() => setReload((value) => value + 1)}>Retry</button>}</p>}
    </div>
  );
}
