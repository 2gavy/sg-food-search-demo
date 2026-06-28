import { useEffect, useMemo, useState } from "react";
import { CompareColumn } from "./CompareColumn";
import { InsightsBar } from "./InsightsBar";
import { FoodCard } from "./FoodCard";
import { WelcomeHero } from "./WelcomeHero";
import { SyncMapView } from "./SyncMapView";
import { AgentChatPanel } from "./AgentChatPanel";
import { DiscoverPanel } from "./DiscoverPanel";
import { AppCommandBar, MapCollapseToggle } from "./AppCommandBar";
import { VenueFlyout } from "./VenueFlyout";
import { SearchInsightsSkeleton } from "./Skeleton";
import { useCompareSearch } from "../hooks/useCompareSearch";
import { useDiscoverClusters } from "../hooks/useDiscoverClusters";
import { resolveGeoFilter } from "./GeoFilters";
import {
  playClick,
  playFilter,
  playModeSwitch,
  playNewBadge,
  playSearch,
  playSelect,
  primeSounds,
} from "../lib/funSounds";
import type { ColumnVariant } from "./CompareColumn";
import type { CompareResponse, DemoQuery, Hit } from "../types/venue";

function MobileCompareTabs({
  active,
  result,
  onChange,
}: {
  active: ColumnVariant;
  result: CompareResponse | null;
  onChange: (v: ColumnVariant) => void;
}) {
  const tabs: { id: ColumnVariant; label: string; count: number; extra?: number }[] = [
    { id: "lexical", label: "Keywords", count: result?.lexical.hits.length ?? 0 },
    {
      id: "hybrid_oss",
      label: "E5",
      count: result?.hybrid_oss.hits.length ?? 0,
      extra: result?.diff.hybrid_only_oss.length,
    },
    {
      id: "hybrid_jina",
      label: "Jina",
      count: result?.hybrid_jina.hits.length ?? 0,
      extra: result?.diff.hybrid_only_jina.length,
    },
  ];

  return (
    <div
      className="lg:hidden flex gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/80"
      role="tablist"
      aria-label="Compare columns"
    >
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`flex-1 min-w-0 rounded-lg px-2 py-2 text-center touch-manipulation transition-colors ${
              selected
                ? "bg-white shadow-sm text-slate-900"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="block text-xs font-semibold">{tab.label}</span>
            <span className="block text-[10px] tabular-nums text-slate-500">
              {tab.count}
              {tab.extra != null && tab.extra > 0 && (
                <span className={selected ? "text-brand-dark" : "text-slate-400"}> · +{tab.extra}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function columnForHit(result: CompareResponse, docId: string): ColumnVariant {
  if (result.hybrid_jina.hits.some((h) => h.doc_id === docId)) return "hybrid_jina";
  if (result.hybrid_oss.hits.some((h) => h.doc_id === docId)) return "hybrid_oss";
  return "lexical";
}

function collectMapPinCount(result: { lexical: { hits: Hit[] }; hybrid_oss: { hits: Hit[] }; hybrid_jina: { hits: Hit[] } } | null): number {
  if (!result) return 0;
  const ids = new Set<string>();
  for (const hit of [...result.lexical.hits, ...result.hybrid_oss.hits, ...result.hybrid_jina.hits]) {
    if (hit.location) ids.add(hit.doc_id);
  }
  return ids.size;
}

export function CompareShell() {
  const [appView, setAppView] = useState<"search" | "discover">("search");
  const [mode, setMode] = useState<"text" | "photo">("text");
  const [query, setQuery] = useState("");
  const [demos, setDemos] = useState<DemoQuery[]>([]);
  const [selectedHit, setSelectedHit] = useState<Hit | null>(null);
  const [detailHit, setDetailHit] = useState<{ hit: Hit; variant: ColumnVariant } | null>(null);
  const [docTypeFilter, setDocTypeFilter] = useState<string | null>(null);
  const [dietaryTags, setDietaryTags] = useState<string[]>([]);
  const [geoPresetId, setGeoPresetId] = useState("off");
  const [geoRadiusM, setGeoRadiusM] = useState(1500);
  const [myLocation, setMyLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [geoLocating, setGeoLocating] = useState(false);
  const [soundsOn, setSoundsOn] = useState(true);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [mobileHintDismissed, setMobileHintDismissed] = useState(false);
  const [commandBarCompact, setCommandBarCompact] = useState(false);
  const [mobileColumn, setMobileColumn] = useState<ColumnVariant>("hybrid_jina");
  const [isNarrow, setIsNarrow] = useState(false);
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [searchBreadcrumb, setSearchBreadcrumb] = useState<string | null>(null);
  const [photoSessionKey, setPhotoSessionKey] = useState(0);
  const { loading, result, error, previewImage, photoIsUpload, searchText, searchPhoto, runDemo, resetSearch } = useCompareSearch();
  const discover = useDiscoverClusters(appView === "discover");

  const activeGeo = useMemo(
    () => resolveGeoFilter(geoPresetId, geoRadiusM, myLocation),
    [geoPresetId, geoRadiusM, myLocation],
  );

  const searchFilters = useMemo(
    () => ({
      doc_types: docTypeFilter ? [docTypeFilter] : undefined,
      dietary_tags: dietaryTags.length ? dietaryTags : undefined,
    }),
    [docTypeFilter, dietaryTags],
  );

  const geoPayload = useMemo(
    () => (activeGeo ? { lat: activeGeo.lat, lon: activeGeo.lon, radius_m: activeGeo.radius_m } : undefined),
    [activeGeo],
  );

  const mapPinCount = useMemo(() => collectMapPinCount(result), [result]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const onChange = () => {
      const narrow = mq.matches;
      setIsNarrow(narrow);
      setMapCollapsed(narrow);
    };
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
    searchText(query.trim(), geoPayload, searchFilters);
  };

  const requestNearMe = () => {
    if (!navigator.geolocation) return;
    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoLocating(false);
      },
      () => setGeoLocating(false),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  const handleGeoPresetChange = (id: string) => {
    sfx(playFilter);
    setGeoPresetId(id);
    if (id === "me") requestNearMe();
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
    focusMobileColumn(hit.doc_id);
    if (scrollCard) scrollToCard(hit.doc_id);
  };

  const openDetail = (hit: Hit, variant: ColumnVariant) => {
    sfx(playClick);
    setDetailHit({ hit, variant });
  };

  const runDemoQuery = (demo: DemoQuery) => {
    sfx(playClick);
    setPromptsOpen(false);
    setSearchBreadcrumb(null);
    const targetMode = demo.mode === "photo" ? "photo" : "text";
    if (targetMode !== mode) {
      sfx(playModeSwitch);
      resetSearch();
      setQuery("");
      setSelectedHit(null);
      setDetailHit(null);
      setPhotoSessionKey((k) => k + 1);
      setMode(targetMode);
    }
    if (demo.query) setQuery(demo.query);
    runDemo(demo);
  };

  const jinaOnly = new Set(result?.diff.hybrid_only_jina ?? []);
  const ossOnly = new Set(result?.diff.hybrid_only_oss ?? []);
  const allThree = new Set(result?.diff.all_three ?? []);

  const runThemeSearch = (themeQuery: string, discoverLabel?: string) => {
    const q = themeQuery.trim();
    if (!q) return;
    setAppView("search");
    setMode("text");
    setQuery(q);
    setSearchBreadcrumb(discoverLabel ?? null);
    setDetailHit(null);
    sfx(playSearch);
    searchText(q, geoPayload, searchFilters);
  };

  const showWelcome = appView === "search" && !result && !loading && !error;
  const showResults = appView === "search" && !showWelcome && (result || loading);

  useEffect(() => {
    if (isNarrow && result && !loading) {
      setCommandBarCompact(true);
    }
  }, [isNarrow, result?.query, loading]);

  useEffect(() => {
    if (showWelcome) {
      setCommandBarCompact(false);
    }
  }, [showWelcome]);

  const focusMobileColumn = (docId: string) => {
    if (!isNarrow || !result) return;
    setMobileColumn(columnForHit(result, docId));
  };

  const renderFoodCard = (
    hit: Hit,
    variant: ColumnVariant,
    opts: { isNew?: boolean; isShared?: boolean; onSelect: (h: Hit) => void },
  ) => (
    <FoodCard
      key={hit.doc_id}
      hit={hit}
      variant={variant}
      isNew={opts.isNew}
      isShared={opts.isShared}
      selected={selectedHit?.doc_id === hit.doc_id}
      onSelect={opts.onSelect}
      onOpenDetail={(h) => openDetail(h, variant)}
    />
  );

  return (
    <>
    <div className="min-h-screen bg-slate-100/80">
      <div className="max-w-[1680px] mx-auto px-3 py-3 sm:px-5 sm:py-4 lg:px-6">
        <AppCommandBar
          appView={appView}
          mode={mode}
          query={query}
          demos={demos}
          promptsOpen={promptsOpen}
          docTypeFilter={docTypeFilter}
          dietaryTags={dietaryTags}
          geoPresetId={geoPresetId}
          geoRadiusM={geoRadiusM}
          geoLocating={geoLocating}
          soundsOn={soundsOn}
          loading={loading}
          photoIsUpload={photoIsUpload}
          photoSessionKey={photoSessionKey}
          searchBreadcrumb={searchBreadcrumb}
          compact={isNarrow && commandBarCompact && appView === "search"}
          resultQuery={result?.query ?? null}
          onExpandCommandBar={() => setCommandBarCompact(false)}
          onAppViewChange={(v) => {
            if (v === appView) return;
            sfx(playModeSwitch);
            if (v === "discover") setSearchBreadcrumb(null);
            setAppView(v);
          }}
          onModeChange={(m) => {
            if (m === mode) return;
            sfx(playModeSwitch);
            setPromptsOpen(false);
            resetSearch();
            setQuery("");
            setSelectedHit(null);
            setDetailHit(null);
            setSearchBreadcrumb(null);
            setPhotoSessionKey((k) => k + 1);
            setMode(m);
            setAppView("search");
          }}
          onSoundsToggle={() => setSoundsOn((v) => !v)}
          onQueryChange={setQuery}
          onSubmitText={() => {
            setPromptsOpen(false);
            if (isNarrow) setCommandBarCompact(true);
            submitText();
          }}
          onPromptsOpenChange={setPromptsOpen}
          onSelectDemo={runDemoQuery}
          onDocTypeChange={(f) => {
            sfx(playFilter);
            setDocTypeFilter(f);
          }}
          onDietaryChange={(tags) => {
            sfx(playFilter);
            setDietaryTags(tags);
          }}
          onGeoPresetChange={handleGeoPresetChange}
          onGeoRadiusChange={setGeoRadiusM}
          onPhotoUpload={(uri) => {
            sfx(playSearch);
            setSearchBreadcrumb(null);
            searchPhoto(undefined, uri, geoPayload);
          }}
          onPhotoPick={(id) => {
            sfx(playClick);
            setSearchBreadcrumb(null);
            searchPhoto(id, undefined, geoPayload);
          }}
          onBreadcrumbBack={() => {
            sfx(playClick);
            setSearchBreadcrumb(null);
            setAppView("discover");
          }}
        />

        <div className="flex flex-col gap-3 sm:gap-4 pt-3 sm:pt-4">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2 break-words">
              {error}
            </p>
          )}

          {appView === "search" && showResults && loading && !result && (
            <SearchInsightsSkeleton />
          )}

          {appView === "search" && result && (
            <InsightsBar
              result={result}
              previewImage={previewImage}
              onSelectHit={(id, column) => {
                const hits = column === "jina" ? result.hybrid_jina.hits : result.hybrid_oss.hits;
                const hit = hits?.find((h) => h.doc_id === id);
                if (hit) {
                  selectHit(hit, true, true);
                  if (isNarrow) {
                    setMobileColumn(column === "jina" ? "hybrid_jina" : "hybrid_oss");
                  }
                  if (!mapCollapsed) setMapCollapsed(false);
                }
              }}
            />
          )}

          {appView === "discover" && (
            <DiscoverPanel
              loading={discover.loading}
              error={discover.error}
              data={discover.data}
              onRefresh={discover.reload}
              onSearchTheme={(q, label) => runThemeSearch(q, label)}
              onSelectVenue={(hit) => {
                sfx(playSelect);
                setSelectedHit(hit);
                runThemeSearch(hit.signature_dish ?? hit.title, hit.title);
              }}
            />
          )}

          {showWelcome && mode === "text" && (
            <WelcomeHero
              demos={demos}
              onFillQuery={setQuery}
              onSelect={runDemoQuery}
              onOpenDiscover={() => {
                sfx(playClick);
                setAppView("discover");
              }}
            />
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

          {appView === "search" && !showWelcome && !mobileHintDismissed && isNarrow && !commandBarCompact && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 lg:hidden">
              <p className="flex-1 leading-snug">
                After you search, the bar collapses. Use the Keywords / E5 / Jina tabs to compare columns.
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
              <div className="flex justify-end">
                <MapCollapseToggle
                  collapsed={mapCollapsed}
                  onToggle={() => setMapCollapsed((v) => !v)}
                  pinCount={mapPinCount}
                />
              </div>

              <div
                className={`flex flex-col gap-3 lg:items-stretch lg:gap-5 lg:h-[min(calc(100vh-10rem),720px)] ${
                  mapCollapsed ? "" : "lg:flex-row"
                }`}
              >
                {!mapCollapsed && (
                  <aside className="order-1 lg:order-2 w-full lg:w-[min(480px,40%)] shrink-0 flex flex-col min-h-0 h-[380px] sm:h-[420px] lg:h-auto rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <SyncMapView
                      result={result}
                      selectedHit={selectedHit}
                      onSelectHit={(hit) => {
                        const { hit: resolved, inResults } = hitFromResults(hit);
                        selectHit(resolved, false, inResults);
                      }}
                      center={activeGeo ? { lat: activeGeo.lat, lon: activeGeo.lon } : undefined}
                      radiusM={activeGeo?.radius_m}
                      className="h-full min-h-0"
                    />
                  </aside>
                )}

                <div className={`order-2 lg:order-1 flex-1 min-w-0 min-h-0 flex flex-col gap-2 ${mapCollapsed ? "w-full" : ""}`}>
                  {isNarrow && result && (
                    <MobileCompareTabs active={mobileColumn} result={result} onChange={setMobileColumn} />
                  )}
                  <div className="flex-1 min-h-0 overflow-x-auto scroll-touch pb-1 -mx-1 px-1 lg:mx-0 lg:px-0 lg:overflow-visible">
                    <div
                      className={`items-stretch h-full lg:min-h-0 ${
                        isNarrow
                          ? "flex flex-col min-h-[min(58vh,520px)]"
                          : "grid grid-cols-3 gap-2 md:gap-3 min-w-[720px] lg:min-w-0"
                      }`}
                    >
                    <div className={isNarrow && mobileColumn !== "lexical" ? "hidden" : "min-h-0 flex flex-col h-full"}>
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
                      {result?.lexical.hits.map((hit) =>
                        renderFoodCard(hit, "lexical", {
                          isShared: allThree.has(hit.doc_id),
                          onSelect: (h) => selectHit(h, false),
                        }),
                      )}
                    </CompareColumn>
                    </div>

                    <div className={isNarrow && mobileColumn !== "hybrid_oss" ? "hidden" : "min-h-0 flex flex-col h-full"}>
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
                      {result?.hybrid_oss?.hits.map((hit) =>
                        renderFoodCard(hit, "hybrid_oss", {
                          isNew: ossOnly.has(hit.doc_id),
                          isShared: allThree.has(hit.doc_id),
                          onSelect: (h) => selectHit(h, ossOnly.has(h.doc_id)),
                        }),
                      )}
                    </CompareColumn>
                    </div>

                    <div className={isNarrow && mobileColumn !== "hybrid_jina" ? "hidden" : "min-h-0 flex flex-col h-full"}>
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
                      {result?.hybrid_jina.hits.map((hit) =>
                        renderFoodCard(hit, "hybrid_jina", {
                          isNew: jinaOnly.has(hit.doc_id),
                          isShared: allThree.has(hit.doc_id),
                          onSelect: (h) => selectHit(h, jinaOnly.has(h.doc_id)),
                        }),
                      )}
                    </CompareColumn>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          )}
        </div>
      </div>
    </div>

    <VenueFlyout
      hit={detailHit?.hit ?? null}
      variant={detailHit?.variant}
      onClose={() => setDetailHit(null)}
    />
    <AgentChatPanel
      result={result}
      selectedHit={selectedHit}
      query={query}
      mode={mode}
      appView={appView}
      discoverClusters={discover.data?.clusters ?? []}
    />
    </>
  );
}
