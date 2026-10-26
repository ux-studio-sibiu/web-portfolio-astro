// DataVizThumb's canvas, ported from its useEffect in the Next component. The
// body below is that effect verbatim; what changed is only the wrapper: a plain
// function given the <canvas>, returning the cleanup the effect returned (or
// nothing, where the effect bailed out early — no context, no WebGL).
//
// Loaded on demand: DataVizThumb.astro imports this module only once the frame
// is about to come on screen (see src/scripts/when-visible.ts).

// "The carbon divide" thumbnail: the globe cut out (a transparent PNG) over a
// field of light static. The static is drawn the way StaticThumb draws its own
// (see static-thumb.tsx): one pixel per CELL into a tiny buffer, stretched with
// smoothing off, redrawn at FPS. Same grain size, but only light greys
// (LIGHTEST…DARKEST), so it reads as paper with grain rather than a TV.
//
// It runs the other way round from StaticThumb: moving at rest, still while the
// frame is pointed at or focused, so the globe settles when you look at it.
// Off screen or in a hidden tab it stops; with reduced motion it is one still frame.
const CELL = 7;
const FPS = 8;
const LIGHTEST = 255;
const DARKEST = 235;

export function dataVizThumb(el: HTMLCanvasElement): (() => void) | undefined {
  const ctx = el.getContext("2d", { alpha: false });
  if (!ctx) return;

  // Re-cut on resize; `buffer` in the test for the same remount reason as StaticThumb
  let buffer: ImageData | null = null;
  const resize = () => {
    const w = Math.max(1, Math.round(el.clientWidth / CELL));
    const h = Math.max(1, Math.round(el.clientHeight / CELL));
    if (buffer && el.width === w && el.height === h) return;
    el.width = w;
    el.height = h;
    buffer = ctx.createImageData(w, h);
    ctx.imageSmoothingEnabled = false; // reset by a size change
  };

  const draw = () => {
    if (!buffer) return;
    const d = buffer.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (DARKEST + Math.random() * (LIGHTEST - DARKEST)) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(buffer, 0, 0);
  };

  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  const host = el.closest<HTMLElement>(".entry-thumb") ?? el;
  let timer: number | null = null, onScreen = false, looking = false;

  // One place decides: running only when on screen, not looked at, and motion is welcome
  const update = () => {
    const run = onScreen && !looking && !still.matches;
    if (run && timer === null) timer = window.setInterval(draw, 1000 / FPS);
    if (!run && timer !== null) { window.clearInterval(timer); timer = null; }
  };

  resize();
  draw();

  const ro = new ResizeObserver(() => { resize(); draw(); });
  ro.observe(el);
  const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update(); });
  io.observe(el);

  const look = () => { looking = true; update(); };
  const away = () => { looking = false; update(); };
  const onEnter = (e: PointerEvent) => { if (e.pointerType === "mouse") look(); };
  host.addEventListener("pointerenter", onEnter);
  host.addEventListener("pointerleave", away);
  host.addEventListener("focusin", look);
  host.addEventListener("focusout", away);
  still.addEventListener("change", update);

  return () => {
    if (timer !== null) window.clearInterval(timer);
    ro.disconnect();
    io.disconnect();
    host.removeEventListener("pointerenter", onEnter);
    host.removeEventListener("pointerleave", away);
    host.removeEventListener("focusin", look);
    host.removeEventListener("focusout", away);
    still.removeEventListener("change", update);
  };
}
