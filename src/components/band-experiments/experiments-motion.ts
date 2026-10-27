import { gsap, ScrollTrigger } from "@/scripts/gsap";

// The experiments band's motion, ported from the useGSAP block in the Next
// BandExperiments. The body below is that block verbatim; what changed is only
// the wrapper: a plain function given the band's element, returning the
// cleanup that useGSAP used to run for it.

// Where a frame starts and finishes its arrival, as positions of the ROW against
// the scroller: from its top reaching the bottom of the screen to its top a bit
// over halfway up, written as the percentages ScrollTrigger reads. Scrubbed, so
// these are scroll positions and not durations — the frame is wherever between
// them the scroll says it is, and it goes back the way it came.
const ARRIVE_FROM = 110;
const ARRIVE_TO = 50;
// A row of several frames — only the tools row — arrives over its own, much
// longer window, because the four of them come in one after another.
//
// The LAST frame's run is given outright, and it sets the pace for the rest:
// every other frame takes whatever run its own distance needs to cross at that
// same speed. They overlap as a result — one is still coming in as the next
// sets off — which is what lets each of them cross slowly while the whole row
// still settles inside the stretch of scroll it is on screen for.
//
// Where the whole group has finished arriving, as the position of the FRAMES'
// middle on the screen: everything is home by the time they reach half way up.
// Worked back to a row-top percentage at measure time, because how far that
// middle is from the row's top depends on how tall the frames are and how tall
// the screen is, and neither is known from here. The frames rather than the row:
// see the sum in schedule(), and what taking half of the row instead cost.
const GROUP_END = 50;
// How long the last frame is in motion. It is the only run stated outright, and
// it sets the pace every other frame travels at — so it is also the knob that
// decides whether a sequence FITS, and how much of one there is room for.
//
// It was 35, which put the longest run in Various at 57% of the screen. Four
// frames each taking that long cannot also be spaced far enough apart to read
// one at a time: the first would have had to set off at 126%, well below the
// bottom of the screen, and would have been half way across before the row came
// into view. Shortening it scales every run down in proportion — nothing here
// travels further, it all just travels faster.
//
// 22, and it is the ONLY number here that moved from the original 35. That 35
// was set against a Various row of four small squares; this one is half again as
// tall with wider frames, so the same run carried the first frame's start to
// 119% — below the bottom of the screen, arriving half crossed already. 22 is
// about the largest that keeps every frame setting off on screen while leaving
// the overlap where it was: 80% in the tools row, 96% in Various. At 24 that
// second number was 101%, a hair below the fold.
const GROUP_LAST_RUN = 22;
// The waits between them setting off, both shorter than a frame's run: they are
// staggered, not queued, so two or three are usually crossing at once. Where the
// first one sets off falls out of these — a fifth tool simply starts a delay
// earlier.
//
// Five is deliberately a small fraction of a run — about a seventh of one — so
// three or four frames are always crossing at once and the stack reads as one
// thing arriving rather than as a queue. That overlap is the effect, not a
// side-effect of it.
//
// Worth knowing before reaching for this: it was tried at 12 and at 20. At 20
// each frame all but lands before the next sets off, which is a clean cascade
// and much too slow and separated to read as one movement. At either value the
// runs also have to be cut hard to fit, which makes every frame snap across.
// The overlap is what lets each one travel slowly.
//
// Two numbers rather than one because the last frame is the feature: the stack
// comes in as a flurry, and then it follows on a beat of its own. That beat has
// to be longer than the difference in their runs, or the short trip from the
// divider would land it before the stack it is supposed to follow.
//
// GROUP_LAST_DELAY is a FLOOR, not the gap itself, and for most of its range it
// is not even the binding one — see GROUP_CLEAR, which sets a floor of its own
// and has been the larger of the two. Moving this from 20 down to 14 changed
// nothing at all; the clearance was holding the feature 20 behind the stack on
// its own. Both had to come down together.
const GROUP_DELAY = 5;
const GROUP_LAST_DELAY = 10;
// Daylight between two frames that share a band, on top of the distance that
// merely keeps them from overlapping. Without it they arrive on the same frame:
// same speed, and a head start of exactly the ground between them means the one
// in front finishes exactly as the one behind does, which reads as a pair moving
// as one rather than as two things arriving.
//
// It is also, in practice, what decides how far the feature trails the stack:
// the feature shares a band with every frame beside it, so this lands on top of
// their horizontal distance for each one. At 9 the big frame was still half out
// past the divider when the stack had settled. 4 brings it in behind them and
// still has it landing last, by 4% of the screen rather than 9.
const GROUP_CLEAR = 4;
// The latest a row's FIRST frame may set off, as a row-top percentage: just
// inside the bottom of the screen. A sequence counted back from its last frame
// can start well below that once a row is tall and has many frames — the
// Archive, at three lines and six frames, had its first frame setting off at
// 112%, so the top line was most of the way in before it came into view. Such
// a sequence is squeezed toward its end until it fits, every run and wait by
// the same factor, so order, overlap and pace between the frames stay as they
// were and it simply plays faster. A row that already fits (the tools row
// starts at about 80%) is left alone.
const GROUP_START_MAX = 98;

