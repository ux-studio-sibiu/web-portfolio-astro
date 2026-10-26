import { gsap } from "@/scripts/gsap";

// The divider's pull towards the cursor, ported from the useEffect in the Next
// ElasticLine. The body below is that effect verbatim; what changed is only the
// wrapper: a plain function given the <svg> and the surface whose pointer it
// watches, returning the cleanup the effect used to return.
import "./elastic-line.scss";

// A vertical hairline that is straight and still until the cursor comes within
// REACH of it. Inside that it is dragged around by the cursor's MOVEMENT rather
// than its position: flick sideways and the line is pulled that way, run along
// it and it is wrung into an S behind you. A cursor that stops moving — even
// one parked right on the line — lets it settle straight again.
//
// Two things are asked of whoever renders it:
//
//   surface   the element the cursor is tracked over. Scoped rather than the
//             window so a line that has been slid off-screen is not still being
//             thrown about against a stale rect.
//   a height  an svg is a replaced element: pin top and bottom and its height
//             stays auto, which resolves off the viewBox ratio instead of
//             stretching. Give it a real height or it hangs past the bottom.
//
// Everything else is its own. Placement — where it sits, what is above it,
// whether it shows at all — belongs to the stylesheet that puts it there; the
// width does not, because the svg has to be much wider than the line for it to
// have somewhere to swing, and that width is ROOM below. It is published as
// --room so the two cannot drift apart.
//
// The knobs, px unless said:
//
//   REACH  how close the cursor gets before the line reacts at all
//   PULL   the furthest a sideways flick can drag the line — unrelated to
//          REACH on purpose, and much larger than it
//   WRING  the furthest a lengthways flick can twist it
//   TOP    the cursor speed that reaches those limits, px per ms — anything
//          faster clamps there
//   SHARP  the half-width of the deformation — this is the "local" knob:
//          small is a tight kink, large is a broad bow
//   RELAX  how long the drag takes to bleed away once the cursor stops, ms
//   CHASE  how long the line takes to catch up to the drag, ms
//   EDGE   how much of each end is pinned, as a fraction of the height
//   STEPS  how many points the line is built from — has to be fine enough to
//          resolve SHARP, or a tight kink comes out as a polygon
//   ROOM   the svg's width, which has to clear PULL + WRING either side

// REACH and PULL are deliberately not in proportion: the cursor has to get
// within 50px to touch the line at all, and can then throw it 200px — four
// times as far as it ever had to be, so the line is routinely flung clean past
// the cursor flinging it. That mismatch is the effect; keep it if these get
// retuned.
const REACH = 50;
const PULL = 200;
const WRING = 58;
const TOP = 2.2;
const SHARP = 64;
const RELAX = 110;
const CHASE = 70;
const EDGE = 0.06;
const STEPS = 96;
// A sideways throw reaches PULL and a wrung one WRING, but the two lobes stack
// on a diagonal throw and peak at ~220 — hence 500 rather than the 400 that
// PULL alone would suggest. Measured, not guessed: the worst case is
// max|drag*bell + wring*bell'| along the curve, not PULL + WRING.
const ROOM = 500;
const X = ROOM / 2;
// Below this the line counts as straight and the whole thing shuts down.
const REST = 0.05;

// The deformation is a gaussian and its own derivative. The bell alone can only
// ever bulge; the derivative is one lobe out and one lobe back, which is what
// reads as a twist rather than a bump — and both are smooth curves all the way,
// so "sharp" here is narrow, never cornered. DPEAK is the derivative's own peak
// value, divided out so WRING stays an honest px.
const DPEAK = Math.sqrt(2 / Math.E);

// Smoothstep. Used for the end pinning and the proximity falloff, both of which
// want to arrive at their limits with the slope already flat — a linear ramp
// would put a visible crease at each end of its range.
const ramp = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

