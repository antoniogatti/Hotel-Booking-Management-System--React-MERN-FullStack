import { KeyboardEvent, PointerEvent, ReactNode, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

type SortValue = string | number | null | undefined;

export type PnlColumn<T> = {
  key: string;
  label: string;
  width?: number;
  align?: "left" | "right";
  rowHeader?: boolean;
  value?: (row: T) => SortValue;
  render: (row: T) => ReactNode;
};

const MIN_WIDTH = 88;
const MAX_WIDTH = 600;
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const PnlTable = <T,>({ label, columns, rows, rowKey }: {
  label: string;
  columns: PnlColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}) => {
  const [sort, setSort] = useState<{ key: string; direction: "ascending" | "descending" } | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const drag = useRef<{ key: string; x: number; width: number } | null>(null);
  const widthOf = (column: PnlColumn<T>) => widths[column.key] ?? column.width ?? 150;
  const resize = (key: string, value: number) => setWidths((previous) => ({
    ...previous,
    [key]: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(value))),
  }));
  const moveResize = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) resize(drag.current.key, drag.current.width + event.clientX - drag.current.x);
  };
  const keyboardResize = (event: KeyboardEvent<HTMLDivElement>, column: PnlColumn<T>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    resize(column.key, widthOf(column) + (event.key === "ArrowRight" ? 16 : -16));
  };
  const sortedColumn = columns.find((column) => column.key === sort?.key);
  const ordered = rows.map((row, index) => ({ row, index }));
  if (sort && sortedColumn?.value) {
    const value = sortedColumn.value;
    ordered.sort((left, right) => {
      const a = value(left.row);
      const b = value(right.row);
      const missingA = a === null || a === undefined || a === "";
      const missingB = b === null || b === undefined || b === "";
      if (missingA || missingB) return missingA === missingB ? left.index - right.index : missingA ? 1 : -1;
      const comparison = typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b));
      return (sort.direction === "ascending" ? comparison : -comparison) || left.index - right.index;
    });
  }

  return (
    <div className="mt-5">
      <p className="mb-2 text-xs text-slate-500">Select a heading to sort. Drag a column edge or use its arrow keys to resize.</p>
      <div role="region" aria-label={`${label} table`} tabIndex={0} className="overflow-x-auto rounded-lg border border-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">
        <table aria-label={label} className="table-fixed border-collapse text-left text-sm" style={{ width: columns.reduce((total, column) => total + widthOf(column), 0), minWidth: "100%" }}>
          <colgroup>{columns.map((column) => <col key={column.key} style={{ width: widthOf(column) }} />)}</colgroup>
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-600">
              {columns.map((column) => {
                const direction = sort?.key === column.key ? sort.direction : "none";
                const Icon = direction === "ascending" ? ArrowUp : direction === "descending" ? ArrowDown : ArrowUpDown;
                return (
                  <th key={column.key} scope="col" aria-sort={column.value ? direction : undefined} className="relative whitespace-normal break-words p-3 pr-5 align-top [overflow-wrap:anywhere]">
                    {column.value ? (
                      <button type="button" aria-label={`Sort by ${column.label}`} onClick={() => setSort({ key: column.key, direction: direction === "ascending" ? "descending" : "ascending" })} className={`flex w-full items-start gap-1 text-left font-semibold hover:text-teal-700 ${column.align === "right" ? "justify-end" : ""}`}>
                        <span>{column.label}</span><Icon aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
                      </button>
                    ) : column.label}
                    <div
                      role="separator" aria-label={`Resize ${column.label} column`} aria-orientation="vertical"
                      aria-valuemin={MIN_WIDTH} aria-valuemax={MAX_WIDTH} aria-valuenow={widthOf(column)}
                      tabIndex={0} title={`Resize ${column.label}`} style={{ touchAction: "none" }}
                      className="absolute inset-y-0 right-0 w-3 cursor-col-resize border-r border-slate-200 hover:border-teal-600 focus-visible:border-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
                      onKeyDown={(event) => keyboardResize(event, column)}
                      onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { key: column.key, x: event.clientX, width: widthOf(column) }; }}
                      onPointerMove={moveResize}
                      onPointerUp={() => { drag.current = null; }}
                      onPointerCancel={() => { drag.current = null; }}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ordered.map(({ row }) => (
              <tr key={rowKey(row)} className="hover:bg-slate-50">
                {columns.map((column) => {
                  const className = `whitespace-normal break-words p-3 align-top [overflow-wrap:anywhere] ${column.align === "right" ? "text-right" : "text-left"}`;
                  return column.rowHeader
                    ? <th key={column.key} scope="row" className={`${className} font-medium text-slate-800`}>{column.render(row)}</th>
                    : <td key={column.key} className={className}>{column.render(row)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PnlTable;
