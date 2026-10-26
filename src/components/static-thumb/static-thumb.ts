// StaticThumb's canvas, ported from its useEffect in the Next component. The
// body below is that effect verbatim; what changed is only the wrapper: a plain
// function given the <canvas>, returning the cleanup the effect returned (or
// nothing, where the effect bailed out early — no context, no WebGL).
//
// Loaded on demand: StaticThumb.astro imports this module only once the frame
// is about to come on screen (see src/scripts/when-visible.ts).

// Static background's thumbnail: the experiment itself, drawn rather than
// embedded. It is a film-grain generator, so a picture of one — or a whole page
// loaded in an iframe to draw one — says less than the thing running.
//
// The technique is the experiment's own, and it is the reason this costs almost
// nothing to keep on screen:
//
//   CELL   noise is generated into a buffer one pixel per cell and stretched to
//          fill with smoothing off, so a 150px frame is a couple of dozen pixels
//          of work rather than fifteen thousand. The cells being large is the
//          whole look, not a compromise for speed — though it is both.
//   FPS    redrawn at a film rate rather than the screen's. Eight is below the
//          experiment's own 24 on purpose: this is a thumbnail, and at 24 a
//          grain field this coarse reads as flicker rather than as grain.
//
// It only moves while the frame is pointed at or focused; at rest it is a single
// still frame of the same noise. That also settles what the experiment solves
// with an off-screen pause and a hidden-tab pause: nothing is running unless
// someone is looking straight at it.
//
// prefers-reduced-motion is honoured the way the experiment honours it — one
// frame, and it stays there however much it is hovered.
const CELL = 7;
const FPS = 8;

export function staticThumb(el: HTMLCanvasElement): (() => void) | undefined {
  const ctx = el.getContext("2d", { alpha: false });
  if (!ctx) return;

  // One pixel per cell. Re-cut whenever the frame changes size, because the
  // buffer is what decides how square a cell comes out.
  let buffer: ImageData | null = null;
  const resize = () => {
    const w = Math.max(1, Math.round(el.clientWidth / CELL));
    const h = Math.max(1, Math.round(el.clientHeight / CELL));
    // `buffer` in the test, not just the size. The canvas element survives a
    // remount with its width and height attributes already on it, so on the
    // next mount the size matches before any buffer exists — and skipping on
    // size alone left `buffer` null, which makes draw() a no-op for good. The
    // timer runs, the interval fires, and nothing is ever painted.
    if (buffer && el.width === w && el.height === h) return;
    el.width = w;
    el.height = h;
    buffer = ctx.createImageData(w, h);
    // Smoothing is reset by a size change, so it is set again here rather
    // than once on mount. Without it the cells come out as a grey blur.
    ctx.imageSmoothingEnabled = false;
  };

  // One random grey per cell. Alpha is left opaque and the canvas has no
  // alpha channel at all — this is the picture, not an overlay over one.
  const draw = () => {
    if (!buffer) return;
    const d = buffer.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(buffer, 0, 0);
  };

  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  let timer: number | null = null;

  const stop = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
  };
  // setInterval rather than rAF: the whole point is to redraw well under the
  // screen's rate, and a rAF loop that throws away five frames in six is five
  // sixths wasted wake-ups.
  const start = () => {
    if (timer !== null || still.matches) return;
    timer = window.setInterval(draw, 1000 / FPS);
  };

  // One frame at rest, so the thumbnail is a still photograph of static rather
  // than an empty box — the grain only MOVES on hover.
  resize();
  draw();

  const ro = new ResizeObserver(() => { resize(); draw(); });
  ro.observe(el);

  // The button around it is what is hovered, exactly as with every other frame
  // in this row — the canvas is only the picture inside it. Listening here
  // rather than on the canvas also means the whole frame is the target,
  // including whatever padding the button carries.
  const host = el.closest<HTMLElement>(".entry-thumb") ?? el;

  // Mouse only, like the cards on the other frames: a touch screen has no
  // hover, and a tap is opening the thing rather than asking to look at it.
  const onEnter = (e: PointerEvent) => { if (e.pointerType === "mouse") start(); };
  const onLeave = () => { stop(); draw(); };

  host.addEventListener("pointerenter", onEnter);
  host.addEventListener("pointerleave", onLeave);
  // And the keyboard gets the same, since the frame is a button and can be
  // tabbed to.
  host.addEventListener("focusin", start);
  host.addEventListener("focusout", onLeave);

  still.addEventListener("change", () => { stop(); draw(); });

  return () => {
    stop();
    ro.disconnect();
    host.removeEventListener("pointerenter", onEnter);
    host.removeEventListener("pointerleave", onLeave);
    host.removeEventListener("focusin", start);
    host.removeEventListener("focusout", onLeave);
  };
}
