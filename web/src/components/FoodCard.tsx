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
  onOpenDetail?: (hit: Hit) => void;
}

function formatMatchReason(hit: Hit): string | null {
  return formatBuyerMatchReason(hit, true);
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
        className={`shrink-0 text-[9px] font-bold uppercase px-1 py-0.5 rounded text-white ${
          variant === "hybrid_oss" ? "bg-sky-600" : "bg-brand"
        }`}
      >
        New
      </span>
    );
  }
  if (isShared) {
    return <span className="shrink-0 text-[9px] text-amber-600">★</span>;
  }
  return null;
}

function VenueThumbnail({ hit }: { hit: Hit }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = resolveVenueImageUrl(hit);

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt=""
        className="w-10 h-10 rounded-md object-cover bg-slate-100 shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`w-10 h-10 rounded-md shrink-0 flex items-center justify-center bg-gradient-to-br text-[10px] font-bold ${venueAvatarColor(hit.doc_type)}`}
      aria-hidden
    >
      {venueInitials(hit.title)}
    </div>
  );
}

export function FoodCard({ hit, variant, isNew, isShared, selected, onSelect, onOpenDetail }: Props) {
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

  const border = `border-l-[3px] ${accent} ${variant === "lexical" ? "opacity-90" : ""}`;
  const matchLine = formatMatchReason(hit);
  const locationLine = [hit.neighbourhood, hit.hawker_centre].filter(Boolean).join(" · ");
  const distanceLine = hit.distance_metres != null ? formatDistance(hit.distance_metres) : null;
  const metaLine = [locationLine, distanceLine].filter(Boolean).join(" · ");

  return (
    <div
      data-doc-id={hit.doc_id}
      className={`group flex items-stretch gap-0 rounded-md bg-white shadow-sm border border-slate-200 mb-1.5 hover:shadow-md transition ${border} ${selected ? "ring-2 ring-brand" : ""}`}
    >
      <button
        type="button"
        onClick={() => onSelect?.(hit)}
        className="flex-1 min-w-0 text-left flex gap-2 p-2 active:bg-slate-50 touch-manipulation rounded-l-md"
      >
        <VenueThumbnail hit={hit} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <h3 className="font-semibold text-[13px] leading-snug text-slate-900 line-clamp-2">{hit.title}</h3>
            <Badge variant={variant} isNew={isNew} isShared={isShared} />
          </div>
          {hit.signature_dish && (
            <p className="text-[11px] text-slate-600 leading-snug line-clamp-1 mt-0.5">{hit.signature_dish}</p>
          )}
          {metaLine && <p className="text-[10px] text-slate-500 leading-snug truncate mt-0.5">{metaLine}</p>}
          {matchLine && <p className="text-[10px] text-slate-400 leading-snug line-clamp-1 mt-0.5">{matchLine}</p>}
        </div>
      </button>
      {onOpenDetail && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(hit);
          }}
          className="shrink-0 px-2 border-l border-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-r-md touch-manipulation flex items-center"
          aria-label={`Details for ${hit.title}`}
          title="View details"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
