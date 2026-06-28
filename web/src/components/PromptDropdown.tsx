import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DemoQuery } from "../types/venue";
import { langBadgeClass } from "../lib/langLabel";

interface Props {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  demos: DemoQuery[];
  onSelect: (demo: DemoQuery) => void;
  onFillQuery?: (text: string) => void;
  onClose: () => void;
}

function SuggestionRow({
  demo,
  onSelect,
  onFillQuery,
  onClose,
  variant = "english",
}: {
  demo: DemoQuery;
  onSelect: (demo: DemoQuery) => void;
  onFillQuery?: (text: string) => void;
  onClose: () => void;
  variant?: "english" | "multilingual" | "photo";
}) {
  const hover =
    variant === "multilingual"
      ? "hover:bg-violet-50/80 active:bg-violet-50"
      : variant === "photo"
        ? "hover:bg-emerald-50/80 active:bg-emerald-50"
        : "hover:bg-slate-50 active:bg-slate-100";

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        if (demo.query) onFillQuery?.(demo.query);
        onSelect(demo);
        onClose();
      }}
      className={`w-full text-left px-3 py-2.5 sm:py-2 rounded-lg transition touch-manipulation ${hover}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {demo.lang_label && (
          <span
            className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ring-1 ring-inset ${langBadgeClass(demo.lang_label)}`}
          >
            {demo.lang_label}
          </span>
        )}
        <span className="text-sm font-medium text-slate-800 truncate">{demo.label}</span>
      </div>
      {demo.query && (
        <p className="mt-0.5 text-xs text-slate-500 truncate font-mono">{demo.query}</p>
      )}
    </button>
  );
}

export function PromptDropdown({ open, anchorRef, demos, onSelect, onFillQuery, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const multilingual = demos.filter((d) => d.mode !== "photo" && d.group === "multilingual");
  const english = demos.filter((d) => d.mode !== "photo" && d.group !== "multilingual");
  const photo = demos.filter((d) => d.mode === "photo");

  useEffect(() => {
    if (!open || !anchorRef.current) return;

    const updatePosition = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open || demos.length === 0) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="listbox"
      aria-label="Suggested searches"
      style={{ top: pos.top, left: pos.left, width: pos.width }}
      className="fixed z-[200] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-300/50 ring-1 ring-black/5"
    >
      <div className="max-h-[min(480px,65vh)] overflow-y-auto overscroll-contain scroll-touch p-1.5 bg-white">
        <p className="px-3 pt-1.5 pb-2 text-[10px] text-slate-400 leading-snug">
          Click any row to run · {demos.length} demo{demos.length === 1 ? "" : "s"}
        </p>
        {multilingual.length > 0 && (
          <section>
            <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-violet-500">
              Multilingual
            </p>
            <div className="flex flex-col gap-0.5">
              {multilingual.map((demo) => (
                <SuggestionRow
                  key={demo.id}
                  demo={demo}
                  variant="multilingual"
                  onSelect={onSelect}
                  onFillQuery={onFillQuery}
                  onClose={onClose}
                />
              ))}
            </div>
          </section>
        )}

        {english.length > 0 && (
          <section className={multilingual.length > 0 ? "mt-1 border-t border-slate-100 pt-1" : ""}>
            <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              English
            </p>
            <div className="flex flex-col gap-0.5">
              {english.map((demo) => (
                <SuggestionRow
                  key={demo.id}
                  demo={demo}
                  variant="english"
                  onSelect={onSelect}
                  onFillQuery={onFillQuery}
                  onClose={onClose}
                />
              ))}
            </div>
          </section>
        )}

        {photo.length > 0 && (
          <section className="mt-1 border-t border-slate-100 pt-1">
            <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-dark">
              Photo
            </p>
            <div className="flex flex-col gap-0.5">
              {photo.map((demo) => (
                <SuggestionRow
                  key={demo.id}
                  demo={demo}
                  variant="photo"
                  onSelect={onSelect}
                  onClose={onClose}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>,
    document.body,
  );
}
