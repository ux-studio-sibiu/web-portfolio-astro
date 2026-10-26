import { scrollBehavior } from "@/scripts/motion";
import { PaneHistory } from "./pane-history";

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
//
// Lesson 09 adds the scroll sequence, which is what will set `section` and `lit`.

type State = {
  // A project is showing. Driven by open/close.
  isDetail: boolean;
  // The last project opened. NOT cleared on close: the pane keeps its content
  // and the rail keeps the title through the slide back, so neither blanks
  // half way across. Replaced on the next open.
  open: string | null;
  // Which band owns the rail title, and whether the rail's black is actually
  // on screen. Both stay at their top-of-page values until lesson 09.
  section: string | null;
  lit: boolean;
};

const MENU_ICON = `<span class="menu-bars" aria-hidden="true"></span>`;
const BACK_ICON = `<svg class="back-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 8h-11" /><path d="M7 3.5 2.5 8 7 12.5" /></svg>`;

class Showcase extends HTMLElement {
  #wiring?: AbortController;
  #history = new PaneHistory();
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

    if (!this.#state.isDetail) this.#history.push(slug);
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
