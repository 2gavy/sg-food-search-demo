export interface GeoFilter {
  lat: number;
  lon: number;
  radius_m: number;
  label: string;
}

export const GEO_PRESETS: { id: string; label: string; lat?: number; lon?: number; radius_m: number }[] = [
  { id: "off", label: "Anywhere SG", radius_m: 1500 },
  { id: "cbd", label: "Near CBD", lat: 1.2839, lon: 103.8515, radius_m: 1200 },
  { id: "orchard", label: "Near Orchard", lat: 1.3048, lon: 103.8318, radius_m: 1500 },
  { id: "east", label: "East side", lat: 1.3521, lon: 103.9448, radius_m: 2000 },
  { id: "me", label: "Near me", radius_m: 1500 },
];

interface Props {
  presetId: string;
  radiusM: number;
  locating: boolean;
  onPresetChange: (id: string) => void;
  onRadiusChange: (radiusM: number) => void;
}

export function GeoFilters({ presetId, radiusM, locating, onPresetChange, onRadiusChange }: Props) {
  if (presetId === "off") {
    return (
      <div className="flex flex-wrap items-center gap-1.5 pt-3 mt-3 border-t border-slate-100">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mr-1 shrink-0">
          Area
        </span>
        {GEO_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPresetChange(p.id)}
            disabled={p.id === "me" && locating}
            className="shrink-0 text-xs px-3 py-1.5 rounded-full border min-h-[32px] touch-manipulation transition-colors bg-slate-50 border-slate-200 text-slate-600 hover:bg-white disabled:opacity-50"
          >
            {p.id === "me" && locating ? "Locating…" : p.label}
          </button>
        ))}
      </div>
    );
  }

  const active = GEO_PRESETS.find((p) => p.id === presetId);

  return (
    <div className="pt-3 mt-3 border-t border-slate-100 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mr-1 shrink-0">
          Area
        </span>
        {GEO_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPresetChange(p.id)}
            disabled={p.id === "me" && locating}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border min-h-[32px] touch-manipulation transition-colors ${
              presetId === p.id
                ? "bg-brand text-white border-brand shadow-sm"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-white"
            } disabled:opacity-50`}
          >
            {p.id === "me" && locating ? "Locating…" : p.label}
          </button>
        ))}
      </div>
      {active && presetId !== "off" && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span>
            Within <strong className="text-slate-700">{radiusM >= 1000 ? `${radiusM / 1000}km` : `${radiusM}m`}</strong>
            {active.id !== "me" ? ` of ${active.label.replace("Near ", "")}` : ""}
          </span>
          <label className="inline-flex items-center gap-1.5 ml-auto">
            <span className="text-slate-400">Radius</span>
            <select
              value={radiusM}
              onChange={(e) => onRadiusChange(Number(e.target.value))}
              className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white"
            >
              <option value={800}>800m</option>
              <option value={1200}>1.2km</option>
              <option value={1500}>1.5km</option>
              <option value={3000}>3km</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

export function resolveGeoFilter(
  presetId: string,
  radiusM: number,
  myLocation: { lat: number; lon: number } | null,
): GeoFilter | null {
  if (presetId === "off") return null;
  const preset = GEO_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  if (preset.id === "me") {
    if (!myLocation) return null;
    return { ...myLocation, radius_m: radiusM, label: "Near me" };
  }
  if (preset.lat == null || preset.lon == null) return null;
  return { lat: preset.lat, lon: preset.lon, radius_m: radiusM, label: preset.label };
}
