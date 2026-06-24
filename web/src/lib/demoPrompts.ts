/** English demo prompts — search autocomplete + welcome hero. */
export const ENGLISH_HERO_IDS = ["rainy_soup_cbd", "halal_bugis", "healthy_chicken_rice"] as const;

/** Multilingual quick picks in search autocomplete (subset of hero). */
export const MULTILINGUAL_AUTOCOMPLETE_IDS = [
  "zh_halal_bugis",
  "mixed_halal_bugis",
  "ja_soup_cbd",
] as const;

/** Full multilingual cards on the welcome hero. */
export const MULTILINGUAL_HERO_IDS = [
  "zh_halal_bugis",
  "mixed_halal_bugis",
  "ms_pedas",
  "ja_soup_cbd",
  "ta_halal_bugis",
] as const;

function pickDemos<T extends { id: string }>(demos: T[], ids: readonly string[]) {
  return ids.map((id) => demos.find((d) => d.id === id)).filter((d): d is T => !!d);
}

export { pickDemos };
