import { scrollBehavior } from "@/scripts/motion";
import { PaneHistory } from "./pane-history";
import { scrollSequence } from "./scroll-sequence";
import { forwardWheel } from "./forward-wheel";
import { ScrollTrigger } from "@/scripts/gsap";
import { elasticLine } from "@/components/elastic-line/elastic-line";
import { playTileReveal } from "@/components/tile-reveal/tile-reveal";
import { preloadEmbedsIn } from "@/scripts/embed-preload";

// <nsc-showcase>: the behaviour of the shell, as a custom element wrapped
// around its markup. It is where ShowcaseLinear's React state went — not into
// a framework, into the DOM.
//
// The state is a small object, and ONE function, render(), writes all of it to
// the page: classes, `inert`, the rail's title, the button's mode. Every
// handler changes the state and calls render(). That is the React model kept
// on purpose — state in, DOM out — just without React doing the diffing: the
// handful of things that depend on the state are named here, so there is
// nothing to diff.
//
//   sections   (lesson 06) the bands' `data-section` labels go to the rail and
//              the menu; a chosen section scrolls its band into view
//   jumps      (lesson 06) [data-scroll-to] buttons scroll to a project
//   detail     (lesson 07) [data-open] buttons clone that project's <template>
//              into the detail pane and slide the track over; Back, Escape and
//              the rail button slide it back
//   history    (lesson 08) opening pushes a history entry and closing goes
//              back past it (pane-history.ts), so the browser's back button
//              closes the pane too. The pane follows the history: it closes on
//              `popstate`, whichever way the history was moved.
//   scroll     (lesson 09) the identity fade, which band owns the rail's title,
//              the column fading out over Contact (scroll-sequence.ts) — it
//              reports `section` and `lit`, which render() writes to the rail;
//              and the wheel forwarded to the pane from the few fixed things
//              that take pointer events (forward-wheel.ts)
//   motion     (lesson 10) the divider's pull towards the cursor, the tile cover
//              over the pane as it opens, and ScrollTrigger refreshed whenever
//              the content changes height. The bands start their own GSAP.
//   preload    (lesson 12) each embed's site warmed as its entry comes into
//              view (src/scripts/embed-preload.ts)

type State = {
  // A project is showing. Driven by open/close.
  isDetail: boolean;
  // The last project opened. NOT cleared on close: the pane keeps its content
  // and the rail keeps the title through the slide back, so neither blanks
  // half way across. Replaced on the next open.
  open: string | null;
  // Which band owns the rail title, and whether the rail's black is actually
  // on screen. Both reported by the scroll sequence.
  section: string | null;
  lit: boolean;
};

// Every scroll-bound animation on the page is declared against its own element
// — "start when this row's top is 95% down the screen" — which reads as though
// it cannot care what is above it. It does: ScrollTrigger resolves that into an
// absolute scrollTop ONCE, when it refreshes, and anything that changes the
// height of the content above a trigger afterwards — fonts swapping in, a
// picture decoding, a Work history entry opening — leaves it wrong by exactly
// that shift. ScrollTrigger refreshes itself on window resize and on load,
// neither of which covers content changing height inside a scroller of our
// own; the scroll sequence's ResizeObserver, which watches exactly that, calls
// this. Coalesced to one per frame: a refresh recomputes every trigger on the
// page, and a ResizeObserver can fire several times for one reflow.
let refreshQueued = false;
const refreshTriggers = () => {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    ScrollTrigger.refresh();
  });
};

const MENU_ICON = `<span class="menu-bars" aria-hidden="true"></span>`;
const BACK_ICON = `<svg class="back-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 8h-11" /><path d="M7 3.5 2.5 8 7 12.5" /></svg>`;

class Showcase extends HTMLElement {
  #wiring?: AbortController;
  #history = new PaneHistory();
  // Takes the tile cover down early, if the pane closes while it is playing.
  #stopReveal?: () => void;
  #state: State = { isDetail: false, open: null, section: null, lit: false };

