import { prefersReducedMotion } from "@/scripts/motion";

// The label over the name ("Creative Developer"), whose words swap for another
// of their own readings, one word at a time and strictly in turn: the first,
// then the second, then back to the first. WHICH reading a word lands on is
// random, but never the one already showing.
//
// In Next this was RunLine (the turn counter, in state) handing a `turn` prop
// to each RunWord (the scramble, in an effect). Here one function does both
// for every .nsc-run-line on the page; the readings come from each word's
// `data-words`, written by RunWord.astro at build time.
//
// The characters a word is scrambled through. Deliberately plain ASCII, and
// that is the whole trick: this label is set in a MONOSPACE face, so every
// character is exactly as wide as every other, and a scramble that keeps the
// word's length occupies the identical box. Block-drawing glyphs look better
// for a frame or two, but the mono face does not carry them: the browser falls
// back to another font mid-scramble, and its taller line box pushes the page.
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+<>/";

// One frame of flicker, and how long each character waits before it locks in.
const FRAME = 45;
const PER_CHAR = 65;
// How often a word turns.
const EVERY = 3000;

export function runLines(): () => void {
  // A title rewriting itself every few seconds is motion, whatever else it is.
  if (prefersReducedMotion()) return () => {};

  const timers: number[] = [];

  document.querySelectorAll<HTMLElement>(".nsc-run-line").forEach((line) => {
    const words = Array.from(line.querySelectorAll<HTMLElement>(".run-word")).map((word) => ({
      text: word.querySelector<HTMLElement>(".word-text")!,
      readings: JSON.parse(word.dataset.words ?? "[]") as string[],
      showing: 0,
      scramble: 0,
    }));
    if (!words.length) return;

    // One timer for the line rather than one per word: the whole point is that
    // only one of them moves at a time, and independent timers would drift into
    // firing together.
    let turns = 0;
    timers.push(window.setInterval(() => {
      const word = words[turns++ % words.length];
      window.clearInterval(word.scramble);

      // Any reading but the one already up. Picked from the OTHER indices
      // rather than re-rolling until it differs, so there is no loop that can
      // spin.
      const others = word.readings.length - 1;
      if (others > 0) {
        const pick = Math.floor(Math.random() * others);
        word.showing = pick >= word.showing ? pick + 1 : pick;
      }
      const target = word.readings[word.showing];

      const started = performance.now();
      word.scramble = window.setInterval(() => {
        const revealed = Math.floor((performance.now() - started) / PER_CHAR);
        if (revealed >= target.length) {
          window.clearInterval(word.scramble);
          word.text.textContent = target;
          return;
        }
        word.text.textContent = Array.from(target, (char, i) => (i < revealed ? char : CHARS[Math.floor(Math.random() * CHARS.length)])).join("");
      }, FRAME);
      timers.push(word.scramble);
    }, EVERY));
  });

  return () => timers.forEach((id) => window.clearInterval(id));
}
