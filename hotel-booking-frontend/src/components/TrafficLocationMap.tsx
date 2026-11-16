import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TrafficInsightsDashboardResponse } from "../api-client";

type Location = TrafficInsightsDashboardResponse["geoTraffic"][number];
const number = new Intl.NumberFormat("en-GB");
const locationLabel = (row: Location) => `${row.city || "Unknown city"}, ${row.country}`;

const TrafficLocationMap = ({ locations }: { locations: Location[] }) => {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const [tileError, setTileError] = useState(false);
  const [selected, setSelected] = useState("");
  const mapped = locations.filter((row) => row.coordinates
    && Number.isFinite(row.coordinates.latitude) && Math.abs(row.coordinates.latitude) <= 90
    && Number.isFinite(row.coordinates.longitude) && Math.abs(row.coordinates.longitude) <= 180);
  const mappedViews = mapped.reduce((sum, row) => sum + row.hits, 0);
  const totalViews = locations.reduce((sum, row) => sum + row.hits, 0);

  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, { scrollWheelZoom: false, minZoom: 2, maxZoom: 12 })
      .setView([20, 0], 2);
    map.current = instance;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      noWrap: true,
    }).on("tileerror", () => setTileError(true)).addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const layer = L.layerGroup().addTo(instance);
    markers.current.clear();
    setSelected("");
    instance.setView([20, 0], 2, { animate: false });
    const maxHits = Math.max(1, ...locations.map((row) => row.hits));
    for (const row of locations) {
      const coordinates = row.coordinates;
      if (!coordinates || !Number.isFinite(coordinates.latitude) || Math.abs(coordinates.latitude) > 90
        || !Number.isFinite(coordinates.longitude) || Math.abs(coordinates.longitude) > 180) continue;
      const label = `${locationLabel(row)}: ${number.format(row.hits)} page views`;
      const size = 14 + 24 * Math.sqrt(row.hits / maxHits);
      const popup = document.createElement("p");
      popup.textContent = label;
      const marker = L.marker([coordinates.latitude, coordinates.longitude], {
        title: label,
        alt: label,
        icon: L.divIcon({
          className: "",
          html: '<span style="display:block;width:100%;height:100%;border-radius:50%;background:#0f766eaa;border:2px solid #fff;box-shadow:0 0 0 1px #0f766e"></span>',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
      }).bindPopup(popup).addTo(layer);
      markers.current.set(locationLabel(row), marker);
    }
    return () => { layer.remove(); markers.current.clear(); };
  }, [locations]);

  const reset = () => {
    setSelected("");
    map.current?.closePopup().setView([20, 0], 2, { animate: false });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor="traffic-map-city" className="mb-1 block text-sm font-medium text-slate-700">Explore a city</label>
          <select
            id="traffic-map-city"
            value={selected}
            className="w-full max-w-sm rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 focus-visible:ring-2 focus-visible:ring-teal-700"
            onChange={(event) => {
              const label = event.target.value;
              setSelected(label);
              if (!label) { reset(); return; }
              const marker = markers.current.get(label);
              if (marker) {
                map.current?.setView(marker.getLatLng(), 6, { animate: false });
                marker.openPopup();
              }
            }}
          >
            <option value="">All mapped cities</option>
            {mapped.map((row) => <option key={locationLabel(row)} value={locationLabel(row)}>{locationLabel(row)} ({number.format(row.hits)})</option>)}
          </select>
        </div>
        <button type="button" onClick={reset} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-700">
          Reset world view
        </button>
      </div>
      {tileError && <p role="alert" className="mb-3 text-sm text-amber-800">Map tiles could not load. Check your connection and reload; city counts are still available below.</p>}
      <div ref={container} role="region" aria-label="Interactive world map of page views by city" className="relative z-0 h-[360px] w-full rounded-xl border border-slate-200 sm:h-[480px]" />
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-slate-600">
        <p><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-teal-700" /> Larger circles mean more page views. Drag to pan; use + / - to zoom.</p>
        <p>City coordinates: <a className="underline hover:text-teal-800" href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> via cities.json (<a className="underline hover:text-teal-800" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>).</p>
      </div>
      <p className="mt-2 text-sm text-slate-600" aria-live="polite">
        {number.format(mappedViews)} of {number.format(totalViews)} location page views mapped.
        {" "}{number.format(totalViews - mappedViews)} cannot be plotted because the city is missing, unmatched or ambiguous.
        {" "}Locations are approximate city centers, not visitor addresses.
      </p>
    </div>
  );
};

export default TrafficLocationMap;
