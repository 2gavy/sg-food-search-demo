import { useEffect, useMemo, useRef, useState } from "react";
import { useAgentChat } from "../hooks/useAgentChat";
import { buildAgentContext } from "../lib/buildSelectionContext";
import type { CompareResponse, DiscoverCluster, Hit } from "../types/venue";
import { ConciergeLoading } from "./ConciergeLoading";
import { ConciergeMarkdown } from "./ConciergeMarkdown";
import { useVenueGraph } from "../hooks/useVenueGraph";

interface Props {
  result: CompareResponse | null;
  selectedHit: Hit | null;
  query: string;
  mode: "text" | "photo";
  appView: "search" | "discover";
  discoverClusters?: DiscoverCluster[];
}

const COMPARE_PROMPTS = [
  "Why did hybrid find venues keywords missed?",
  "Compare E5 vs Jina for this query.",
  "Which stall should I try first?",
];

const BROWSE_PROMPTS = [
  "What can this demo show me?",
  "Explain keywords vs hybrid search.",
  "Suggest a great demo query.",
];

const VENUE_PROMPTS = [
  "Tell me about this stall.",
  "What dish should I try here?",
  "Any similar stalls nearby?",
];

export function AgentChatPanel({
  result,
  selectedHit,
  query,
  mode,
  appView,
  discoverClusters = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    status,
    messages,
    loading,
    error,
    asksRemaining,
    asksLimit,
    sendMessage,
    resetConversation,
  } = useAgentChat(open);
  const { graph, loading: graphLoading } = useVenueGraph(
    selectedHit?.doc_id,
    open && Boolean(selectedHit),
  );

  const agentContext = useMemo(
    () =>
      buildAgentContext(result, query, mode, selectedHit, graph, {
        appView,
        discoverClusters,
      }),
    [selectedHit, result, query, mode, graph, appView, discoverClusters],
  );

  const isCompare = agentContext.context_type === "compare";
  const atLimit = asksRemaining !== null && asksRemaining <= 0;
  const canSend = Boolean(status?.configured && !loading && !atLimit);

  const quickPrompts = selectedHit ? VENUE_PROMPTS : isCompare ? COMPARE_PROMPTS : BROWSE_PROMPTS;

  const statusLine = (() => {
    if (loading) return "Agent Builder · generating…";
    if (!status?.configured) {
      return status?.llm_configured === false ? "Set LLM_CONNECTOR_ID in .env" : "Connecting…";
    }
    if (selectedHit) return `Focused on ${selectedHit.title.split("—")[0].trim()}`;
    if (isCompare) return "Compare results attached";
    if (appView === "discover") return "Discover scenes attached";
    return "Ready — ask anything";
  })();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(max-width: 1023px)");
    if (!mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const closePanel = () => {
    setOpen(false);
    resetConversation();
    setInput("");
  };

  const submit = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || !canSend) return;
    void sendMessage(msg, agentContext);
    if (!text) setInput("");
  };

  const panelBody = (
    <>
      <header className="flex items-center justify-between gap-2 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-950 truncate">
            {status?.agent_name ?? "SG Food Concierge"}
          </p>
          <p className="text-[11px] text-emerald-700/80 truncate">{statusLine}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {asksRemaining !== null && (
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                atLimit ? "bg-amber-100 text-amber-900" : "bg-emerald-100/80 text-emerald-800"
              }`}
              title={`${asksLimit} asks per browser session`}
            >
              {atLimit ? "0 left" : `${asksRemaining}/${asksLimit}`}
            </span>
          )}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={resetConversation}
              className="text-[11px] px-2 py-1 rounded-md text-emerald-700 hover:bg-emerald-100/80"
              title="New conversation"
            >
              New
            </button>
          )}
          <button
            type="button"
            onClick={closePanel}
            className="w-8 h-8 rounded-full text-emerald-800 hover:bg-emerald-100/80 flex items-center justify-center"
            aria-label="Close concierge"
          >
            ✕
          </button>
        </div>
      </header>

      {!status?.configured && status && (
        <div className="px-4 py-2 text-xs text-amber-900 bg-amber-50 border-b border-amber-100 shrink-0">
          Set <code className="text-[10px]">LLM_CONNECTOR_ID</code> in your deployment env to enable Agent Builder.
        </div>
      )}

      {atLimit && (
        <div className="px-4 py-2 text-xs text-amber-900 bg-amber-50 border-b border-amber-100 shrink-0">
          You&apos;ve used all {asksLimit} concierge asks this session. Open a new private window or try again tomorrow.
        </div>
      )}

      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 text-[11px] leading-snug text-slate-600 space-y-1 shrink-0">
        {selectedHit ? (
          <>
            <p className="font-medium text-slate-800">
              {isCompare ? "Focused venue (optional)" : "Selected stall"}
            </p>
            <p className="text-emerald-800 font-medium">{selectedHit.title}</p>
            {graphLoading && <p className="text-violet-600">Loading graph hops…</p>}
            {!graphLoading && graph && graph.edges.length > 0 && (
              <p className="text-violet-700">
                Graph: {graph.edges.length} related stall{graph.edges.length === 1 ? "" : "s"}
              </p>
            )}
          </>
        ) : isCompare ? (
          <>
            <p className="font-medium text-slate-800">Compare results attached</p>
            <p>
              Query: <span className="text-slate-700">&quot;{agentContext.query}&quot;</span>
            </p>
            <p className="text-slate-500">Top hits from all three columns included. Tap a card to focus on one stall.</p>
          </>
        ) : appView === "discover" && discoverClusters.length > 0 ? (
          <>
            <p className="font-medium text-slate-800">Discover scenes attached</p>
            <p className="text-slate-500">
              {discoverClusters.length} food scenes from clustering — ask about themes or pick a stall.
            </p>
          </>
        ) : (
          <p>
            Ask about the demo, hybrid search, or Singapore food. Run a search anytime to attach live compare results.
          </p>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 overscroll-contain">
        {messages.length === 0 && (
          <div className="text-sm text-slate-500 space-y-2 pt-2">
            <p>No setup needed — just ask. Search or pick a stall anytime to add more context.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[88%] rounded-2xl px-3 py-2 ${
                m.role === "user"
                  ? "bg-emerald-600 text-white rounded-br-md text-sm leading-relaxed whitespace-pre-wrap"
                  : "bg-slate-100 text-slate-800 rounded-bl-md"
              }`}
            >
              {m.role === "user" ? m.content : <ConciergeMarkdown content={m.content} />}
            </div>
          </div>
        ))}
        {loading && <ConciergeLoading />}
        {error && !loading && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5">{error}</p>
        )}
      </div>

      {messages.length === 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
          {quickPrompts.map((p) => (
            <button
              key={p}
              type="button"
              disabled={!canSend}
              onClick={() => submit(p)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <form
        className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-slate-100 bg-white flex gap-2 shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            atLimit
              ? "Ask limit reached"
              : status?.configured
                ? "Ask the concierge…"
                : "Set LLM_CONNECTOR_ID first"
          }
          disabled={!canSend}
          className="flex-1 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={!canSend || !input.trim()}
          className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 min-w-[4.5rem] flex items-center justify-center"
        >
          {loading ? (
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
              aria-label="Sending"
            />
          ) : (
            "Send"
          )}
        </button>
      </form>
    </>
  );

  return (
    <>
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-[300] flex flex-col bg-white"
          role="dialog"
          aria-label="SG Food Concierge"
          aria-modal="true"
        >
          {panelBody}
        </div>
      )}

      {open && (
        <div className="hidden lg:flex fixed bottom-4 right-4 z-[300] flex-col items-end pointer-events-none">
          <div
            className="pointer-events-auto w-[min(100vw-2rem,400px)] h-[min(70vh,520px)] flex flex-col rounded-2xl border border-emerald-200/80 bg-white/95 shadow-2xl shadow-emerald-900/10 backdrop-blur-md overflow-hidden"
            role="dialog"
            aria-label="SG Food Concierge"
          >
            {panelBody}
          </div>
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-[300] flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/25 hover:bg-emerald-700 transition-transform hover:scale-[1.02] active:scale-[0.98] mb-[max(0px,env(safe-area-inset-bottom))] mr-[max(0px,env(safe-area-inset-right))]"
          aria-expanded={false}
          aria-label="Open SG Food Concierge"
        >
          <span className="text-lg leading-none" aria-hidden>
            💬
          </span>
          <span>Concierge</span>
        </button>
      )}
    </>
  );
}
