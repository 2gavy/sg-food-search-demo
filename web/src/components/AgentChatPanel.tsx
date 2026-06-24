import { useEffect, useMemo, useRef, useState } from "react";
import { useAgentChat } from "../hooks/useAgentChat";
import { buildSelectionContext } from "../lib/buildSelectionContext";
import type { CompareResponse, Hit } from "../types/venue";
import { ConciergeLoading } from "./ConciergeLoading";
import { ConciergeMarkdown } from "./ConciergeMarkdown";
import { useVenueGraph } from "../hooks/useVenueGraph";

interface Props {
  result: CompareResponse | null;
  selectedHit: Hit | null;
  query: string;
  mode: "text" | "photo";
}

const QUICK_PROMPTS = [
  "Which stores are related to this one?",
  "Why did this venue match my search?",
  "How does this rank across the three columns?",
  "Should I try this stall — what stands out?",
];

export function AgentChatPanel({ result, selectedHit, query, mode }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { status, messages, loading, sendMessage, resetConversation } = useAgentChat(open);
  const { graph, loading: graphLoading } = useVenueGraph(selectedHit?.doc_id, open && Boolean(selectedHit));

  const selectionContext = useMemo(
    () => (selectedHit ? buildSelectionContext(selectedHit, result, query, mode, graph) : null),
    [selectedHit, result, query, mode, graph],
  );

  const canSend = Boolean(selectionContext && status?.configured && !loading);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  const closePanel = () => {
    setOpen(false);
    resetConversation();
    setInput("");
  };

  const submit = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || !selectionContext) return;
    void sendMessage(msg, selectionContext);
    if (!text) setInput("");
  };

  return (
    <div className="fixed bottom-4 right-4 z-[300] flex flex-col items-end gap-2 pointer-events-none">
      {open && (
        <div
          className="pointer-events-auto w-[min(100vw-2rem,400px)] h-[min(70vh,520px)] flex flex-col rounded-2xl border border-emerald-200/80 bg-white/95 shadow-2xl shadow-emerald-900/10 backdrop-blur-md overflow-hidden"
          role="dialog"
          aria-label="SG Food Concierge"
        >
          <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-950 truncate">
                {status?.agent_name ?? "SG Food Concierge"}
              </p>
              <p className="text-[11px] text-emerald-700/80 truncate">
                {loading
                  ? "Agent Builder · generating…"
                  : status?.configured
                    ? "Agent Builder · selected result"
                    : status?.llm_configured === false
                      ? "Set LLM_CONNECTOR_ID in .env"
                      : "Connecting…"}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
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
            <div className="px-4 py-2 text-xs text-amber-900 bg-amber-50 border-b border-amber-100">
              Agent Builder activates only when this panel is open. Set{" "}
              <code className="text-[10px]">LLM_CONNECTOR_ID</code> in <code className="text-[10px]">.env</code> to your
              Kibana LLM connector (Alerts → Connectors → your chat_completion model).
            </div>
          )}

          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80">
            {selectionContext ? (
              <div className="text-[11px] leading-snug text-slate-600 space-y-1">
                <p className="font-medium text-slate-800">Selected for Agent Builder</p>
                <p className="text-emerald-800 font-medium">{selectionContext.selected.title}</p>
                <p>
                  Query: <span className="text-slate-700">"{selectionContext.query}"</span>
                </p>
                <p className="text-slate-500">
                  {[
                    selectionContext.columns.lexical && `Keywords #${selectionContext.columns.lexical.rank}`,
                    selectionContext.columns.hybrid_oss && `E5 #${selectionContext.columns.hybrid_oss.rank}`,
                    selectionContext.columns.hybrid_jina && `Jina #${selectionContext.columns.hybrid_jina.rank}`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Not ranked in compare columns"}
                </p>
                {graphLoading && <p className="text-violet-600">Loading graph hops…</p>}
                {!graphLoading && graph && graph.edges.length > 0 && (
                  <p className="text-violet-700">
                    Graph ({graph.engine ?? "structural"}): {graph.edges.length} related stall
                    {graph.edges.length === 1 ? "" : "s"} — {graph.summary}
                  </p>
                )}
                {!graphLoading && graph && graph.edges.length === 0 && (
                  <p className="text-slate-400">No same_dish / same_hawker graph neighbors for this pin</p>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 leading-snug">
                Click a result card or map pin first — only your <strong className="text-slate-700">selected</strong> venue
                is sent to Agent Builder when you chat.
              </p>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-sm text-slate-500 space-y-2 pt-2">
                <p>
                  Open this panel to wake Agent Builder. Your selected stall and its column ranks are attached to each
                  message — not the full result list.
                </p>
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
          </div>

          {selectionContext && messages.length === 0 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((p) => (
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
            className="p-3 border-t border-slate-100 bg-white flex gap-2"
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
                !selectionContext
                  ? "Select a venue first…"
                  : status?.configured
                    ? "Ask about this selection…"
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
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-label="Sending" />
              ) : (
                "Send"
              )}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => (open ? closePanel() : setOpen(true))}
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/25 hover:bg-emerald-700 transition-transform hover:scale-[1.02] active:scale-[0.98]"
        aria-expanded={open}
        aria-label={open ? "Close SG Food Concierge" : "Open SG Food Concierge"}
      >
        <span className="text-lg leading-none" aria-hidden>
          💬
        </span>
        <span>Concierge</span>
        {selectionContext && !open && (
          <span className="w-2 h-2 rounded-full bg-amber-300 ring-2 ring-emerald-600" title="Venue selected" />
        )}
      </button>
    </div>
  );
}
