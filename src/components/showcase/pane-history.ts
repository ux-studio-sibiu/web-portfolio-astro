// The detail pane's place in the browser's history.
//
// Opening a project pushes one history entry, so the browser's back button —
// and the swipe-back gesture on a phone — closes the pane instead of leaving
// the site. Since lesson 13 that entry has the project's own URL,
// /work/<slug>/, which is a real page: copy it, reload it, share it, and the
// project is open on arrival.
//
// Closing goes back to where the page was before the pane opened, in ONE step.
// A plain history.back() is not enough: the browser keeps ONE history for the
// page and every iframe in it (the "joint session history"), so an embed that
// navigates inside itself — the motion page swapping pieces, a map changing
// view — adds entries of its own, and back would step through those first
// while the pane stayed open.
//
// Where the Navigation API exists it jumps to the exact entry recorded on
// opening. Elsewhere it jumps by how much the history grew since then, which is
// exact unless someone had already gone back inside the iframe; plain back is
// the last resort. Either way the browser fires `popstate`, and the controller
// closes the pane on that — the pane follows the history, never the other way.

// The Navigation API, where the browser has it; TypeScript's DOM types do not
// carry it yet, so just the two members used here.
type NavigationApi = {
  currentEntry: { key: string; index: number } | null;
  entries(): { key: string }[];
  traverseTo(key: string): { finished: Promise<unknown> };
};

const navigationApi = () => (window as Window & { navigation?: NavigationApi }).navigation;

export class PaneHistory {
  // Where the page was when the pane opened: the Navigation API's key for that
  // entry, and the length history reached once the pane's own entry was pushed.
  #before: { key?: string; length: number } | null = null;

  // Call when a project is opened from the page.
  push(slug: string, url: string) {
    this.#before = { key: navigationApi()?.currentEntry?.key, length: 0 };
    history.pushState({ project: slug }, "", url);
    this.#before.length = history.length;
  }

  // Call when the page ARRIVES with a project open (a /work/<slug>/ link).
  // There is no entry before it to go back to — the visitor came from another
  // site, or from nowhere — so one is made: the current entry is rewritten to
  // the index's URL, and the project's is pushed on top of it. Back then lands
  // on the index, in this same document, instead of leaving.
  adopt(slug: string, homeUrl: string) {
    const here = location.href;
    history.replaceState({}, "", homeUrl);
    this.push(slug, here);
  }

  // Call when the history itself brought a project back — Forward onto its
  // entry. Closing should still go back exactly one step past it, so the entry
  // before it is recorded, where the Navigation API can say which that is.
  resume() {
    const nav = navigationApi();
    const index = nav?.currentEntry?.index ?? 0;
    this.#before = { key: index > 0 ? nav?.entries()[index - 1]?.key : undefined, length: 0 };
  }

  // Call to close the pane. Does not close it: it moves the history, and the
  // `popstate` that follows is what closes it.
  back() {
    const before = this.#before;
    const nav = navigationApi();

    if (before?.key && nav) {
      try {
        nav.traverseTo(before.key).finished.catch(() => history.back());
      } catch {
        // The key can be gone (the entry was pruned); fall through to back().
        history.back();
      }
      return;
    }
    if (before?.length) {
      history.go(-Math.max(1, history.length - before.length + 1));
      return;
    }
    history.back();
  }
}
