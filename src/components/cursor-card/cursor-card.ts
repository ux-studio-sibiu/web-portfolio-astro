// A panel that appears at the pointer and follows it until it leaves whatever
// opened it — the "View project" / "view details" card, and on the Tooling and
// Archive frames, the frame's title, role and summary.
//
// In Next every band held its own <CursorCard item={hovered}> in React state,
// with pointer handlers spread onto every thumbnail. Here ONE card serves the
// page, and what opens it is declared in the markup:
//
//   data-card="View project"           the card's title (required)
//   data-card-role="click to view"     a line under it
//   <template data-card-summary>…      markup for the summary, inside the
//                                      element; cloned in when the card opens
//
// The card lives at the top level (CursorCard.astro is rendered by the
// showcase, outside every band), which is what the old portal was for: the
// media columns are clipped at the divider, and a card inside one would be cut
// off on the same line.
//
// It follows by writing a transform to the node on pointermove, never by
// rebuilding it; the only DOM change is opening and closing. A new node per
// opening, so its CSS entrance animation plays each time, as it did when React
// mounted it.

// How far from the pointer the card sits, and how far it keeps off the edges of
// the screen when the pointer runs into a corner.
const OFFSET = 18;
const MARGIN = 10;

export function cursorCards(): () => void {
  let card: HTMLElement | null = null;
  let following: AbortController | null = null;

  const place = (x: number, y: number) => {
    if (!card) return;
    // Never off the bottom or the right: past those it sits back from the
    // pointer instead of in front of it.
    const left = Math.min(x + OFFSET, window.innerWidth - card.offsetWidth - MARGIN);
    const top = Math.min(y + OFFSET, window.innerHeight - card.offsetHeight - MARGIN);
    card.style.transform = `translate(${Math.round(Math.max(MARGIN, left))}px, ${Math.round(Math.max(MARGIN, top))}px)`;
  };

  const close = () => {
    following?.abort();
    following = null;
    card?.remove();
    card = null;
  };

  const open = (source: HTMLElement, x: number, y: number) => {
    close();

    // Hidden from assistive tech: it says what the element's own label and the
    // detail behind it already say, and it only exists for a pointer.
    card = document.createElement("div");
    card.className = "nsc-cursor-card";
    card.setAttribute("aria-hidden", "true");

    const title = document.createElement("p");
    title.className = "card-title";
    title.textContent = source.dataset.card ?? "";
    card.append(title);

    if (source.dataset.cardRole) {
      const role = document.createElement("p");
      role.className = "card-role";
      role.textContent = source.dataset.cardRole;
      card.append(role);
    }

    const summary = source.querySelector<HTMLTemplateElement>(":scope > template[data-card-summary]");
    if (summary) {
      const box = document.createElement("div");
      box.className = "card-summary";
      box.append(summary.content.cloneNode(true));
      card.append(box);
    }

    document.body.append(card);
    place(x, y);

    following = new AbortController();
    const { signal } = following;
    window.addEventListener("pointermove", (e) => place(e.clientX, e.clientY), { passive: true, signal });
    // Scrolling takes the thing being described out from under the pointer,
    // and whether that produces a pointerleave is up to the browser. Either way
    // the card is describing something that is no longer there, so it closes.
    // Capturing on the document: scroll does not bubble, and what scrolls here
    // is a pane inside the page.
    document.addEventListener("scroll", close, { capture: true, passive: true, signal });
  };

  const wiring = new AbortController();
  const { signal } = wiring;

  document.querySelectorAll<HTMLElement>("[data-card]").forEach((source) => {
    // Mouse only: on a touch screen the card would come up under the finger
    // that just tapped the thing open.
    source.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") open(source, e.clientX, e.clientY);
    }, { signal });
    // Brings it back after a scroll has closed it, which is otherwise
    // impossible without leaving and coming back: the pointer is already
    // inside, so there is no second enter to wait for.
    source.addEventListener("pointermove", (e) => {
      if (!card && e.pointerType === "mouse") open(source, e.clientX, e.clientY);
    }, { signal });
    source.addEventListener("pointerleave", close, { signal });
    // Opening the detail (or the scroll a jump starts) moves the page out from
    // under the pointer without it ever leaving, so there is no pointerleave
    // to take the card down.
    source.addEventListener("pointerdown", close, { signal });
  });

  return () => {
    close();
    wiring.abort();
  };
}
