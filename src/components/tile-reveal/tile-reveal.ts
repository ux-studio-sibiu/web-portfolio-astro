import { prefersReducedMotion } from "@/scripts/motion";

// A two-step cover over a positioned box: a grid of ~80px squares that
// glitter for COVER, then disappear one by one in random order over VANISH.
//
// Only the start is JS — the delays are handed to each square as custom
// properties and both steps run as CSS animations (tile-reveal.scss), so
// nothing ticks per frame while it plays.
//
// In Next this was a component with a `play` prop and the grid in React state.
// Here it is a function the controller calls when the pane opens: it builds
// the squares into the .nsc-tile-reveal box, takes them out again when the run
// is over, and returns a function that takes them out early (the pane closing
// mid-run).

// Nominal square size. The grid is whole squares, so the real size is this
// rounded to whatever divides the box.
const TILE = 80;
// Step 1: fully covered and glittering. Step 2: squares go, in random order.
const COVER = 500;
const VANISH = 1500;
// How long one square takes to go. Subtracted from VANISH so the last one
// finishes exactly on time rather than VANISH + FADE.
const FADE = 180;

type Square = { glitter: number; delay: number };

export function playTileReveal(root: HTMLElement): () => void {
  const clear = () => root.replaceChildren();
  clear();

  if (prefersReducedMotion()) return clear;

  const box = root.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return clear;

  const cols = Math.max(1, Math.round(box.width / TILE));
  const rows = Math.max(1, Math.round(box.height / TILE));

  const grid = document.createElement("div");
  grid.className = "grid";
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.append(
    ...buildSquares(cols * rows).map((s) => {
      const square = document.createElement("span");
      square.className = "square";
      square.style.setProperty("--glitter", `${s.glitter}ms`);
      square.style.setProperty("--delay", `${s.delay}ms`);
      return square;
    }),
  );
  root.append(grid);

  const id = window.setTimeout(clear, COVER + VANISH);
  return () => {
    window.clearTimeout(id);
    clear();
  };
}

// Every square gets a random glitter phase (a negative delay, so they are all
// already mid-flicker on the first frame) and its own moment to go: the order
// is shuffled, then spread evenly over VANISH, after COVER.
function buildSquares(count: number): Square[] {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const span = Math.max(count - 1, 1);
  const squares = new Array<Square>(count);
  order.forEach((square, pos) => {
    squares[square] = {
      glitter: -Math.round(Math.random() * 300),
      delay: COVER + Math.round((pos / span) * (VANISH - FADE)),
    };
  });
  return squares;
}
