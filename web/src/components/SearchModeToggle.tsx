import { SegmentedControl } from "./SegmentedControl";

const OPTIONS = [
  { value: "text" as const, label: "Text" },
  { value: "photo" as const, label: "Photo" },
];

interface Props {
  mode: "text" | "photo";
  onChange: (mode: "text" | "photo") => void;
}

export function SearchModeToggle({ mode, onChange }: Props) {
  return (
    <SegmentedControl
      value={mode}
      options={OPTIONS}
      onChange={onChange}
      ariaLabel="Text or photo search"
      compact
    />
  );
}
