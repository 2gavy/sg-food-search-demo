import type { Hit } from "../types/venue";
import { dishImageUrl } from "../components/DishImage";

/** Gallery dish ids with known /assets/food/*.jpg assets */
export const KNOWN_DISH_IDS = new Set([
  "chicken_rice",
  "laksa",
  "satay",
  "char_kway_teow",
  "roti_prata",
  "bak_kut_teh",
  "fish_soup",
  "mee_rebus",
  "nasi_lemak",
  "rojak",
  "hokkien_mee",
  "carrot_cake",
  "oyster_omelette",
  "kaya_toast",
  "mee_siam",
  "biryani",
  "yong_tau_foo",
  "wonton_mee",
  "popiah",
  "ice_kacang",
]);

const SIGNATURE_ALIASES: Record<string, string> = {
  "chicken rice": "chicken_rice",
  "hainanese chicken rice": "chicken_rice",
  laksa: "laksa",
  satay: "satay",
  "char kway teow": "char_kway_teow",
  "roti prata": "roti_prata",
  "bak kut teh": "bak_kut_teh",
  "fish soup": "fish_soup",
  "mee rebus": "mee_rebus",
  "nasi lemak": "nasi_lemak",
  rojak: "rojak",
  "hokkien mee": "hokkien_mee",
  "carrot cake": "carrot_cake",
  "oyster omelette": "oyster_omelette",
  "kaya toast": "kaya_toast",
  "mee siam": "mee_siam",
  biryani: "biryani",
  "yong tau foo": "yong_tau_foo",
  "wonton mee": "wonton_mee",
  popiah: "popiah",
  "ice kacang": "ice_kacang",
};

const DOC_TYPE_PLACEHOLDER: Record<string, string> = {
  hawker_stall: "char_kway_teow",
  restaurant: "chicken_rice",
  cafe: "kaya_toast",
  zi_char: "yong_tau_foo",
};

export function signatureDishToSlug(signatureDish: string): string | null {
  const normalized = signatureDish.toLowerCase().trim();
  if (SIGNATURE_ALIASES[normalized]) return SIGNATURE_ALIASES[normalized];

  const slug = normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (KNOWN_DISH_IDS.has(slug)) return slug;

  for (const id of KNOWN_DISH_IDS) {
    const label = id.replace(/_/g, " ");
    if (normalized.includes(label)) return id;
  }
  return null;
}

export function resolveVenueImageUrl(hit: Hit): string | null {
  if (hit.hero_image_url) return hit.hero_image_url;
  if (hit.dish_id && KNOWN_DISH_IDS.has(hit.dish_id)) return dishImageUrl(hit.dish_id);
  if (hit.signature_dish) {
    const slug = signatureDishToSlug(hit.signature_dish);
    if (slug) return dishImageUrl(slug);
  }
  const placeholder = DOC_TYPE_PLACEHOLDER[hit.doc_type];
  if (placeholder) return dishImageUrl(placeholder);
  return null;
}