export function elasticLine(svg: SVGSVGElement, box: HTMLElement): () => void {
  // Every path in the svg, which is one today — kept as a list so a second
  // line laid over the first would be carried along for free.
  const paths = Array.from(svg.querySelectorAll("path"));
  if (!paths.length) return () => {};
  // Hidden by whoever placed it, so there is nothing to animate. Read off the
  // element rather than duplicated here as a breakpoint: the decision is the
  // placing stylesheet's, and this way the two cannot disagree.
  if (getComputedStyle(svg).display === "none") return () => {};
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};

  // `want` is what the cursor has just asked for, which bleeds away on its
  // own; `is` is where the line has actually got to. Two stages rather than
  // one, because the gap between them is the whip — the line arriving late
  // and overshooting nothing is what stops it feeling glued to the pointer.
  const want = { drag: 0, wring: 0 };
  const is = { drag: 0, wring: 0, at: 0.5 };
  // Where down the line the cursor is, 0-1, which `is.at` chases.
  let aim = 0.5;

  let rect = svg.getBoundingClientRect();

  // One smooth path through STEPS + 1 points, each curve handed off at the
  // midpoint between neighbours — the standard way to get a polyline to read
  // as a drawn curve rather than a chain of corners.
  const draw = () => {
    const h = rect.height;

    // At rest it is not a 96-point curve that happens to be flat, it is two
    // commands. Anything else leaves rounding wobble in a line that is
    // supposed to be dead straight.
    if (Math.abs(is.drag) < REST && Math.abs(is.wring) < REST) {
      const flat = `M ${X} 0 L ${X} ${h.toFixed(2)}`;
      for (const path of paths) path.setAttribute("d", flat);
      return;
    }

    const spread = SHARP / (h || 1);
    const xs: number[] = [];
    for (let i = 0; i <= STEPS; i++) {
      const u = i / STEPS;
      const z = (u - is.at) / spread;
      const bell = Math.exp(-z * z);
      // Pinned at both ends: the line has to meet the top and bottom edges
      // where it was put, no matter what is being done to its middle.
      const taper = ramp(u / EDGE) * ramp((1 - u) / EDGE);
      xs.push(X + taper * (is.drag * bell + (is.wring * -2 * z * bell) / DPEAK));
    }

    let d = `M ${xs[0].toFixed(2)} 0`;
    for (let i = 1; i < STEPS; i++) {
      const y = (i / STEPS) * h;
      const mx = (xs[i] + xs[i + 1]) / 2;
      const my = (y + ((i + 1) / STEPS) * h) / 2;
      d += ` Q ${xs[i].toFixed(2)} ${y.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
    }
    d += ` L ${xs[STEPS].toFixed(2)} ${h.toFixed(2)}`;

    for (const path of paths) path.setAttribute("d", d);
  };

  // Swapping the viewBox for the real pixel height is what puts the knobs
  // above in px. Cached here too, so a pointermove never reads layout.
  const size = () => {
    rect = svg.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${ROOM} ${rect.height}`);
    draw();
  };

  // The ticker only runs while there is something to animate, and takes
  // itself off the moment the line is straight again — "static" means no
  // per-frame work at all, not a cheap no-op sixty times a second.
  let running = false;
  let last = 0;

  const tick = () => {
    const now = performance.now();
    // Capped so a stall (a background tab, a long task) resumes where it left
    // off instead of jumping the whole missing interval in one frame.
    const dt = Math.min(64, now - last);
    last = now;

    // Both of these are 1 - e^(-dt/t) rather than a fixed fraction per frame,
    // so the line settles in the same wall-clock time at 60Hz and at 144Hz.
    const bleed = Math.exp(-dt / RELAX);
    want.drag *= bleed;
    want.wring *= bleed;

    const catchUp = 1 - Math.exp(-dt / CHASE);
    is.drag += (want.drag - is.drag) * catchUp;
    is.wring += (want.wring - is.wring) * catchUp;
    is.at += (aim - is.at) * catchUp;

    draw();

    // Both what was asked for and where the line got to have to be spent, or
    // it would stop mid-flick the frame the cursor did.
    if (Math.abs(want.drag) < REST && Math.abs(want.wring) < REST &&
        Math.abs(is.drag) < REST && Math.abs(is.wring) < REST) {
      is.drag = 0;
      is.wring = 0;
      draw();
      running = false;
      gsap.ticker.remove(tick);
    }
  };

  const wake = () => {
    if (running) return;
    running = true;
    last = performance.now();
    gsap.ticker.add(tick);
  };

  let px = 0;
  let py = 0;
  let pt = 0;

  const onMove = (e: PointerEvent) => {
    const first = pt === 0;
    // Clamped low and high: a 0ms gap would divide to infinity, and the long
    // gap after the cursor has been still reads as one enormous flick.
    const dt = Math.max(1, Math.min(64, e.timeStamp - pt));
    const vx = (e.clientX - px) / dt;
    const vy = (e.clientY - py) / dt;
    px = e.clientX;
    py = e.clientY;
    pt = e.timeStamp;
    // Nothing to compare the first move against, so it has no velocity yet.
    if (first) return;

    aim = (e.clientY - rect.top) / (rect.height || 1);
    // While nothing is moving the twist is put exactly where the cursor is
    // rather than chased up the line from wherever it last finished.
    if (!running) is.at = aim;

    const dx = e.clientX - (rect.left + rect.width / 2);
    const near = ramp(1 - Math.abs(dx) / REACH);
    // Beyond REACH the line is not merely undisturbed, nothing runs at all.
    if (near <= 0) return;

    // Direction comes from the cursor's velocity, so the line is dragged the
    // way the cursor is going. Speed is read as a fraction of TOP rather than
    // multiplied by a gain, which keeps the two independent: PULL alone says
    // how far a throw goes, TOP alone says how hard you have to throw, and
    // raising one no longer quietly changes the other. Beyond TOP it clamps,
    // so a violent flick lands where a firm one does instead of leaving the
    // svg box.
    want.drag = PULL * Math.max(-1, Math.min(1, vx / TOP)) * near;
    want.wring = WRING * Math.max(-1, Math.min(1, vy / TOP)) * near;
    wake();
  };

  // Nothing to do but let go: the ticker is already running and will settle
  // the line straight and then remove itself.
  const onLeave = () => {
    want.drag = 0;
    want.wring = 0;
  };

  size();
  window.addEventListener("resize", size);
  box.addEventListener("pointermove", onMove);
  box.addEventListener("pointerleave", onLeave);

  return () => {
    if (running) gsap.ticker.remove(tick);
    window.removeEventListener("resize", size);
    box.removeEventListener("pointermove", onMove);
    box.removeEventListener("pointerleave", onLeave);
  };
}
