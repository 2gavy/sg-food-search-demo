import type { DemoQuery } from "../types/venue";

interface Props {
  demos: DemoQuery[];
  onSelect: (demo: DemoQuery) => void;
}

export function DemoQuerySelect({ demos, onSelect }: Props) {
  return (
    <select
      className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
      defaultValue=""
      onChange={(e) => {
        const demo = demos.find((d) => d.id === e.target.value);
        if (demo) onSelect(demo);
      }}
    >
      <option value="" disabled>
        Demo queries…
      </option>
      {demos.map((d) => (
        <option key={d.id} value={d.id}>
          {d.label}
        </option>
      ))}
    </select>
  );
}
