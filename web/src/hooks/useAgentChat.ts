import { useCallback, useEffect, useState } from "react";
import type { SelectionContext } from "../lib/buildSelectionContext";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentStatus {
  configured: boolean;
  agent_id: string;
  agent_name: string;
  llm_configured?: boolean;
}

export function useAgentChat(active: boolean) {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetch("/agent/status")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({
            configured: false,
            agent_id: "sg-food-concierge",
            agent_name: "SG Food Concierge",
            llm_configured: false,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  const sendMessage = useCallback(
    async (message: string, selectionContext: SelectionContext | null) => {
      const trimmed = message.trim();
      if (!trimmed || loading || !selectionContext) return;

      setError(null);
      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setLoading(true);

      try {
        const res = await fetch("/agent/converse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            conversation_id: conversationId,
            selection_context: selectionContext,
          }),
        });

        if (!res.ok) {
          let detail = await res.text();
          try {
            const parsed = JSON.parse(detail) as { detail?: string };
            if (parsed.detail) detail = parsed.detail;
          } catch {
            /* keep raw text */
          }
          throw new Error(detail || `Agent request failed (${res.status})`);
        }

        const data = await res.json();
        if (data.conversation_id) setConversationId(data.conversation_id);
        setMessages((prev) => [...prev, { role: "assistant", content: data.message || "(empty response)" }]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setMessages((prev) => [...prev, { role: "assistant", content: `Sorry — ${msg}` }]);
      } finally {
        setLoading(false);
      }
    },
    [conversationId, loading],
  );

  const resetConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setError(null);
  }, []);

  return { status, messages, loading, error, sendMessage, resetConversation };
}
