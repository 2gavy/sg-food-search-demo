import { useCallback, useEffect, useState } from "react";
import { agentHeaders } from "../lib/demoSession";
import type { AgentContext } from "../lib/buildSelectionContext";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentStatus {
  configured: boolean;
  agent_id: string;
  agent_name: string;
  llm_configured?: boolean;
  asks_limit?: number;
  asks_remaining?: number;
}

export function useAgentChat(active: boolean) {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asksRemaining, setAsksRemaining] = useState<number | null>(null);

  const refreshStatus = useCallback(() => {
    fetch("/agent/status", { headers: agentHeaders() })
      .then((r) => r.json())
      .then((data: AgentStatus) => {
        setStatus(data);
        if (typeof data.asks_remaining === "number") setAsksRemaining(data.asks_remaining);
      })
      .catch(() => {
        setStatus({
          configured: false,
          agent_id: "sg-food-concierge",
          agent_name: "SG Food Concierge",
          llm_configured: false,
          asks_limit: 3,
          asks_remaining: 0,
        });
      });
  }, []);

  useEffect(() => {
    if (!active) return;
    refreshStatus();
  }, [active, refreshStatus]);

  const sendMessage = useCallback(
    async (message: string, agentContext: AgentContext) => {
      const trimmed = message.trim();
      if (!trimmed || loading) return;
      if (asksRemaining !== null && asksRemaining <= 0) {
        setError("No concierge asks left this session (limit is 3).");
        return;
      }

      setError(null);
      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setLoading(true);

      try {
        const res = await fetch("/agent/converse", {
          method: "POST",
          headers: agentHeaders(),
          body: JSON.stringify({
            message: trimmed,
            conversation_id: conversationId,
            selection_context: agentContext,
            session_id: agentHeaders()["X-Demo-Session"],
          }),
        });

        if (!res.ok) {
          let detail = await res.text();
          try {
            const parsed = JSON.parse(detail) as { detail?: string };
            if (parsed.detail) detail = parsed.detail;
          } catch {
            /* keep raw */
          }
          throw new Error(detail || `Agent request failed (${res.status})`);
        }

        const data = await res.json();
        if (data.conversation_id) setConversationId(data.conversation_id);
        if (typeof data.asks_remaining === "number") setAsksRemaining(data.asks_remaining);
        setMessages((prev) => [...prev, { role: "assistant", content: data.message || "(empty response)" }]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setMessages((prev) => [...prev, { role: "assistant", content: `Sorry — ${msg}` }]);
        refreshStatus();
      } finally {
        setLoading(false);
      }
    },
    [conversationId, loading, asksRemaining, refreshStatus],
  );

  const resetConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    refreshStatus();
  }, [refreshStatus]);

  return {
    status,
    messages,
    loading,
    error,
    asksRemaining,
    asksLimit: status?.asks_limit ?? 3,
    sendMessage,
    resetConversation,
  };
}
