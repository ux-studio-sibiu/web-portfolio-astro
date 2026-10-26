// <nsc-screen-carousel>: steps through the shots ScreenCarousel.astro rendered
// the first of. In React this was one `useState(index)`; here the index lives
// on the element (`data-index`) and step() rewrites the few nodes it touches.
type Shot = { src: string; srcset: string };

class ScreenCarousel extends HTMLElement {
  #wiring?: AbortController;

  connectedCallback() {
    const shots: Shot[] = JSON.parse(this.dataset.shots ?? "[]");
    const label = this.dataset.label ?? "";
    const count = shots.length;
    if (!count) return;

    const frame = this.querySelector<HTMLButtonElement>(".screen-frame")!;
    const [shot, next] = Array.from(this.querySelectorAll<HTMLImageElement>(".shot-box img"));
    const bullets = Array.from(this.querySelectorAll<HTMLButtonElement>(".bullet"));

    this.#wiring = new AbortController();
    const { signal } = this.#wiring;

    const show = (index: number) => {
      this.dataset.index = String(index);
      const now = shots[index];
      const after = shots[(index + 1) % count];

      shot.srcset = now.srcset;
      shot.src = now.src;
      shot.alt = `${label}, screen ${index + 1} of ${count}`;
      next.srcset = after.srcset;
      next.src = after.src;

      frame.setAttribute("aria-label", `${label}. Screen ${index + 1} of ${count}. Click for the next one.`);
      bullets.forEach((bullet, i) => {
        bullet.classList.toggle("is-active", i === index);
        bullet.setAttribute("aria-current", String(i === index));
      });
    };

    const step = (by: number) => show((Number(this.dataset.index ?? 0) + by + count) % count);

    frame.addEventListener("click", () => step(1), { signal });
    frame.addEventListener("contextmenu", (e) => { e.preventDefault(); step(-1); }, { signal });
    frame.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    }, { signal });

    this.querySelector(".screen-nav.prev")!.addEventListener("click", () => step(-1), { signal });
    this.querySelector(".screen-nav.next")!.addEventListener("click", () => step(1), { signal });
    bullets.forEach((bullet, i) => bullet.addEventListener("click", () => show(i), { signal }));
  }

  disconnectedCallback() {
    this.#wiring?.abort();
  }
}

customElements.define("nsc-screen-carousel", ScreenCarousel);
