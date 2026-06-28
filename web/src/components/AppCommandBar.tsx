import { ColumnLegend } from "./ColumnLegend";
import { AppViewToggle } from "./AppViewToggle";
import { SearchModeToggle } from "./SearchModeToggle";
import { SoundToggle } from "./SoundToggle";
import { DocTypeFilters } from "./DocTypeFilters";
import { TextSearchBar } from "./TextSearchBar";
import { PhotoUpload } from "./PhotoUpload";
import { PhotoSearchNotice } from "./PhotoSearchNotice";
import { DishGallery } from "./DishGallery";
import { SearchBreadcrumb } from "./SearchBreadcrumb";
import type { DemoQuery } from "../types/venue";

interface Props {
  appView: "search" | "discover";
  mode: "text" | "photo";
  query: string;
  demos: DemoQuery[];
  promptsOpen: boolean;
  docTypeFilter: string | null;
  soundsOn: boolean;
  loading: boolean;
  photoIsUpload: boolean;
  photoSessionKey: number;
  searchBreadcrumb: string | null;
  onAppViewChange: (v: "search" | "discover") => void;
  onModeChange: (m: "text" | "photo") => void;
  onSoundsToggle: () => void;
  onQueryChange: (q: string) => void;
  onSubmitText: () => void;
  onPromptsOpenChange: (open: boolean) => void;
  onSelectDemo: (demo: DemoQuery) => void;
  onDocTypeChange: (f: string | null) => void;
  onPhotoUpload: (uri: string) => void;
  onPhotoPick: (id: string) => void;
  onBreadcrumbBack: () => void;
}

export function AppCommandBar({
  appView,
  mode,
  query,
  demos,
  promptsOpen,
  docTypeFilter,
  soundsOn,
  loading,
  photoIsUpload,
  photoSessionKey,
  searchBreadcrumb,
  onAppViewChange,
  onModeChange,
  onSoundsToggle,
  onQueryChange,
  onSubmitText,
  onPromptsOpenChange,
  onSelectDemo,
  onDocTypeChange,
  onPhotoUpload,
  onPhotoPick,
  onBreadcrumbBack,
}: Props) {
  return (
    <div className="sticky top-0 z-30 -mx-3 px-3 sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6 pt-0 pb-3 sm:pb-4 bg-slate-100/90 backdrop-blur-md border-b border-slate-200/80">
      <header className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">SG Food Discovery</h1>
          <ColumnLegend />
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end sm:justify-start">
          <AppViewToggle view={appView} onChange={onAppViewChange} />
          {appView === "search" && <SearchModeToggle mode={mode} onChange={onModeChange} />}
          <SoundToggle on={soundsOn} onToggle={onSoundsToggle} />
        </div>
      </header>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white shadow-sm">
        {searchBreadcrumb && appView === "search" && (
          <div className="px-3 sm:px-4 py-2 border-b border-slate-100 bg-slate-50/60">
            <SearchBreadcrumb label={searchBreadcrumb} onBack={onBreadcrumbBack} />
          </div>
        )}

        <div className="p-3 sm:p-4">
          <CommandBody
            appView={appView}
            mode={mode}
            query={query}
            demos={demos}
            promptsOpen={promptsOpen}
            loading={loading}
            photoIsUpload={photoIsUpload}
            photoSessionKey={photoSessionKey}
            onQueryChange={onQueryChange}
            onSubmitText={onSubmitText}
            onPromptsOpenChange={onPromptsOpenChange}
            onSelectDemo={onSelectDemo}
            onPhotoUpload={onPhotoUpload}
            onPhotoPick={onPhotoPick}
          />

          {appView === "search" && (
            <DocTypeFilters value={docTypeFilter} onChange={onDocTypeChange} />
          )}
        </div>
      </div>
    </div>
  );
}

function CommandBody({
  appView,
  mode,
  query,
  demos,
  promptsOpen,
  loading,
  photoIsUpload,
  photoSessionKey,
  onQueryChange,
  onSubmitText,
  onPromptsOpenChange,
  onSelectDemo,
  onPhotoUpload,
  onPhotoPick,
}: Pick<
  Props,
  | "appView"
  | "mode"
  | "query"
  | "demos"
  | "promptsOpen"
  | "loading"
  | "photoIsUpload"
  | "photoSessionKey"
  | "onQueryChange"
  | "onSubmitText"
  | "onPromptsOpenChange"
  | "onSelectDemo"
  | "onPhotoUpload"
  | "onPhotoPick"
>) {
  if (appView === "discover") {
    return (
      <p className="text-sm text-slate-600 leading-relaxed">
        Browse food scenes inferred from the corpus — pick a scene or stall, then search across all three columns.
      </p>
    );
  }

  if (mode === "text") {
    return (
      <div className="flex flex-col sm:flex-row gap-2 w-full">
        <TextSearchBar
          query={query}
          onQueryChange={onQueryChange}
          onSubmit={onSubmitText}
          demos={demos}
          promptsOpen={promptsOpen}
          onPromptsOpenChange={onPromptsOpenChange}
          onSelectDemo={onSelectDemo}
        />
        <button
          type="button"
          onClick={onSubmitText}
          className="w-full sm:w-auto shrink-0 bg-brand text-white px-5 py-3 sm:py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-dark min-h-[44px] touch-manipulation shadow-sm"
        >
          Search
        </button>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-3">
      {loading ? <PhotoSearchNotice variant="loading" isUpload={photoIsUpload} /> : <PhotoSearchNotice />}
      <PhotoUpload key={photoSessionKey} onUpload={onPhotoUpload} />
      <DishGallery onPick={onPhotoPick} />
    </div>
  );
}

interface MapToggleProps {
  collapsed: boolean;
  onToggle: () => void;
  pinCount?: number;
}

export function MapCollapseToggle({ collapsed, onToggle, pinCount }: MapToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm touch-manipulation"
    >
      <MapIcon collapsed={collapsed} />
      {collapsed ? "Show map" : "Hide map"}
      {pinCount != null && pinCount > 0 && (
        <span className="text-[10px] tabular-nums text-slate-400">({pinCount})</span>
      )}
    </button>
  );
}

function MapIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden>
      {collapsed ? (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </>
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
      )}
    </svg>
  );
}
