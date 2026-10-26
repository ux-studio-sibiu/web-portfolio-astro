// Runs `start` once, the first time the page is wide enough for the motion
// and the visitor has not asked for less of it — now, or later, if the window
// is widened or the setting changes.
//
// It exists to keep GSAP off phones. Every GSAP effect on the page — the
// thumbnails sliding in, the frames arriving, the elastic divider — only runs
// from tablet width up, so on a phone the library (113 kB, the largest script
// here) was downloaded and executed for nothing. Lighthouse's mobile run
// counted that: its simulated Speed Index sat at 2.8–4.2s while the observed
// one, on the same load, was 1.4s — the screen was finished, but late script
// work (and the layouts it triggers) kept the estimate climbing. Callers
// import the GSAP modules dynamically inside `start`, so on a phone they are
// never requested at all.
//
// The query is the same one the effects use themselves in gsap.matchMedia().
const MOTION = "(min-width: 768px) and (prefers-reduced-motion: no-preference)";

export function onDesktopMotion(start: () => void) {
  const query = window.matchMedia(MOTION);
  if (query.matches) {
    start();
    return;
  }
  const wait = (e: MediaQueryListEvent) => {
    if (!e.matches) return;
    query.removeEventListener("change", wait);
    start();
  };
  query.addEventListener("change", wait);
}
