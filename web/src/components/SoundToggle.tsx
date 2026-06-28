interface Props {
  on: boolean;
  onToggle: () => void;
}

function SpeakerOnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H3v6h3l5 4V5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a9 9 0 010 12.73" />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H3v6h3l5 4V5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M23 9l-6 6M17 9l6 6" />
    </svg>
  );
}

export function SoundToggle({ on, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`shrink-0 inline-flex items-center justify-center rounded-lg border min-h-[44px] min-w-[44px] touch-manipulation shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 ${
        on
          ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          : "border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100"
      }`}
      aria-label={on ? "Mute sounds" : "Enable sounds"}
      title={on ? "Sound on" : "Sound off"}
    >
      {on ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
    </button>
  );
}
