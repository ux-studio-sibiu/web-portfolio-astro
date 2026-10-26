// The fixed column is laid OVER the scroller, not inside it. Most of it is
// click-through (`pointer-events: none`), so the wheel falls straight to the
// pane and scrolls it natively. But the things that have to take pointer
// events — the mail link in the column and the rail's button beside it — have
// no scrollable ancestor for a wheel to reach: .pane-scroll is their SIBLING.
// Over those, and only those, the wheel is handed to the pane by hand.
//
// Forwarded scrolling does not feel like the real thing — no inertia, no
// smoothing — which is exactly why the name is no longer a button. Keep what
// takes pointer events small, or this becomes noticeable again.
//
// Returns a cleanup function.
export function forwardWheel(scroller: HTMLElement, targets: HTMLElement[]) {
  const wiring = new AbortController();

  const onWheel = (e: WheelEvent) => {
    // Below tablet this element does not scroll — the pane around it does,
    // and the column is in its flow, so there is nothing to forward.
    if (scroller.scrollHeight <= scroller.clientHeight) return;
    e.preventDefault();
    // deltaMode is lines or pages on some mice, pixels everywhere else.
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? scroller.clientHeight : 1;
    scroller.scrollTop += e.deltaY * unit;
  };

  // `passive: false`, or preventDefault() is ignored and the page would try
  // to scroll the box under the pointer as well.
  targets.forEach((node) => node.addEventListener("wheel", onWheel, { passive: false, signal: wiring.signal }));
  return () => wiring.abort();
}
