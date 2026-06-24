import { useEffect, useState } from "react";
import { CompareColumn } from "./CompareColumn";
import { DiffBanner } from "./DiffBanner";
import { EvaluationSummary } from "./EvaluationSummary";
import { PhotoMatchSummary } from "./PhotoMatchSummary";
import { DishGallery } from "./DishGallery";
import { FoodCard } from "./FoodCard";
import { PhotoUpload } from "./PhotoUpload";
import { PhotoSearchNotice } from "./PhotoSearchNotice";
import { TextSearchBar } from "./TextSearchBar";
import { WelcomeHero } from "./WelcomeHero";
import { SearchModeToggle } from "./SearchModeToggle";
import { SyncMapView } from "./SyncMapView";
import { AgentChatPanel } from "./AgentChatPanel";
import { useCompareSearch } from "../hooks/useCompareSearch";
import {
  playClick,
  playFilter,
  playModeSwitch,
  playNewBadge,
  playSearch,
  playSelect,
  primeSounds,
} from "../lib/funSounds";
import type { DemoQuery, Hit } from "../types/venue";

export function CompareShell() {
  const [mode, setMode] = useState<"text" | "photo">("text");
  const [query, setQuery] = useState("");
  const [demos, setDemos] = useState<DemoQuery[]>([]);
  const [selectedHit, setSelectedHit] = useState<Hit | null>(null);
  const [docTypeFilter, setDocTypeFilter] = useState<string | null>(null);
  const [soundsOn, setSoundsOn] = useState(true);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [mobileHintDismissed, setMobileHintDismissed] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [photoSessionKey, setPhotoSessionKey] = useState(0);
  const { loading, result, error, previewImage, photoIsUpload, searchText, searchPhoto, runDemo, resetSearch } = useCompareSearch();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const onChange = () => setIsNarrow(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const sfx = (fn: () => void) => {
    if (!soundsOn) return;
    primeSounds();
    fn();
  };

  useEffect(() => {
    fetch("/data/demo_queries.json").then((r) => r.json()).then(setDemos).catch(() => {});
  }, []);

  const submitText = () => {
    if (!query.trim()) return;
    sfx(playSearch);
    const filters = docTypeFilter ? { doc_types: [docTypeFilter] } : undefined;
    searchText(query.trim(), undefined, filters);
  };

  const scrollToCard = (docId: string) => {
    const el = document.querySelector(`[data-doc-id="${docId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const hitFromResults = (hit: Hit): { hit: Hit; inResults: boolean } => {
    if (!result) return { hit, inResults: false };
    for (const h of result.lexical.hits) {
      if (h.doc_id === hit.doc_id) return { hit: { ...h, ...hit, doc_id: h.doc_id, title: h.title }, inResults: true };
    }
    for (const h of result.hybrid_oss.hits) {
      if (h.doc_id === hit.doc_id) return { hit: { ...h, ...hit, doc_id: h.doc_id, title: h.title }, inResults: true };
    }
    for (const h of result.hybrid_jina.hits) {
      if (h.doc_id === hit.doc_id) return { hit: { ...h, ...hit, doc_id: h.doc_id, title: h.title }, inResults: true };
    }
    return { hit, inResults: false };
  };

  const selectHit = (hit: Hit, isNew?: boolean, scrollCard = false) => {
    sfx(isNew ? playNewBadge : playSelect);
    setSelectedHit(hit);
    if (scrollCard) scrollToCard(hit.doc_id);
  };

  const runDemoQuery = (demo: DemoQuery) => {
    sfx(playClick);
    setPromptsOpen(false);
    const targetMode = demo.mode === "photo" ? "photo" : "text";
    if (targetMode !== mode) {
      sfx(playModeSwitch);
      resetSearch();
      setQuery("");
      setSelectedHit(null);
      setPhotoSessionKey((k) => k + 1);
      setMode(targetMode);
    }
    if (demo.query) setQuery(demo.query);
    runDemo(demo);
  };

  const jinaOnly = new Set(result?.diff.hybrid_only_jina ?? []);
  const ossOnly = new Set(result?.diff.hybrid_only_oss ?? []);
  const allThree = new Set(result?.diff.all_three ?? []);

  const showWelcome = !result && !loading && !error;
  const showResults = !showWelcome && (result || loading);

  return (
    <>
    <div className="min-h-screen bg-slate-100/80">
      <div className="max-w-[1680px] mx-auto px-3 py-3 sm:px-5 sm:py-4 lg:px-6">
        <div className="sticky top-0 z-30 -mx-3 px-3 sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6 pt-0 pb-3 sm:pb-4 bg-slate-100/90 backdrop-blur-md border-b border-slate-200/80">
          <header className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">SG Food Discovery</h1>
              <p className="text-xs sm:text-sm text-slate-500 leading-snug">
                Keyword · E5 hybrid · Jina hybrid — one index, side by side
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSoundsOn((v) => !v)}
                className="shrink-0 text-lg px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 min-h-[44px] min-w-[44px] touch-manipulation shadow-sm"
                aria-label={soundsOn ? "Mute sounds" : "Enable sounds"}
                title={soundsOn ? "Sound on" : "Sound off"}
              >
                {soundsOn ? "🔊" : "🔇"}
              </button>
              <SearchModeToggle
                mode={mode}
                onChange={(m) => {
                  if (m === mode) return;
                  sfx(playModeSwitch);
                  setPromptsOpen(false);
                  resetSearch();
                  setQuery("");
                  setSelectedHit(null);
                  setPhotoSessionKey((k) => k + 1);
                  setMode(m);
                }}
              />
            </div>
          </header>

          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
            {mode === "text" ? (
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <TextSearchBar
                  query={query}
                  onQueryChange={setQuery}
                  onSubmit={submitText}
                  demos={demos}
                  promptsOpen={promptsOpen}
                  onPromptsOpenChange={setPromptsOpen}
                  onSelectDemo={runDemoQuery}
                />
                <button
                  type="button"
                  onClick={() => {
                    setPromptsOpen(false);
                    submitText();
                  }}
                  className="w-full sm:w-auto shrink-0 bg-brand text-white px-5 py-3 sm:py-2.5 rounded-lg text-sm font-medium hover:bg-brand-dark min-h-[44px] touch-manipulation shadow-sm"
                >
                  Search
                </button>
              </div>
            ) : (
              <div className="w-full min-w-0 space-y-3">
                {loading ? (
                  <PhotoSearchNotice variant="loading" isUpload={photoIsUpload} />
                ) : (
                  <PhotoSearchNotice />
                )}
                <PhotoUpload
                  key={photoSessionKey}
                  onUpload={(uri) => {
                    sfx(playSearch);
                    searchPhoto(undefined, uri);
                  }}
                />
                <DishGallery
                  onPick={(id) => {
                    sfx(playClick);
                    searchPhoto(id);
                  }}
                />
              </div>
            )}

            <div className="flex gap-1.5 overflow-x-auto scroll-touch pt-3 mt-3 border-t border-slate-100">
              {["hawker_stall", "restaurant", null].map((f) => (
                <button
                  key={String(f)}
                  type="button"
                  onClick={() => {
                    sfx(playFilter);
                    setDocTypeFilter(f);
                  }}
                  className={`shrink-0 text-xs px-3 py-1.5 rounded-full border min-h-[32px] touch-manipulation transition-colors ${
                    docTypeFilter === f
                      ? "bg-brand text-white border-brand shadow-sm"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-white"
                  }`}
                >
                  {f ? f.replace("_", " ") : "All venues"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:gap-4 pt-3 sm:pt-4">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2 break-words">
              {error}
            </p>
          )}

          {loading && !result && mode === "text" && (
            <div className="rounded-xl border border-slate-200 bg-white py-16 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-700">Searching…</p>
              <p className="text-xs text-slate-400 mt-1">Keyword · E5 hybrid · Jina hybrid</p>
            </div>
          )}

          {showWelcome && mode === "text" && (
            <WelcomeHero demos={demos} onFillQuery={setQuery} onSelect={runDemoQuery} />
          )}

          {showWelcome && mode === "photo" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 text-center shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-dark">Multimodal search</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Search by dish photo</h2>
              <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
                Keyword search cannot read images. Pick a dish below — Jina matches what it looks like.
              </p>
            </section>
          )}

          {!showWelcome && !loading && result && (
            result.mode === "photo" ? (
              <PhotoMatchSummary result={result} previewImage={previewImage} />
            ) : (
              <EvaluationSummary result={result} />
            )
          )}

          {!showWelcome && !mobileHintDismissed && isNarrow && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="flex-1 leading-snug">
                Swipe the columns horizontally — desktop shows all three beside the map.
              </p>
              <button
                type="button"
                onClick={() => setMobileHintDismissed(true)}
                className="shrink-0 text-amber-700 hover:text-amber-900 px-1 min-h-[28px] min-w-[28px]"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          )}

          {showResults && (
            <div className="flex flex-col gap-3">
              {result && (
                <DiffBanner
                  result={result}
                  onSelectHit={(id, column) => {
                    const hits = column === "jina" ? result.hybrid_jina.hits : result.hybrid_oss.hits;
                    const hit = hits?.find((h) => h.doc_id === id);
                    if (hit) selectHit(hit, true);
                  }}
                />
              )}

              <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-5 lg:h-[min(calc(100vh-10rem),720px)]">
                <aside className="order-1 lg:order-2 w-full lg:w-[min(480px,40%)] shrink-0 flex flex-col min-h-0 h-[380px] sm:h-[420px] lg:h-auto rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <SyncMapView
                    result={result}
                    selectedHit={selectedHit}
                    onSelectHit={(hit) => {
                      const { hit: resolved, inResults } = hitFromResults(hit);
                      selectHit(resolved, false, inResults);
                    }}
                    className="h-full min-h-0"
                  />
                </aside>

                <div className="order-2 lg:order-1 flex-1 min-w-0 min-h-0 flex flex-col">
                  <div className="flex-1 min-h-0 overflow-x-auto scroll-touch pb-1 -mx-1 px-1 lg:mx-0 lg:px-0 lg:overflow-visible">
                    <div className="grid grid-cols-3 gap-2 md:gap-3 items-stretch min-w-[720px] lg:min-w-0 h-full lg:min-h-0">
                    <CompareColumn
                      title="Keywords only"
                      titleMobile="Keywords"
                      subtitle="BM25 — exact tokens, no vectors"
                      side={result?.lexical ?? null}
                      loading={loading}
                      variant="lexical"
                      searchMode={mode}
                      bothCount={result?.diff.all_three.length}
                      compactHeader
                      emptyContent={
                        mode === "photo" && previewImage ? (
                          <img src={previewImage} alt="Query" className="w-32 h-32 mx-auto rounded-lg object-cover" />
                        ) : undefined
                      }
                    >
                      {result?.lexical.hits.map((hit) => (
                        <FoodCard
                          key={hit.doc_id}
                          hit={hit}
                          variant="lexical"
                          isShared={allThree.has(hit.doc_id)}
                          selected={selectedHit?.doc_id === hit.doc_id}
                          onSelect={(hit) => selectHit(hit, false)}
                        />
                      ))}
                    </CompareColumn>

                    <CompareColumn
                      title="Open-source hybrid (E5)"
                      titleMobile="E5"
                      subtitle={
                        mode === "photo"
                          ? "E5 text proxy from dish name"
                          : "BM25 + multilingual-e5-small · RRF"
                      }
                      side={result?.hybrid_oss ?? null}
                      loading={loading}
                      variant="hybrid_oss"
                      searchMode={mode}
                      hybridOnlyCount={result?.diff.hybrid_only_oss.length}
                      bothCount={result?.diff.all_three.length}
                      compactHeader
                    >
                      {mode === "photo" && previewImage && !result?.hybrid_oss?.unsupported && (
                        <img
                          src={previewImage}
                          alt="Query dish"
                          className="hidden md:block w-full max-w-[120px] rounded-lg mb-3 border border-sky-300"
                        />
                      )}
                      {result?.hybrid_oss?.hits.map((hit) => (
                        <FoodCard
                          key={hit.doc_id}
                          hit={hit}
                          variant="hybrid_oss"
                          isNew={ossOnly.has(hit.doc_id)}
                          isShared={allThree.has(hit.doc_id)}
                          selected={selectedHit?.doc_id === hit.doc_id}
                          onSelect={(hit) => selectHit(hit, ossOnly.has(hit.doc_id))}
                        />
                      ))}
                    </CompareColumn>

                    <CompareColumn
                      title="Multimodal hybrid (Jina)"
                      titleMobile="Jina"
                      subtitle={
                        mode === "photo"
                          ? "Jina v5 omni · visual kNN"
                          : "BM25 + Jina v5 omni · RRF"
                      }
                      side={result?.hybrid_jina ?? null}
                      loading={loading}
                      variant="hybrid_jina"
                      searchMode={mode}
                      hybridOnlyCount={result?.diff.hybrid_only_jina.length}
                      bothCount={result?.diff.all_three.length}
                      compactHeader
                    >
                      {mode === "photo" && previewImage && (
                        <img
                          src={previewImage}
                          alt="Query dish"
                          className="hidden md:block w-full max-w-[120px] rounded-lg mb-3 border border-brand/30"
                        />
                      )}
                      {result?.hybrid_jina.hits.map((hit) => (
                        <FoodCard
                          key={hit.doc_id}
                          hit={hit}
                          variant="hybrid_jina"
                          isNew={jinaOnly.has(hit.doc_id)}
                          isShared={allThree.has(hit.doc_id)}
                          selected={selectedHit?.doc_id === hit.doc_id}
                          onSelect={(hit) => selectHit(hit, jinaOnly.has(hit.doc_id))}
                        />
                      ))}
                    </CompareColumn>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    <AgentChatPanel result={result} selectedHit={selectedHit} query={query} mode={mode} />
    </>
  );
}
