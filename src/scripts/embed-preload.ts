// Ported from embed-preload.ts in the Next app (useEmbedPreload), where it ran
// from the showcase. Same logic; the hook became a function that takes the
// container and returns its cleanup.

// Every URL and origin already warmed this page load, so an entry that leaves
// and re-enters the screen costs nothing the second time.
const warmed = new Set<string>();

// Warms a cross-origin embed: the connection first — DNS + TCP + TLS, which is
// the part that always pays off and is most of the delay on a cold origin —
// then the document itself at idle priority.
export function preloadEmbed(href: string) {
  if (warmed.has(href)) return;
  warmed.add(href);

  const origin = new URL(href, location.href).origin;
  if (!warmed.has(origin)) {
    warmed.add(origin);
    // dns-prefetch is the fallback for anything that ignores preconnect.
    addLink("dns-prefetch", origin);
    addLink("preconnect", origin);
  }

  // An experiment that still runs its URL in a live frame in the index has
  // its document on the way regardless — prefetching it as well would just
  // fetch it twice. The preconnect above is what that case takes from this.
  const live = Array.from(document.querySelectorAll("iframe")).some((frame) => frame.src === href);
  // Safari ignores prefetch entirely; there too the preconnect carries it.
  if (!live) addLink("prefetch", href, "document");
}

function addLink(rel: string, href: string, as?: string) {
  const el = document.createElement("link");
  el.rel = rel;
  el.href = href;
  if (as) el.as = as;
  document.head.appendChild(el);
}

// Warms each [data-preload] element's URL the first time that element comes
// into view, and stops watching it once it has. The viewport is the root rather
// than the scrolling pane: below tablet .pane-scroll does not scroll, so every
// entry would sit inside it at once and the whole list would warm on load.
export function preloadEmbedsIn(container: HTMLElement): () => void {
  // Nothing speculative on a metered connection.
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return () => {};

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const href = (entry.target as HTMLElement).dataset.preload;
        if (href) preloadEmbed(href);
        io.unobserve(entry.target);
      }
    },
    // A little ahead of the entry, so scrolling straight past one still warms it.
    { rootMargin: "300px 0px" },
  );

  container.querySelectorAll<HTMLElement>("[data-preload]").forEach((el) => io.observe(el));
  return () => io.disconnect();
}
