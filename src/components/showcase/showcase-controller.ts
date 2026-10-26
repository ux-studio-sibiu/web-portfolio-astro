import { scrollBehavior } from "@/scripts/motion";

// <nsc-showcase>: the behaviour of the shell, as a custom element wrapped
// around its markup. It is where ShowcaseLinear's React state went — not into
// a framework, into the DOM: classes, attributes and a few listeners.
//
// What it does so far (lesson 06):
//
//   sections   reads the bands' `data-section` labels, in page order, and hands
//              them to the rail and the menu — the only place they are declared
//              is on the bands themselves
//   menu       the rail button opens the side menu; a chosen section scrolls
//              its band into view
//   jumps      [data-scroll-to] buttons (Work history) scroll to a project
//
// Lessons 07 to 09 add the detail pane, history and the scroll sequence here.
class Showcase extends HTMLElement {
  #wiring?: AbortController;

  connectedCallback() {
    const scroller = this.querySelector<HTMLElement>(".pane-scroll")!;
    const menu = this.querySelector<HTMLElement & { open(): void; close(): void; setSections(labels: string[]): void }>("nsc-side-menu")!;
    const railButton = this.querySelector<HTMLButtonElement>(".nsc-rail-button")!;
    const stack = this.querySelector<HTMLElement>(".section-stack")!;

    this.#wiring = new AbortController();
    const { signal } = this.#wiring;

    // Section labels in document order, read from the DOM rather than declared
    // twice. One rotated title per label goes into the rail, ahead of the span
    // kept for the open project's title, which is always last.
    const labels = Array.from(scroller.querySelectorAll<HTMLElement>("[data-section]"))
      .map((band) => band.dataset.section ?? "")
      .filter(Boolean);

    stack.prepend(
      ...labels.map((label) => {
        const span = document.createElement("span");
        span.className = "rail-section";
        span.textContent = label;
        return span;
      }),
    );

    // The menu is another custom element, defined by ANOTHER script. Both are
    // bundled into the page, but nothing promises which is defined first, and
    // until <nsc-side-menu> is, it is a plain element with no setSections().
    // whenDefined waits for it — immediately, if it already is.
    customElements.whenDefined("nsc-side-menu").then(() => menu.setSections(labels));

    railButton.addEventListener("click", () => menu.open(), { signal });

    // Menu entries are section LABELS, matched back to the band that declared
    // one. scrollIntoView rather than a scrollTop sum, because which element
    // actually scrolls changes with the breakpoint — .pane-scroll from tablet
    // up, .index-pane below it — and this walks up to whichever one it is.
    this.addEventListener("menu-select", (e) => {
      menu.close();
      const label = (e as CustomEvent<string>).detail;
      const band = scroller.querySelector<HTMLElement>(`[data-section="${CSS.escape(label)}"]`);
      band?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    }, { signal });

    // Takes you to a project in the list from somewhere that has no business
    // holding a reference to one: Work history names the products it is about,
    // and they are projects further down the page. By slug, because that is
    // the only name a sentence that far from the list can be expected to know.
    //
    // Delegated: one listener on the shell catches a click on any
    // [data-scroll-to] inside it, however many there are.
    this.addEventListener("click", (e) => {
      const jump = (e.target as HTMLElement).closest<HTMLElement>("[data-scroll-to]");
      if (!jump) return;
      const entry = scroller.querySelector<HTMLElement>(`[data-slug="${CSS.escape(jump.dataset.scrollTo ?? "")}"]`);
      entry?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    }, { signal });
  }

  disconnectedCallback() {
    this.#wiring?.abort();
  }
}

customElements.define("nsc-showcase", Showcase);
