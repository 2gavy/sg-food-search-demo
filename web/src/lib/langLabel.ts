/** Badge colours per demo language label */
const LANG_BADGE: Record<string, string> = {
  "中文": "bg-red-50 text-red-800 ring-red-200",
  "繁體": "bg-rose-50 text-rose-800 ring-rose-200",
  "Melayu": "bg-emerald-50 text-emerald-800 ring-emerald-200",
  Singlish: "bg-violet-50 text-violet-800 ring-violet-200",
  "EN+MS+ZH": "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200",
  "日本語": "bg-sky-50 text-sky-800 ring-sky-200",
  "한국어": "bg-indigo-50 text-indigo-800 ring-indigo-200",
  "हिन्दी": "bg-amber-50 text-amber-900 ring-amber-200",
  "தமிழ்": "bg-orange-50 text-orange-900 ring-orange-200",
};

export function langBadgeClass(label: string): string {
  return LANG_BADGE[label] ?? "bg-violet-50 text-violet-800 ring-violet-200";
}

/** Guess script/language from typed query for the search bar badge */
export function detectQueryLang(query: string): string | null {
  const q = query.trim();
  if (!q) return null;

  const hasLatin = /[a-zA-Z]/.test(q);
  const hasHan = /[\u4e00-\u9fff]/.test(q);
  const hasKana = /[\u3040-\u30ff]/.test(q);
  const hasHangul = /[\uac00-\ud7af]/.test(q);
  const hasDevanagari = /[\u0900-\u097f]/.test(q);
  const hasTamil = /[\u0b80-\u0bff]/.test(q);
  const hasMalay = /\b(pedas|makcik|makan|mee|dekat|gaya|berhampiran|nasi)\b/i.test(q);

  const scripts = [hasHan, hasKana, hasHangul, hasDevanagari, hasTamil].filter(Boolean).length;
  if (scripts > 1 || (hasLatin && scripts > 0 && hasMalay)) return "Mixed";
  if (hasLatin && hasHan) return "Mixed";
  if (hasKana) return "日本語";
  if (hasHangul) return "한국어";
  if (hasDevanagari) return "हिन्दी";
  if (hasTamil) return "தமிழ்";
  if (hasHan) return "中文";
  if (hasMalay && !hasLatin) return "Melayu";
  if (hasMalay && hasLatin) return "Singlish";

  return null;
}
