import type { Hit } from "../types/venue";

/** Buyer-facing match line — hides RRF jargon where possible. */
export function formatBuyerMatchReason(hit: Hit, short = false): string | null {
  const { match_reason: reason, rank } = hit;
  if (!reason) return null;

  const rankSuffix = rank != null && !short ? ` (#${rank})` : "";

  if (reason.startsWith("visual:")) {
    return short ? "Visual match" : `Matched by dish photo${rankSuffix}`;
  }
  if (reason.startsWith("hybrid-jina:") || reason.startsWith("hybrid:")) {
    return short ? "Semantic" : `Semantic + keyword fusion${rankSuffix}`;
  }
  if (reason.startsWith("hybrid-oss:")) {
    return short ? "E5 semantic" : `Open-source semantic + keywords${rankSuffix}`;
  }
  if (reason.startsWith("oss-semantic:") || reason.startsWith("oss text:")) {
    return short ? "E5 text match" : `E5 text similarity${rankSuffix}`;
  }
  if (reason.startsWith("lexical:")) {
    return short ? "Keywords" : `Keyword match${rankSuffix}`;
  }
  if (reason.startsWith("semantic:") || reason.startsWith("oss:")) {
    const detail = reason.split(":", 2)[1]?.trim();
    if (detail && !short) return `Intent: ${detail}${rankSuffix}`;
    return short ? "Intent match" : `Intent match${rankSuffix}`;
  }

  return short ? reason.slice(0, 20) : reason;
}