  // Elements render() writes to, looked up once.
  #el!: {
    track: HTMLElement;
    indexPane: HTMLElement;
    scroller: HTMLElement;
    detailPane: HTMLElement;
    detailScroll: HTMLElement;
    rail: HTMLElement;
    railBody: HTMLElement;
    railProject: HTMLElement;
    railButton: HTMLButtonElement;
    menu: HTMLElement & { open(): void; close(): void; setSections(labels: string[]): void };
  };

  connectedCallback() {
    const el = (this.#el = {
      track: this.querySelector(".showcase-track")!,
      indexPane: this.querySelector(".index-pane")!,
      scroller: this.querySelector(".index-pane .pane-scroll")!,
      detailPane: this.querySelector(".nsc-detail-pane")!,
      detailScroll: this.querySelector(".nsc-detail-pane .pane-scroll")!,
      rail: this.querySelector(".nsc-section-rail")!,
      railBody: this.querySelector(".rail-body")!,
      railProject: this.querySelector(".section-stack .rail-section:last-child")!,
      railButton: this.querySelector(".nsc-rail-button")!,
      menu: this.querySelector("nsc-side-menu")!,
    });

    this.#wiring = new AbortController();
    const { signal } = this.#wiring;

    this.#buildSections();

    const column = el.indexPane.querySelector<HTMLElement>(".pane-fixed")!;
    const stopSequence = scrollSequence({
      shell: this.querySelector(".nsc-showcase-linear")!,
      scroller: el.scroller,
      column,
      rail: el.rail,
      onChange: (section, lit) => {
        this.#state.section = section;
        this.#state.lit = lit;
        this.#render();
      },
      onResize: refreshTriggers,
    });
    const stopWheel = forwardWheel(el.scroller, [column, el.railButton]);
    // The divider watches the whole index pane for the cursor, not just itself.
    const stopLine = elasticLine(this.querySelector<SVGSVGElement>("svg.nsc-elastic-line")!, el.indexPane);
    // Warms each embed's site as its entry scrolls into view, so the connection
    // is open — and usually the document cached — by the time the pane opens.
    // Entries opt in with `data-preload` (the bands put the `href` there).
    const stopPreload = preloadEmbedsIn(el.scroller);
    // All of it cleans up with everything else when the element leaves the page.
    signal.addEventListener("abort", () => {
      stopSequence();
      stopWheel();
      stopLine();
      stopPreload();
      this.#stopReveal?.();
    });

    el.railButton.addEventListener("click", () => (this.#state.isDetail ? this.close() : el.menu.open()), { signal });
    el.detailPane.querySelector(".detail-back")!.addEventListener("click", () => this.close(), { signal });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.#state.isDetail) this.close();
    }, { signal });
    window.addEventListener("popstate", this.#onPopState, { signal });

    // Menu entries are section LABELS, matched back to the band that declared
    // one. scrollIntoView rather than a scrollTop sum, because which element
    // actually scrolls changes with the breakpoint — .pane-scroll from tablet
    // up, .index-pane below it — and this walks up to whichever one it is.
    this.addEventListener("menu-select", (e) => {
      el.menu.close();
      const label = (e as CustomEvent<string>).detail;
      const band = el.scroller.querySelector<HTMLElement>(`[data-section="${CSS.escape(label)}"]`);
      band?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    }, { signal });

    // Delegated: one listener on the shell catches a click on any button that
    // opens a project or jumps to one, however many there are and wherever
    // they sit — thumbnails, View buttons, names in the copy.
    this.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;

      const opener = target.closest<HTMLElement>("[data-open]");
      if (opener) {
        this.open(opener.dataset.open ?? "");
        return;
      }

      // Takes you to a project in the list from somewhere that has no business
      // holding a reference to one: Work history names the products it is
      // about, and they are projects further down the page.
      const jump = target.closest<HTMLElement>("[data-scroll-to]");
      if (jump) {
        const entry = el.scroller.querySelector<HTMLElement>(`[data-slug="${CSS.escape(jump.dataset.scrollTo ?? "")}"]`);
        entry?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      }
    }, { signal });

    this.#render();
  }

  disconnectedCallback() {
    this.#wiring?.abort();
  }

  // Opens a project by slug: its body cloned in from its <template>, the track
  // slid over. Cloning is what makes the body real — until now its iframe,
  // images and video were inert template content that had fetched nothing.
  open(slug: string) {
    const template = this.#el.detailPane.querySelector<HTMLTemplateElement>(`template[data-detail="${CSS.escape(slug)}"]`);
    if (!template) return;

    // Re-opening the project that is already in the pane keeps it as it is —
    // an iframe that has been navigated inside, a carousel on its fifth shot.
    if (this.#state.open !== slug) this.#el.detailScroll.replaceChildren(template.content.cloneNode(true));

    if (!this.#state.isDetail) {
      this.#history.push(slug);
      // Covers the frame for the length of the slide, then dissolves off it.
      this.#stopReveal = playTileReveal(this.#el.detailPane.querySelector(".nsc-tile-reveal")!);
    }
    this.#state.open = slug;
    this.#state.isDetail = true;
    this.#render();
  }

  // Asks to close the pane. It does not close it here: it moves the history
  // back past the pane's entry, and the `popstate` that follows closes it —
  // the same path the browser's own back button takes, so there is only one.
  close() {
    if (this.#state.isDetail) this.#history.back();
  }

  // The history has moved back past the pane's entry: the browser's back
  // button, a swipe, or close() above.
  #onPopState = () => {
    if (!this.#state.isDetail) return;
    this.#stopReveal?.();
    this.#state.isDetail = false;
    this.#render();
  };

  // Section labels in document order, read from the DOM rather than declared
  // twice. One rotated title per label goes into the rail, ahead of the span
  // kept for the open project's title, which is always last.
  #buildSections() {
    const el = this.#el;
    const labels = Array.from(el.scroller.querySelectorAll<HTMLElement>("[data-section]"))
      .map((band) => band.dataset.section ?? "")
      .filter(Boolean);

    el.railProject.before(
      ...labels.map((label) => {
        const span = document.createElement("span");
        span.className = "rail-section";
        span.dataset.label = label;
        span.textContent = label;
        return span;
      }),
    );

    // The menu is another custom element, defined by ANOTHER script. Both are
    // bundled into the page, but nothing promises which is defined first, and
    // until <nsc-side-menu> is, it is a plain element with no setSections().
    // whenDefined waits for it — immediately, if it already is.
    customElements.whenDefined("nsc-side-menu").then(() => el.menu.setSections(labels));
  }

  // State → DOM. Everything that depends on the state is written here and
  // nowhere else.
  #render() {
    const { isDetail, open, section, lit } = this.#state;
    const el = this.#el;

    // The slide, and which pane can be reached. `inert` takes the hidden pane
    // out of the tab order and away from screen readers, as well as the mouse.
    el.track.classList.toggle("is-detail", isDetail);
    el.indexPane.inert = isDetail;
    el.detailPane.inert = !isDetail;

    // The rail. A project, while one is up, takes the rail's title over from
    // the section, through the same cross-fade.
    el.rail.classList.toggle("is-detail", isDetail);
    el.railBody.classList.toggle("is-active", !!section);
    el.rail.querySelectorAll<HTMLElement>(".rail-section[data-label]").forEach((span) => {
      span.classList.toggle("is-active", !isDetail && span.dataset.label === section);
    });

    const template = open ? el.detailPane.querySelector<HTMLTemplateElement>(`template[data-detail="${CSS.escape(open)}"]`) : null;
    const top = template?.dataset.railTop;
    const height = template?.dataset.railHeight;
    el.railProject.textContent = template?.dataset.railTitle ?? "";
    el.railProject.classList.toggle("is-active", isDetail && !!template);
    // A box in the embed to centre the title on, instead of its usual place
    // under the button (the motion page's sidebar).
    el.railProject.classList.toggle("is-anchored", !!top);
    el.railProject.style.setProperty("--rail-project-top", top ? `${top}px` : "");
    el.railProject.style.setProperty("--rail-project-height", height ? `${height}px` : "");

    // The one button: the way into the menu while browsing, the way back out
    // of a project while one is open. Inverted while it sits on the black rail.
    const mode = isDetail ? "back" : "menu";
    if (el.railButton.dataset.mode !== mode) {
      el.railButton.dataset.mode = mode;
      el.railButton.innerHTML = isDetail ? BACK_ICON : MENU_ICON;
      el.railButton.setAttribute("aria-label", isDetail ? "Close the project" : "Open the section menu");
    }
    el.railButton.classList.toggle("is-inverted", !!section && lit);
  }
}

customElements.define("nsc-showcase", Showcase);
