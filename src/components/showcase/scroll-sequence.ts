// The identity fade and the section titles, as one sequence measured from the
// DOM so they stay in step at any viewport. Ported from the scroll effect in
// ShowcaseLinear; the numbers and the reasoning are unchanged.
//
// Two knobs, both fractions of the pane height rather than pixel counts:
//
//   TRIGGER    where the line sits that a band has to cross to own the title
//   FADE_OVER  how much scrolling the identity takes to fade, as a fraction
//
// The fade is timed to *finish exactly* as the first titled band crosses the
// trigger line, so there is never a gap with neither showing, nor a stretch
// where the title is held back after the identity has gone. A fixed pixel
// threshold cannot do that: band positions move with viewport size and text
// reflow, and 2000px landed 1382px early at 1280x720.
//
// Only bites from tablet up: below that .pane-scroll is not the scroller, so
// scrollTop stays 0 and the column scrolls away on its own.
//
// What it writes:
//
//   on the column  --identity-fade (the identity, 1 → 0), --sweep-px and
//                  --sweep-over (the pinned highlights in the blurb)
//   on both        --column-fade: the column fades with the rail on the way out,
//                  and the rail is not inside it — it is fixed to the viewport
//   on the shell   .is-column-hidden once that fade is complete
//
// and reports the rest — which section owns the title, and whether the rail is
// a black enough backdrop to invert the button against — through onChange,
// so the controller can put them in its state and render.

const TRIGGER = 0.5;
const FADE_OVER = 0.45;
// How far the pane scrolls before a pinned highlight is fully swept, as a
// fraction of the pane height. A phrase in the fixed column has no travel of
// its own to measure against, so this is the travel of the PAGE instead.
const SWEEP_OVER = 0.65;

type Options = {
  shell: HTMLElement;
  scroller: HTMLElement;
  column: HTMLElement;
  rail: HTMLElement;
  onChange: (section: string | null, lit: boolean) => void;
  // Called whenever the content changes height. Lesson 10 hangs
  // ScrollTrigger.refresh() off it.
  onResize?: () => void;
};

