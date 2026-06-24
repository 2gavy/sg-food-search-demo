import { DishImage } from "./DishImage";

interface Props {
  onPick: (dishId: string) => void;
}

const DISHES = [
  "chicken_rice", "laksa", "satay", "char_kway_teow", "roti_prata",
  "bak_kut_teh", "fish_soup", "mee_rebus", "nasi_lemak", "hokkien_mee",
];

export function DishGallery({ onPick }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto scroll-touch snap-x snap-mandatory pb-2 -mx-1 px-1">
      {DISHES.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onPick(id)}
          className="shrink-0 snap-start group touch-manipulation min-w-[4.5rem]"
        >
          <DishImage
            dishId={id}
            className="h-16 w-16 sm:h-20 sm:w-20 border-2 border-transparent transition group-hover:border-brand group-active:border-brand group-hover:shadow-md"
          />
          <p className="text-[10px] text-center mt-1 capitalize text-slate-500 max-w-[4.5rem] truncate">{id.replace(/_/g, " ")}</p>
        </button>
      ))}
    </div>
  );
}
