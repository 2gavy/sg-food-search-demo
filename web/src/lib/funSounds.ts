/** Lightweight Web Audio bleeps — no files, works offline after first tap. */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = "sine", gain = 0.12) {
  const ac = audio();
  if (!ac) return;

  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  g.gain.setValueAtTime(0, ac.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + duration);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + duration + 0.05);
}

function chord(freqs: number[], start: number, duration: number, gain = 0.07) {
  freqs.forEach((f) => tone(f, start, duration, "triangle", gain));
}

/** Warm up audio on first user gesture (mobile browsers). */
export function primeSounds() {
  audio();
}

export function playClick() {
  tone(520, 0, 0.06, "sine", 0.1);
  tone(780, 0.03, 0.05, "sine", 0.06);
}

export function playSelect() {
  tone(440, 0, 0.08, "triangle", 0.11);
  tone(660, 0.05, 0.1, "triangle", 0.09);
  tone(880, 0.1, 0.12, "sine", 0.07);
}

export function playSearch() {
  chord([392, 494, 587], 0, 0.14, 0.08);
  tone(784, 0.12, 0.18, "sine", 0.1);
}

export function playModeSwitch() {
  tone(330, 0, 0.07, "square", 0.05);
  tone(550, 0.08, 0.1, "square", 0.05);
}

export function playFilter() {
  tone(600, 0, 0.05, "sine", 0.08);
}

export function playSuccess() {
  chord([523, 659, 784, 1047], 0, 0.2, 0.09);
  tone(1318, 0.15, 0.25, "triangle", 0.08);
}

export function playNewBadge() {
  tone(988, 0, 0.06, "sine", 0.09);
  tone(1175, 0.04, 0.08, "sine", 0.07);
}
