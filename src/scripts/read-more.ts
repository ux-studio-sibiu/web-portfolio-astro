// On phones, every entry's bullet list (projects, experiments, the Tooling and
// Archive rows) starts hidden behind a "read more" link under it. A page read
// on a small screen is a long scroll of points otherwise; this way each entry
// is its title, role and stack until someone asks for more.
//
// The buttons are made HERE, not written in the bands' markup, for two
// reasons: the desktop page stays exactly as it was (and the markup check
// against the Next build with it), and without JavaScript nothing is hidden at
// all — the points are simply there, which is the safe way round.
//
// It follows the breakpoint live: widen the window past tablet and every list
// is shown and every button goes; narrow it again and they collapse.
//
// Returns a cleanup function.

const PHONE = "(max-width: 767.98px)";

export function readMore(container: HTMLElement): () => void {
  const lists = Array.from(container.querySelectorAll<HTMLElement>(".nsc-band-projects .entry-points, .nsc-band-experiments .entry-points"));
  if (!lists.length) return () => {};

  const phone = window.matchMedia(PHONE);
  const wiring = new AbortController();

  const items = lists.map((list, i) => {
    list.id ||= `entry-points-${i + 1}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "inline-link read-more";
    button.setAttribute("aria-controls", list.id);
    list.after(button);
    const item = { list, button, expanded: false };
    button.addEventListener("click", () => {
      item.expanded = !item.expanded;
      apply(item);
    }, { signal: wiring.signal });
    return item;
  });

  const apply = (item: (typeof items)[number]) => {
    const collapsible = phone.matches;
    item.list.hidden = collapsible && !item.expanded;
    item.button.hidden = !collapsible;
    item.button.setAttribute("aria-expanded", String(item.expanded));
    item.button.textContent = item.expanded ? "read less" : "read more";
  };

  items.forEach(apply);
  phone.addEventListener("change", () => items.forEach(apply), { signal: wiring.signal });

  return () => {
    wiring.abort();
    items.forEach(({ list, button }) => {
      list.hidden = false;
      button.remove();
    });
  };
}