// Each frame slides in from under the right column. The clip that hides it on
// the way is in the stylesheet — see .entry-visual there; this only says how
// far out it starts and ties that to the scroll.
//
// GSAP rather than a view() timeline for once: this wants to work in Firefox,
// which has no scroll-driven animations, and a frame that never arrives there
// is a hole in the column rather than a missing flourish.
export function experimentsMotion(el: HTMLElement): () => void {
  // From tablet up this is the element that scrolls; below it the pane does,
  // and the media query below means we never get here anyway.
  const scroller = el.closest<HTMLElement>(".pane-scroll");
  if (!scroller) return () => {};

  const mm = gsap.matchMedia();

  // The same 768px the stylesheet splits the row into two columns at: with one
  // column there is nothing to the right to come from.
  mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
    // One per row, emptied when a refresh begins — see the cache by each
    // row's schedule() below.
    const invalidators: (() => void)[] = [];

    el.querySelectorAll<HTMLElement>(".entry-visual").forEach((visual) => {
      const row = visual.closest<HTMLElement>(".scroll-entry-secondary");
      if (!row) return;

      // What moves: the frames themselves, never the column — that carries the
      // clip, and a clip that travels with its contents hides nothing.
      //
      // The tools row has a grid of them, each arriving on its own; every other
      // row has a single frame, which is the same code with nothing to stagger
      // against.
      const cells = visual.querySelectorAll<HTMLElement>(".frame-cell");
      const frames = cells.length ? Array.from(cells) : ([visual.firstElementChild].filter(Boolean) as HTMLElement[]);

      // The right edge of the column, which is where the clip cuts.
      const edge = () => visual.offsetLeft + visual.offsetWidth;
      // A frame's left edge in the SAME coordinates as edge(): offsets summed up
      // to the column's own offsetParent. A frame's offsetLeft alone is measured
      // from ITS offsetParent, and the grids are position: sticky, which makes
      // the grid that parent. edge() minus that started every frame past the cut
      // by however far the grid sits in from the column's left (196px in the
      // Archive), so each crossed that much ground out of sight, and a narrower,
      // further-in grid looked faster rather than slower.
      const leftOf = (frame: HTMLElement) => {
        let x = 0;
        for (let el: HTMLElement | null = frame; el && el !== visual.offsetParent; el = el.offsetParent as HTMLElement | null) x += el.offsetLeft;
        return x;
      };

      const alone = frames.length === 1;

      // Alone, a frame crosses the whole window. In company they share it, one
      // after another with no overlap, on two rules:
      //
      //   ORDER   by where a frame sits, not where it is written: line by line
      //           and left to right within a line, so they arrive in the order
      //           they are read. A frame tall enough to span the others' lines
      //           — the tools feature — is the one exception and goes LAST, so
      //           the stack lands first and it settles against the divider
      //           after them.
      //
      //           This was offsetLeft first, which is column-major: right for
      //           the tools grid, where the stack IS a column, and wrong for
      //           Various the moment that row became two wrapped lines of two.
      //           There the left edges no longer track reading order, and it
      //           was arriving bottom-left, top-left, bottom-right, top-right.
      //   SHARE   by distance, not in equal slices, so they all travel at the
      //           same speed. The wide one against the divider has barely any
      //           ground to cover next to the stack crossing the whole column;
      //           on equal slices the small ones snapped across while the big
      //           one drifted.
      //
      // They overlap, and deliberately: the pace comes from the last frame's
      // stated run, the starts keep the order readable, and how long each one
      // is in motion falls out of the two.
      //
      // A function, not a value: the column is fluid, so the schedule is re-cut
      // from the measured positions every time ScrollTrigger refreshes.
      const schedule = () => {
        const distances = frames.map((f) => edge() - leftOf(f));
        // Which frame, if any, is the feature: taller than half again the
        // middle of the pack. Measured rather than declared, so the row that
        // has no such frame simply has none and nothing is special-cased.
        const heights = frames.map((f) => f.offsetHeight).sort((x, y) => x - y);
        const median = heights[Math.floor(heights.length / 2)];
        const isFeature = (f: HTMLElement) => f.offsetHeight > median * 1.5;

        const order = frames
          .map((_, i) => i)
          .sort((a, b) => {
            const fa = frames[a];
            const fb = frames[b];
            if (isFeature(fa) !== isFeature(fb)) return isFeature(fa) ? 1 : -1;
            return fa.offsetTop - fb.offsetTop || fa.offsetLeft - fb.offsetLeft;
          });

        // Percent of screen per pixel of travel, taken from the one frame whose
        // run is stated rather than derived. Everything else moves at this rate,
        // which is what keeps the small ones from outrunning the wide one.
        const last = order[order.length - 1];
        const pace = GROUP_LAST_RUN / (distances[last] || 1);
        const runOf = (i: number) => distances[i] * pace;

        // GROUP_END is where the FRAMES' middle should be when the last one
        // lands; ScrollTrigger measures the row's top, so half their height
        // comes off it. In percent of the screen, like everything else here.
        //
        // Measured off the FRAMES, not off the row and not off the column they
        // sit in. The row is the frames AND the copy beside them, and the copy
        // is by far the taller of the two — 589px against 336px in Various
        // once the frames grew. Taking half of 589 put the anchor at 34.9% of
        // the screen, so the last frame did not begin to move until it was
        // already well into view, leaving a hole where it should have been for
        // most of a screen of scrolling.
        //
        // .entry-visual is no better: it is a grid item and stretches to the
        // row's height, so it measured 525 of those 589. The frames' own
        // extent is the only thing here that is actually the frames.
        //
        // Divided by the row's --frame-scale (the Archive's is 0.8): a row drawn
        // smaller keeps the timing of its full size. Left alone, smaller frames
        // moved this anchor, and with it the sequence's end, down the screen:
        // the run got 7% shorter and, squeezed less to fit, the frames FASTER.
        // This way start, end and every run stay where they were, only the
        // distances shrink, so the same crossing happens more slowly.
        const top = Math.min(...frames.map((f) => f.offsetTop));
        const bottom = Math.max(...frames.map((f) => f.offsetTop + f.offsetHeight));
        // Per-row settings from the grid's CSS (custom properties), falling back to the constants above.
        // --frame-scale: see .various-entry; --arrive-delay, --arrive-last-delay, --arrive-clear: see .tools-entry.
        const gridStyle = getComputedStyle(frames[0].parentElement ?? visual);
        const setting = (name: string, fallback: number) => {
          const v = parseFloat(gridStyle.getPropertyValue(name));
          return Number.isFinite(v) ? v : fallback;
        };
        const frameScale = setting("--frame-scale", 1) || 1;
        const delay = setting("--arrive-delay", GROUP_DELAY);
        const lastDelay = setting("--arrive-last-delay", GROUP_LAST_DELAY);
        const clear = setting("--arrive-clear", GROUP_CLEAR);
        const halfRow = ((bottom - top) / frameScale / (scroller.clientHeight || 1)) * 50;
        const lastFrom = GROUP_END - halfRow + GROUP_LAST_RUN;

        // Counted back from the last frame's start: one longer wait to clear it,
        // then a shorter one between each of the rest.
        // Do two frames share any of the same horizontal band? Ranges rather
        // than equal tops, because a frame can span several rows — the feature
        // in the tools grid does.
        const sameBand = (a: HTMLElement, b: HTMLElement) =>
          a.offsetTop < b.offsetTop + b.offsetHeight && b.offsetTop < a.offsetTop + a.offsetHeight;

        // Counted back from the last frame's start, one wait at a time.
        const spans: { from: number; to: number }[] = [];
        let from = lastFrom;

        for (let place = order.length - 1; place >= 0; place--) {
          spans[order[place]] = { from, to: from - runOf(order[place]) };
          if (place === 0) break;

          const prev = frames[order[place - 1]];
          let next = from + (place === order.length - 1 ? lastDelay : delay);

          // The waits above are a rhythm, not a guarantee. Two frames that
          // share a band all set off from the same edge at the same speed, so
          // the wait between their starts IS the space between them — and a
          // wait shorter than the ground between their resting places has the
          // one behind laid over the one in front the whole way in. So each
          // frame also waits out its distance from every frame already
          // scheduled in its band, plus GROUP_CLEAR so the two are not still
          // level with each other when they land.
          for (let later = place; later < order.length; later++) {
            const other = frames[order[later]];
            if (!sameBand(prev, other)) continue;
            next = Math.max(next, spans[order[later]].from + Math.abs(prev.offsetLeft - other.offsetLeft) * pace + clear);
          }

          from = next;
        }

        // Squeezed toward where the sequence ends if it would set off below
        // the screen — see GROUP_START_MAX.
        const first = Math.max(...spans.map((s) => s.from));
        const end = Math.min(...spans.map((s) => s.to));
        if (first > GROUP_START_MAX && first > end) {
          const k = (GROUP_START_MAX - end) / (first - end);
          for (const s of spans) {
            s.from = end + (s.from - end) * k;
            s.to = end + (s.to - end) * k;
          }
        }

        return spans;
      };

      // schedule() re-measures the whole row and does O(n^2) work against it,
      // and it was read fresh by every frame's start AND its end — 2n runs per
      // refresh, each one a fistful of forced layout reads for an answer that
      // cannot change within a refresh. Computed once and held instead.
      //
      // Dropped when the NEXT refresh begins rather than kept for good,
      // because what it is cut from moves: the column is fluid, and refreshes
      // now happen on any change to the page's height rather than only on
      // resize — see the ResizeObserver in showcase-linear.tsx. That is also
      // what makes this worth doing: opening one Work history entry refreshes
      // every trigger on the page.
      let cached: ReturnType<typeof schedule> | null = null;
      const spansNow = () => (cached ??= schedule());
      invalidators.push(() => { cached = null; });

      frames.forEach((frame, i) => {
        // A trigger each rather than one tween with a stagger: a staggered
        // target sits at its FINAL position until its turn comes and then jumps
        // out to the edge to begin, which is a flash of the frame in place
        // before it arrives. Given its own trigger, a frame holds at the edge
        // until its own scroll position comes round.

        gsap.fromTo(
          frame,
          {
            // Pushed far enough right that its own left edge sits on the cut —
            // exactly out of sight and not a pixel further. Per frame, so the
            // ones in the narrow column travel the shorter distance they
            // actually need. Measured off the layout box rather than a rect,
            // because a rect would already have this transform in it and every
            // refresh would compound.
            x: () => edge() - leftOf(frame),
          },
          {
            x: 0,
            // A soft landing on top of the scroll.
            ease: "sine.out",
            scrollTrigger: {
              trigger: row,
              scroller,
              start: () => `top ${alone ? ARRIVE_FROM : spansNow()[i].from}%`,
              end: () => `top ${alone ? ARRIVE_TO : spansNow()[i].to}%`,
              scrub: true,
              // Thumbnails are pictures and the column is fluid, so the
              // distance is only right until something reflows.
              invalidateOnRefresh: true,
            },
          },
        );
      });
    });

    // refreshInit fires before positions are recomputed, so every row's cache
    // is empty by the time the first start() of that refresh asks for it.
    const dropCaches = () => invalidators.forEach((invalidate) => invalidate());
    ScrollTrigger.addEventListener("refreshInit", dropCaches);
    return () => ScrollTrigger.removeEventListener("refreshInit", dropCaches);
  });

  return () => mm.revert();
}
