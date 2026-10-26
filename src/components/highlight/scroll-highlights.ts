import { prefersReducedMotion } from "@/scripts/motion";

// Scrubs .highlight-on-scroll spans where the browser cannot: each phrase's
// band tracks scroll position through a --lit custom property (0 to 1), so it
// sweeps forwards on the way down and unwinds on the way back up. The sweep
// itself is CSS — see .highlight-on-scroll in globals.scss; this only supplies
// the progress.
//
// It stands down entirely where the browser can run the same sweep natively
// off a view() timeline, which is cheaper and off the main thread. Today that
// leaves Firefox.
//
// Two observers rather than one handler over everything: an
// IntersectionObserver keeps a small set of phrases that are near the
// viewport, and only those get measured on scroll. There are ~30 spans on the
// page and typically two or three are in play at once.
//
// Ported from the Next version's <ScrollHighlights /> component, which
// rendered nothing and existed only for its useEffect. Here it is what that
// always was: a script.

// Pinned phrases are excluded: they do not travel, so there is no rect to
// measure. Their sweep comes off --sweep-px in CSS instead (lesson 09).
// Selected ones never sweep.
const SELECTOR = ".highlight-on-scroll:not(.pinned):not(.is-selected)";

// Where the sweep starts and finishes, as fractions of viewport height
// measured against the phrase's own top edge. Matched to the native range in
// globals.scss: begins as the phrase clears the bottom edge, and is finished
// by the time it is 40% of the way up the page.
//
// Measured from the TOP, which is why 40% up the page is 0.6 here and
// `cover 40%` there. The two are the same line on the screen stated from
// opposite ends; change one and the other has to follow.
const START = 1;
const END = 0.6;

function scrubHighlights() {
  const live = new Set<HTMLElement>();
  // A small random offset per phrase, so several in one paragraph do not
  // complete in lockstep.
  const offsets = new WeakMap<HTMLElement, number>();

  const progressOf = (el: HTMLElement, viewportH: number) => {
    const top = el.getBoundingClientRect().top;
    const from = viewportH * START;
    const to = viewportH * END;
    const raw = (from - top) / (from - to);
    const shifted = raw - (offsets.get(el) ?? 0);
    return Math.min(1, Math.max(0, shifted));
  };

  let queued = false;
  const update = () => {
    queued = false;
    const viewportH = window.innerHeight;

    // Read every rect first, then write — mixing them would thrash layout.
    const readings: Array<[HTMLElement, number]> = [];
    live.forEach((el) => readings.push([el, progressOf(el, viewportH)]));

    for (const [el, p] of readings) {
      el.style.setProperty("--lit", String(p));
      // Only the no-text-clip fallback uses this; harmless elsewhere.
      el.classList.toggle("is-lit", p > 0.5);
    }
  };

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        if (entry.isIntersecting) {
          if (!offsets.has(el)) offsets.set(el, Math.random() * 0.18);
          live.add(el);
        } else {
          live.delete(el);
          // Settle to whichever end it left by, so a phrase scrolled past
          // quickly does not freeze half swept.
          const done = entry.boundingClientRect.top < 0;
          el.style.setProperty("--lit", done ? "1" : "0");
          el.classList.toggle("is-lit", done);
        }
      }
      schedule();
    },
    // Generous margin: start tracking before the phrase is on screen so its
    // band is already partway when it arrives.
    { rootMargin: "20% 0px 20% 0px" },
  );

  const watch = (node: Node) => {
    if (!(node instanceof HTMLElement)) return;
    if (node.matches(SELECTOR)) io.observe(node);
    node.querySelectorAll(SELECTOR).forEach((el) => io.observe(el));
  };

  if (prefersReducedMotion()) {
    // No scrub: show the finished state and leave it.
    document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => el.style.setProperty("--lit", "1"));
    return;
  }

  watch(document.body);

  // Project detail bodies are cloned in on demand (lesson 07), so pick up
  // whatever arrives later.
  new MutationObserver((records) => {
    for (const record of records) record.addedNodes.forEach(watch);
  }).observe(document.body, { childList: true, subtree: true });

  // Scroll events do not bubble, but they do reach a capturing listener on the
  // document — which matters because the scrolling element differs by
  // breakpoint and the detail pane scrolls separately.
  document.addEventListener("scroll", schedule, { capture: true, passive: true });
  window.addEventListener("resize", schedule, { passive: true });
}

// The browser does it better; nothing for this script to do.
if (!CSS.supports("animation-timeline", "view()")) scrubHighlights();
