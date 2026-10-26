// Runs `start` once, the first time `el` comes within `margin` of the
// viewport. A hand-made version of Astro's `client:visible` directive (which
// only applies to framework components): pair it with a dynamic import() and a
// module is not even DOWNLOADED until the thing that needs it is about to be
// seen.
//
//   whenVisible(canvas, async () => {
//     const { fluidThumb } = await import("./fluid-thumb");
//     fluidThumb(canvas);
//   });
//
// The margin starts the work a little ahead of the element, so it is drawn by
// the time it arrives rather than as it arrives.
export function whenVisible(el: Element, start: () => void, margin = "300px"): () => void {
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      io.disconnect();
      start();
    },
    { rootMargin: margin },
  );
  io.observe(el);
  return () => io.disconnect();
}
