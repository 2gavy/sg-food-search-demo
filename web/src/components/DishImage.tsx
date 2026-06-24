import { useState } from "react";

const DISH_EMOJI: Record<string, string> = {
  chicken_rice: "🍗",
  laksa: "🍜",
  satay: "🍢",
  char_kway_teow: "🥡",
  roti_prata: "🫓",
  bak_kut_teh: "🍲",
  fish_soup: "🐟",
  mee_rebus: "🍜",
  nasi_lemak: "🍚",
  rojak: "🥗",
  hokkien_mee: "🍝",
  carrot_cake: "🥕",
  oyster_omelette: "🦪",
  kaya_toast: "🍞",
  mee_siam: "🍜",
  biryani: "🍛",
  yong_tau_foo: "🥬",
  wonton_mee: "🥟",
  popiah: "🌯",
  ice_kacang: "🍧",
};

export function dishImageUrl(dishId: string) {
  return `/assets/food/${dishId}.jpg`;
}

interface Props {
  dishId: string;
  label?: string;
  className?: string;
}

export function DishImage({ dishId, label, className = "h-20 w-20" }: Props) {
  const [failed, setFailed] = useState(false);
  const alt = label ?? dishId.replace(/_/g, " ");
  const emoji = DISH_EMOJI[dishId] ?? "🍽️";

  if (failed) {
    return (
      <div
        className={`${className} flex items-center justify-center rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-300 text-3xl shadow-inner`}
        aria-label={alt}
        title={alt}
      >
        {emoji}
      </div>
    );
  }

  return (
    <img
      src={dishImageUrl(dishId)}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`${className} rounded-lg object-cover bg-slate-100`}
    />
  );
}
