import { useState } from "react";
import type { Hit } from "../types/venue";
import type { ColumnVariant } from "./CompareColumn";
import { formatBuyerMatchReason } from "../lib/matchReason";
import { resolveVenueImageUrl } from "../lib/venueImage";

interface Props {
  hit: Hit;
  variant: ColumnVariant;
  isNew?: boolean;
  isShared?: boolean;
  selected?: boolean;
  onSelect?: (hit: Hit) => void;
}

function formatMatchReason(hit: Hit, short = false): string | null {
  return formatBuyerMatchReason(hit, short);
}

function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)}m`;
  return `${(metres / 1000).toFixed(1)}km`;
}

function venueInitials(title: string): string {
  const parts = title.split(/[\s—–-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return title.slice(0, 2).toUpperCase();
}

function venueAvatarColor(docType?: string): string {
  switch (docType) {
    case "hawker_stall":
      return "from-amber-100 to-amber-300 text-amber-900";
    case "restaurant":
      return "from-rose-100 to-rose-300 text-rose-900";
    case "cafe":
      return "from-violet-100 to-violet-300 text-violet-900";
    case "zi_char":
      return "from-orange-100 to-orange-300 text-orange-900";
    default:
      return "from-slate-100 to-slate-300 text-slate-700";
  }
}

function Badge({ variant, isNew, isShared }: { variant: ColumnVariant; isNew?: boolean; isShared?: boolean }) {
  if (isNew) {
    return (
      <span
        className={`shrink-0 text-[9px] md:text-[10px] font-bold uppercase px-1 py-0.5 rounded text-white ${
          variant === "hybrid_oss" ? "bg-sky-600" : "bg-brand"
        }`}
      >
        New
      </span>
    );
  }
  if (isShared) {
    return <span className="shrink-0 text-[9px] md:text-[10px] text-amber-600">★</span>;
  }
  return null;
}

function VenueThumbnail({ hit, size = "md" }: { hit: Hit; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = resolveVenueImageUrl(hit);
  const dim = size === "sm" ? "w-10 h-10 rounded" : "w-16 h-16 rounded-md";

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={`${dim} object-cover bg-slate-100 shrink-0`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`${dim} shrink-0 flex items-center justify-center bg-gradient-to-br font-bold ${size === "sm" ? "text-[10px]" : "text-sm"} ${venueAvatarColor(hit.doc_type)}`}
      aria-hidden
    >
      {venueInitials(hit.title)}
    </div>
  );
}

export function FoodCard({ hit, variant, isNew, isShared, selected, onSelect }: Props) {
  const accent =
    variant === "hybrid_jina"
      ? isNew
        ? "border-l-brand"
        : isShared
          ? "border-l-amber-400"
          : "border-l-brand/40"
      : variant === "hybrid_oss"
        ? isNew
          ? "border-l-sky-500"
          : isShared
            ? "border-l-amber-400"
            : "border-l-sky-300"
        : "border-l-slate-300";

  const border = `border-l-[3px] md:border-l-4 ${accent} ${variant === "lexical" ? "opacity-90" : ""}`;
  const matchMobile = formatMatchReason(hit, true);
  const matchDesktop = formatMatchReason(hit, false);
  const distanceLine = hit.distance_metres != null ? formatDistance(hit.distance_metres) : null;

  return (
    <button
      type="button"
      data-doc-id={hit.doc_id}
      onClick={() => onSelect?.(hit)}
      className={`w-full text-left rounded-md md:rounded-lg bg-white shadow-sm border border-slate-200 p-2 md:p-3 mb-1.5 md:mb-2 hover:shadow-md active:bg-slate-50 transition touch-manipulation ${border} ${selected ? "ring-2 ring-brand" : ""}`}
    >
      {/* Mobile: compact with thumbnail */}
      <div className="md:hidden flex gap-2">
        <VenueThumbnail hit={hit} size="sm" />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-1">
            <h3 className="font-semibold text-[13px] leading-snug text-slate-900 line-clamp-3 break-words">{hit.title}</h3>
            <Badge variant={variant} isNew={isNew} isShared={isShared} />
          </div>
          {hit.signature_dish && (
            <p className="text-[12px] text-slate-600 leading-snug line-clamp-2">{hit.signature_dish}</p>
          )}
          <p className="text-[11px] text-slate-500 leading-snug">
            ★ {hit.rating ?? "—"} · {hit.price_range ?? "—"}
            {distanceLine ? ` · ${distanceLine}` : ""}
          </p>
          {matchMobile && <p className="text-[10px] text-slate-400 leading-snug line-clamp-2">{matchMobile}</p>}
        </div>
      </div>

      {/* Desktop: full card with thumbnail */}
      <div className="hidden md:flex gap-3">
        <VenueThumbnail hit={hit} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm text-slate-900 truncate">{hit.title}</h3>
            <Badge variant={variant} isNew={isNew} isShared={isShared} />
          </div>
          <p className="text-xs text-slate-500 mt-0.5 capitalize">
            {hit.doc_type?.replace(/_/g, " ") ?? "venue"} · {hit.price_range ?? "—"} · ★ {hit.rating ?? "—"}
          </p>
          {hit.signature_dish && <p className="text-xs text-slate-600 mt-1">{hit.signature_dish}</p>}
          {(matchDesktop || distanceLine) && (
            <p className="text-[11px] text-slate-400 mt-1 truncate">
              {[matchDesktop, distanceLine].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
