import type { DemoQuery } from "../types/venue";
import { langBadgeClass } from "../lib/langLabel";
import { MULTILINGUAL_HERO_IDS, pickDemos } from "../lib/demoPrompts";

interface Props {
  demos: DemoQuery[];
  onSelect: (demo: DemoQuery) => void;
  onFillQuery?: (text: string) => void;
}

export function WelcomeHero({ demos, onSelect, onFillQuery }: Props) {
  const multilingual = pickDemos(demos, MULTILINGUAL_HERO_IDS);

  if (multilingual.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-b from-violet-50/80 via-white to-emerald-50/40 p-4 sm:p-6 shadow-sm">
      <div className="max-w-2xl mx-auto text-center sm:text-left">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-600">
          Multilingual · Multimodal · Elastic Search
        </p>
        <h2 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
          Ask in your language — smart search still understands
        </h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-2xl mx-auto sm:mx-0">
          Side-by-side evaluation on one index — keyword baseline vs open-source hybrid vs multimodal hybrid.
          Start with a language card below.
        </p>
      </div>

      {multilingual.length > 0 && (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {multilingual.map((demo) => (
            <button
              key={demo.id}
              type="button"
              onClick={() => {
                if (demo.query) onFillQuery?.(demo.query);
                onSelect(demo);
              }}
              className="group text-left rounded-xl border border-violet-200/80 bg-white/90 px-3 py-3 sm:py-3.5 hover:border-violet-400 hover:shadow-md hover:shadow-violet-100 active:scale-[0.99] transition touch-manipulation"
            >
              <div className="flex items-center gap-2 min-w-0">
                {demo.lang_label && (
                  <span
                    className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ring-1 ring-inset ${langBadgeClass(demo.lang_label)}`}
                  >
                    {demo.lang_label}
                  </span>
                )}
                <span className="text-sm font-semibold text-slate-800 truncate group-hover:text-violet-900">
                  {demo.label}
                </span>
              </div>
              {demo.query && (
                <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 font-mono leading-snug">{demo.query}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