export function scrollSequence({ shell, scroller: el, column, rail, onChange, onResize }: Options) {
  let bands: HTMLElement[] = [];
  // What is actually measured against the trigger line, one per band. A band
  // is a box with padding on it, so its own top crosses the line well before
  // anything you can see does: a band can nominate the element it wants timed
  // off instead with `data-section-anchor`. Projects points at its first entry.
  let anchors: HTMLElement[] = [];
  let fadeEnd = 0;
  let fadeStart = 0;
  // The mirror of those two at the other end of the scroll: where the fixed
  // column starts and finishes fading back OUT as the last band comes up.
  let outroEnd = 0;
  let outroStart = 0;
  // Where the rail takes over from the identity — see `data-identity-handover`
  // below. Bands before it are read over the cover and light no title.
  let handoverIdx = 0;

  // Only report a change, not every frame: the controller re-renders on it.
  let lastSection: string | null | undefined;
  let lastLit: boolean | undefined;
  const report = (section: string | null, lit: boolean) => {
    if (section === lastSection && lit === lastLit) return;
    lastSection = section;
    lastLit = lit;
    onChange(section, lit);
  };

  // Scroll offsets are only valid until something reflows, so this is redone
  // on resize and whenever the content changes height.
  const measure = () => {
    bands = Array.from(el.querySelectorAll<HTMLElement>("[data-section]"));
    anchors = bands.map((node) => node.querySelector<HTMLElement>("[data-section-anchor]") ?? node);

    // Which band the identity gives way to. NOT simply the first one: bands
    // can sit above it that the cover is meant to stay up through — Work
    // history is read over the name, so the name has to still be there. A band
    // claims the handover with `data-identity-handover`, and the first band is
    // the fallback if none does.
    //
    // It is one moment, not two: the identity going and the rail arriving are
    // the same handover, so this index also gates which bands may light the
    // rail at all — see onScroll.
    const handover = bands.findIndex((node) => node.dataset.identityHandover !== undefined);
    handoverIdx = handover < 0 ? 0 : handover;
    const first = anchors[handoverIdx];
    if (!first) return;
    const paneTop = el.getBoundingClientRect().top;
    const offset = first.getBoundingClientRect().top - paneTop + el.scrollTop;
    fadeEnd = Math.max(0, offset - el.clientHeight * TRIGGER);
    fadeStart = Math.max(0, fadeEnd - el.clientHeight * FADE_OVER);

    // Same sum against the LAST band. The column is gone by the moment that
    // band crosses the trigger line, so the two handovers are symmetric: the
    // identity gives way to the rail as the first band arrives, and the whole
    // column gives way to the last one. Its own top, not an anchor: Contact is
    // the band being cleared for, so the gap above it is part of the run.
    const last = bands[bands.length - 1];
    const lastTop = last ? last.getBoundingClientRect().top - paneTop + el.scrollTop : 0;
    outroEnd = Math.max(0, lastTop - el.clientHeight * TRIGGER);
    outroStart = Math.max(0, outroEnd - el.clientHeight * FADE_OVER);
  };

  const onScroll = () => {
    const span = fadeEnd - fadeStart;
    const t = span > 0 ? Math.min(1, Math.max(0, (el.scrollTop - fadeStart) / span)) : 0;
    column.style.setProperty("--identity-fade", String(1 - t));
    // Published for .highlight-on-scroll.pinned, which cannot time itself off a
    // box that never moves. Two numbers rather than the finished fraction, so a
    // phrase can subtract its own delay from the pixels before dividing.
    const sweepOver = el.clientHeight * SWEEP_OVER;
    column.style.setProperty("--sweep-px", String(el.scrollTop));
    column.style.setProperty("--sweep-over", String(sweepOver > 0 ? sweepOver : 1));

    // And the column itself on the way out, on both boxes that fade with it.
    const outroSpan = outroEnd - outroStart;
    const o = outroSpan > 0 ? Math.min(1, Math.max(0, (el.scrollTop - outroStart) / outroSpan)) : 0;
    column.style.setProperty("--column-fade", String(1 - o));
    rail.style.setProperty("--column-fade", String(1 - o));
    // Gone rather than merely transparent, so the hamburger is not still
    // there to be pressed over the contact band.
    shell.classList.toggle("is-column-hidden", o === 1);
    // Halfway through that fade is where the rail stops being a black enough
    // backdrop to invert against. A flip rather than a ramp, smoothed by the
    // button's own colour transition.
    const lit = o < 0.5;

    // Below tablet this element does not scroll, so there is no meaningful
    // trigger line to measure against.
    if (el.scrollHeight <= el.clientHeight + 1) {
      report(null, lit);
      return;
    }

    // The last band whose anchor has passed the trigger line owns the title.
    // Not "the band covering the line": the final section starts below the
    // furthest that line can ever reach, so a containment test would never
    // light Contact at all. The count starts at the handover band: the bands
    // above it are read over the identity, and light nothing.
    const paneTop = el.getBoundingClientRect().top;
    const line = el.clientHeight * TRIGGER;
    let owner: string | null = null;
    for (let i = handoverIdx; i < bands.length; i++) {
      if (anchors[i].getBoundingClientRect().top - paneTop > line) break;
      owner = bands[i].dataset.section ?? null;
    }
    // The final band is shorter than the pane, so its top never reaches the
    // line however far you scroll — at the bottom of the scroll it wins
    // outright, otherwise Contact could never light.
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
    if (atBottom && bands.length) owner = bands[bands.length - 1].dataset.section ?? owner;

    report(owner, lit);
  };

  const remeasure = () => {
    measure();
    onScroll();
  };

  const wiring = new AbortController();
  const { signal } = wiring;

  remeasure();
  el.addEventListener("scroll", onScroll, { passive: true, signal });
  window.addEventListener("resize", remeasure, { signal });

  // Fonts loading, images decoding, a Work history entry opening — all move
  // the bands, and the offsets have to be taken again when they do. Window
  // resize does not cover content changing height inside a scroller of our
  // own; a ResizeObserver on the scroller and on its content does.
  const ro = new ResizeObserver(() => {
    remeasure();
    onResize?.();
  });
  ro.observe(el);
  if (el.firstElementChild) ro.observe(el.firstElementChild);

  return () => {
    wiring.abort();
    ro.disconnect();
  };
}
