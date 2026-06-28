import type { Hit } from "../types/venue";
import type { ColumnVariant } from "./CompareColumn";
import { formatBuyerMatchReason } from "../lib/matchReason";
import { resolveVenueImageUrl } from "../lib/venueImage";
import { useState } from "react";

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

function FlyoutThumbnail({ hit }: { hit: Hit }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = resolveVenueImageUrl(hit);

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt=""
        className="w-20 h-20 rounded-xl object-cover bg-slate-100 shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`w-20 h-20 rounded-xl shrink-0 flex items-center justify-center bg-gradient-to-br text-lg font-bold ${venueAvatarColor(hit.doc_type)}`}
      aria-hidden
    >
      {venueInitials(hit.title)}
    </div>
  );
}

interface Props {
  hit: Hit | null;
  variant?: ColumnVariant;
  onClose: () => void;
}

export function VenueFlyout({ hit, variant, onClose }: Props) {
  if (!hit) return null;

  const matchReason = formatBuyerMatchReason(hit, false);
  const location = [hit.hawker_centre, hit.neighbourhood].filter(Boolean).join(" · ");
  const distanceLine = hit.distance_metres != null ? formatDistance(hit.distance_metres) : null;

  const accentRing =
    variant === "hybrid_jina"
      ? "ring-brand/30"
      : variant === "hybrid_oss"
        ? "ring-sky-300"
        : "ring-slate-200";

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[250] bg-slate-900/30 backdrop-blur-[1px]"
        aria-label="Close venue details"
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 bottom-0 z-[251] w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200`}
        role="dialog"
        aria-label="Venue details"
      >
        <header className="shrink-0 flex items-start justify-between gap-3 px-4 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex gap-3 min-w-0">
            <FlyoutThumbnail hit={hit} />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 leading-snug">{hit.title}</h2>
              {hit.signature_dish && (
                <p className="text-sm text-slate-600 mt-0.5">{hit.signature_dish}</p>
              )}
              {location && <p className="text-xs text-slate-500 mt-1">{location}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-9 h-9 rounded-full text-slate-500 hover:bg-slate-200/80 flex items-center justify-center"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto scroll-touch p-4 space-y-4">
          <dl className={`grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-3 ring-1 ${accentRing}`}>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">Type</dt>
              <dd className="text-sm text-slate-800 capitalize mt-0.5">{hit.doc_type?.replace(/_/g, " ") ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">Rating</dt>
              <dd className="text-sm text-slate-800 mt-0.5">★ {hit.rating ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">Price</dt>
              <dd className="text-sm text-slate-800 mt-0.5">{hit.price_range ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">Distance</dt>
              <dd className="text-sm text-slate-800 mt-0.5">{distanceLine ?? "—"}</dd>
            </div>
            {hit.rank != null && (
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-slate-400">Rank</dt>
                <dd className="text-sm text-slate-800 mt-0.5">#{hit.rank}</dd>
              </div>
            )}
            {hit.score != null && (
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-slate-400">Score</dt>
                <dd className="text-sm text-slate-800 mt-0.5 tabular-nums">{hit.score.toFixed(3)}</dd>
              </div>
            )}
          </dl>

          {matchReason && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Why it matched</p>
              <p className="text-sm text-slate-700 mt-1 leading-relaxed">{matchReason}</p>
            </div>
          )}

          {hit.description && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">About</p>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">{hit.description}</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
