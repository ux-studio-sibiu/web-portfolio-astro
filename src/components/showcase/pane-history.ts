// The detail pane's place in the browser's history.
//
// Opening a project pushes one history entry, so the browser's back button —
// and the swipe-back gesture on a phone — closes the pane instead of leaving
// the site. The URL does not change (lesson 13 is where it starts to).
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
  currentEntry: { key: string } | null;
  traverseTo(key: string): { finished: Promise<unknown> };
};

const navigationApi = () => (window as Window & { navigation?: NavigationApi }).navigation;

export class PaneHistory {
  // Where the page was when the pane opened: the Navigation API's key for that
  // entry, and the length history reached once the pane's own entry was pushed.
  #before: { key?: string; length: number } | null = null;

  // Call when the pane opens.
  push(slug: string) {
    this.#before = { key: navigationApi()?.currentEntry?.key, length: 0 };
    // The state object is only a marker; nothing reads the slug back yet.
    history.pushState({ project: slug }, "");
    this.#before.length = history.length;
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
