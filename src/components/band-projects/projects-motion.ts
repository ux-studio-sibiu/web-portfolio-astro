import { gsap, ScrollTrigger } from "@/scripts/gsap";

// The projects band's motion, ported from the useGSAP block in the Next
// BandProjects. The body below is that block verbatim; what changed is only
// the wrapper: a plain function given the band's element, returning the
// cleanup that useGSAP used to run for it.

// Where a thumbnail starts and finishes arriving, as positions of its ENTRY
// against the scroller: from its top near the bottom of the screen to its top a
// little past halfway up. The same two figures the experiments band arrives on —
// see ARRIVE_FROM / ARRIVE_TO there — so a project and an experiment come in at
// the same point of their own travel.
//
// It is over well before the entry's top reaches the pin line, so the slide has
// always finished by the time the thumbnail sticks.
const ARRIVE_FROM = 95;
const ARRIVE_TO = 55;
// Daylight between two thumbnails that travel the same track, on top of the
// ground that merely keeps them from touching. Without it they clear each other
// by exactly nothing and read as one object sliding in.
const THUMB_CLEAR = 6;

// A pinned thumbnail holds at full strength for as long as it is pinned, and
// fades once it is let go. The window is read off the page rather than guessed:
// it begins where the entry's bottom catches up with the bottom of the pinned
// box — the moment the pin ends and the thumbnail starts travelling with the
// page again — and runs for the thumbnail's own height of scroll after that, so
// it is gone by the time it has moved its own length and never simply slides
// off the top still visible.
//
// Scrubbed, so it is scroll position and not a duration: scroll back up and the
// thumbnail comes back.
export function projectsMotion(el: HTMLElement): () => void {
  // From tablet up this is the element that scrolls, and it is also the only
  // width at which the thumbnails pin at all.
  const scroller = el.closest<HTMLElement>(".pane-scroll");
  if (!scroller) return () => {};

  const mm = gsap.matchMedia();

  mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
    // Arrival. Each thumbnail waits out of sight past the right edge of its
    // column and slides to its resting place as the entry comes up — the same
    // reveal the experiments frames have, and the same two positions of the
    // trigger against the scroller, so the two bands read as one page.
    //
    // Separate from the fade below on purpose. This moves the THUMBNAIL, the
    // fade moves the sticky box around it, so neither touches a property the
    // other owns and the pin is untouched by both. Putting the slide on the
    // sticky box itself would have worked too, but a transform on a sticky
    // element is the kind of thing that stops working quietly.

    // One per entry, emptied when a refresh begins — see the cache by each
    // entry's schedule() below.
    const invalidators: (() => void)[] = [];

    el.querySelectorAll<HTMLElement>(".scroll-entry").forEach((entry) => {
      const column = entry.querySelector<HTMLElement>(".entry-visual");
      if (!column) return;

      // How far a thumbnail has to go to put its own left edge on the cut the
      // clip-path makes — out of sight, and not a pixel further.
      //
      // Rects rather than offsetLeft, unlike the experiments band: there the
      // frames and their column share an offsetParent, here they do not.
      // .visual-sticky is `position: sticky`, which makes it the offsetParent
      // of the thumbnails inside it while the column is measured against
      // something further out, and subtracting the two gave a distance 80px
      // long on the first entry.
      //
      // Rects have the current transform baked in, which is what the comment
      // in the experiments band warns about — so the transform is taken back
      // off, and the answer is the resting geometry however often it is asked.
      const travel = (thumb: HTMLElement) => {
        const current = Number(gsap.getProperty(thumb, "x")) || 0;
        return column.getBoundingClientRect().right - (thumb.getBoundingClientRect().left - current);
      };

      const thumbs = Array.from(entry.querySelectorAll<HTMLElement>(".entry-thumb"));

      // One thumbnail crosses the whole window on its own. Two — the
      // photography entry — share it on the same two rules the experiments
      // band shares a row by:
      //
      //   ORDER  left to right. They all set off from the same cut, so the
      //          one whose resting place is furthest from it has the longest
      //          trip and has to leave first.
      //   SPEED  one speed for both, not one window for both. Sharing the
      //          window made the far one travel twice as fast to cover twice
      //          the ground, and they landed together.
      //
      // The waits are what keeps them from ever being drawn on top of each
      // other. Both start with their left edge ON the cut, so at rest-time
      // zero they are stacked exactly — and a wait shorter than the ground
      // between their resting places leaves them overlapping the whole way
      // in. Each therefore waits out the full distance to the one ahead, plus
      // THUMB_CLEAR so they are not still touching when they land.
      //
      // Moving at one speed with that head start, the gap between them is
      // constant for the whole crossing: they overlap in TIME — both are
      // travelling at once for most of it — and never in space.
      //
      // offsetLeft is safe here where it was not for the column: these are
      // siblings, so they share an offsetParent.
      const schedule = () => {
        const travels = thumbs.map(travel);
        const lefts = thumbs.map((t) => t.offsetLeft);
        const order = thumbs.map((_, i) => i).sort((a, b) => lefts[a] - lefts[b]);

        // Set by the LAST to arrive, the one nearest the cut: it gets the
        // plain single-thumbnail window, and everything else takes whatever
        // run its own distance needs at that speed.
        const last = order[order.length - 1];
        const pace = (ARRIVE_FROM - ARRIVE_TO) / (travels[last] || 1);

        const spans: { from: number; to: number }[] = [];
        let from = ARRIVE_TO + travels[last] * pace;

        for (let place = order.length - 1; place >= 0; place--) {
          const i = order[place];
          spans[i] = { from, to: from - travels[i] * pace };
          if (place === 0) break;
          const ahead = order[place - 1];
          from += Math.abs(lefts[i] - lefts[ahead]) * pace + THUMB_CLEAR;
        }

        return spans;
      };

      // Read by both ends of every thumbnail's trigger, so it is worked out
      // once per refresh rather than 2n times — the same cache the
      // experiments band keeps, for the same reason.
      let cached: ReturnType<typeof schedule> | null = null;
      const spansNow = () => (cached ??= schedule());
      invalidators.push(() => { cached = null; });

      thumbs.forEach((thumb, i) => {
        gsap.fromTo(
          thumb,
          { x: () => travel(thumb) },
          {
            x: 0,
            // Linear: the scroll is the easing.
            ease: "none",
            scrollTrigger: {
              trigger: entry,
              scroller,
              start: () => `top ${spansNow()[i].from}%`,
              end: () => `top ${spansNow()[i].to}%`,
              scrub: true,
              invalidateOnRefresh: true,
            },
          },
        );
      });
    });

    el.querySelectorAll<HTMLElement>(".scroll-entry").forEach((entry) => {
      const visual = entry.querySelector<HTMLElement>(".visual-sticky");
      // The last entry's visual is static — there is nothing after it to push
      // the pin off, so it never sticks and has nothing to fade through.
      if (!visual || getComputedStyle(visual).position !== "sticky") return;

      // Read at refresh rather than held: the offset is a rem value that changes
      // at the breakpoint, and the height is a picture's.
      const offset = () => parseFloat(getComputedStyle(visual).top) || 0;

      gsap.to(visual, {
        // autoAlpha, not opacity: it takes visibility with it at zero, so a
        // thumbnail faded to nothing stops swallowing the clicks meant for
        // whatever is under it. It is a button, and it is pinned across the
        // top of the screen.
        autoAlpha: 0,
        // Linear: the scroll is the easing.
        ease: "none",
        scrollTrigger: {
          trigger: entry,
          scroller,
          start: () => `bottom top+=${offset() + visual.offsetHeight}`,
          end: () => `bottom top+=${offset()}`,
          scrub: true,
          invalidateOnRefresh: true,
        },
      });
    });

    // refreshInit fires before positions are recomputed, so every entry's
    // cache is empty by the time the first start() of that refresh asks.
    const dropCaches = () => invalidators.forEach((invalidate) => invalidate());
    ScrollTrigger.addEventListener("refreshInit", dropCaches);
    return () => ScrollTrigger.removeEventListener("refreshInit", dropCaches);
  });

  return () => mm.revert();
}
