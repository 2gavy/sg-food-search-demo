import { useRef } from "react";
import { PromptDropdown } from "./PromptDropdown";
import { detectQueryLang, langBadgeClass } from "../lib/langLabel";
import type { DemoQuery } from "../types/venue";

interface Props {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  demos: DemoQuery[];
  onSelectDemo: (demo: DemoQuery) => void;
  promptsOpen: boolean;
  onPromptsOpenChange: (open: boolean) => void;
}

export function TextSearchBar({
  query,
  onQueryChange,
  onSubmit,
  demos,
  onSelectDemo,
  promptsOpen,
  onPromptsOpenChange,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textDemos = demos.filter((d) => d.mode !== "photo");

  const queryLang = detectQueryLang(query);

  const toggleDemos = () => {
    onPromptsOpenChange(!promptsOpen);
    inputRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="relative flex-1 min-w-0">
      <div
        className={`flex items-center gap-1 sm:gap-2 rounded-lg border bg-white transition-shadow ${
          promptsOpen
            ? "border-brand ring-2 ring-brand/20 shadow-sm"
            : "border-slate-300 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20"
        }`}
      >
        {queryLang && (
          <span
            className={`shrink-0 ml-2 sm:ml-3 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ring-1 ring-inset ${langBadgeClass(queryLang)}`}
          >
            {queryLang}
          </span>
        )}
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          className="w-full min-w-0 flex-1 bg-transparent px-2 sm:px-3 py-3 sm:py-2.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none"
          placeholder="Type a query or pick a demo…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => onPromptsOpenChange(true)}
          onClick={() => onPromptsOpenChange(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onPromptsOpenChange(false);
              onSubmit();
            }
            if (e.key === "Escape") onPromptsOpenChange(false);
          }}
          aria-expanded={promptsOpen}
          aria-haspopup="listbox"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggleDemos}
          className={`shrink-0 mr-1.5 sm:mr-2 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded-md border touch-manipulation transition ${
            promptsOpen
              ? "bg-brand text-white border-brand"
              : "text-brand-dark bg-emerald-50 border-brand/20 hover:bg-emerald-100"
          }`}
          aria-label="Demo queries"
        >
          <span className="hidden sm:inline">Demos</span>
          <span className="tabular-nums">{textDemos.length}</span>
          <span aria-hidden>{promptsOpen ? "▴" : "▾"}</span>
        </button>
      </div>

      <PromptDropdown
        open={promptsOpen}
        anchorRef={rootRef}
        demos={textDemos}
        onSelect={onSelectDemo}
        onFillQuery={onQueryChange}
        onClose={() => onPromptsOpenChange(false)}
      />
    </div>
  );
}
