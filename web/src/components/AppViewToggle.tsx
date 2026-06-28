import { SegmentedControl } from "./SegmentedControl";

const OPTIONS = [
  { value: "search" as const, label: "Search" },
  { value: "discover" as const, label: "Discover" },
];

interface Props {
  view: "search" | "discover";
  onChange: (view: "search" | "discover") => void;
}

export function AppViewToggle({ view, onChange }: Props) {
  return (
    <SegmentedControl
      value={view}
      options={OPTIONS}
      onChange={onChange}
      ariaLabel="Search or discover food scenes"
    />
  );
}
