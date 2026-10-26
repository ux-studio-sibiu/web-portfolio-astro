# web-portfolio-astro — porting the portfolio to Astro

The Next.js portfolio (`../web-portfolio`) rebuilt in **Astro**, one lesson at a time. Same idea as
`learn-angular` and `data-viz`: each lesson is one small, reviewable change and one commit (you
commit, Claude never does).

Like `data-viz`, the lessons don't build separate demos: they all grow **one product, the portfolio**.
Each lesson also adds its own lesson page (`/lessons/NN-...`) that explains the concepts, compares them
with what the Next.js version did, and ends with "Files in this lesson" and a "Review checklist".

> Status: lessons 01–10 done. Decisions are settled in section 6.

---

## 1. What the Next.js app actually is

Read before planning, because it decides the whole port:

- **One page.** `app/page.tsx` declares ~16 `<LinearProject>` entries. Their props are read by
  `ShowcaseLinear` with `Children.toArray()`. That data feeds the projects band, the experiments band,
  the rail title and the detail pane.
- **Everything is a client component.** `ShowcaseLinear` is `"use client"`, so the whole page tree
  under it hydrates. The server render is static HTML, but React, ReactDOM and every band's code ship
  and run anyway.
- **The shell is a state machine in React state:** open project, active section, menu open, rail lit.
  It also handles history/Navigation-API back handling (iframes add their own history entries),
  forwarded wheel events, a measured scroll sequence (identity fade → section ownership → outro), and
  a `ResizeObserver` that refreshes ScrollTrigger.
- **Detail pane:** `registry.ts` maps slug → `next/dynamic` component. Most are a single full-bleed
  `<iframe>`. `advisor` and `four-in-one` have real content (carousel, images, video).
- **Hand-built thumbs:** canvas noise (`static-thumb`), WebGL fluid (`fluid-thumb`), a canvas data-viz,
  GSAP motion and composite images (radio TV, randomize).
- **Motion:** GSAP + ScrollTrigger on a custom scroller (`.pane-scroll`, not the document), CSS
  `animation-timeline: view()` with a JS fallback for the highlight sweep, the elastic divider line
  (GSAP ticker) and the tile reveal.
- **Assets:** 16 referenced thumbs in `app/assets/projects` (3.7 MB, a few unused: `data-viz-thumb.jpg`,
  `randomize-studio.jpg`, `zoom.jpg`), `public/advisor` 2.3 MB (~50 JPGs, **not optimized** since they
  sit in `public/`), `public/video/fnt.mp4` 2.0 MB, 2 CV PDFs, a GIF and an SVG pattern.

About 9,200 lines of TSX + SCSS. The SCSS ports almost unchanged. The TSX is where the work is.

---

## 2. Technical decisions (proposed)

| Topic | Proposal | Why |
|---|---|---|
| Astro version | **Astro 7** (latest, 7.4.x) on **Node 22 LTS or 24**. This machine has Node 20.20, and Node 20 reached end of life in April 2026. | Astro 6+ needs Node ≥ 22.12, and Astro 7 needs ≥ 22.23. Astro 5.18 still runs on Node 20, but it's the old line, so you'd be learning it just as it gets replaced. **Astro 7 shipped in June 2026, after my training data.** Like the Next 16 `AGENTS.md` warning, lesson 01 starts by reading the Astro 7 docs and upgrade notes, not by trusting memory. |
| Output | `output: "static"`, no adapter | Nothing needs a server. It deploys to Vercel as plain files. |
| Interactivity | **No UI framework in the product.** `.astro` components for markup, plus small TS behaviour modules in `<script>` tags, mostly as **custom elements** (`<nsc-showcase>`, `<nsc-side-menu>`, …) | This is the main thing Astro teaches, and the biggest performance win (section 4). The shell's React state becomes DOM state (`data-*`, `is-*` classes, `inert`) plus custom events. |
| React | Not installed in the product. Lesson 11 may add `@astrojs/react` for **one lesson-page demo** of `client:visible`, so you see islands and hydration directives side by side with the vanilla version. | You learn islands without making the product pay for them. |
| Project data | A **content collection** `src/content/projects/*.mdx`: frontmatter holds the props (title, year, stack, group, thumb, href, order…), the MDX body holds the `points` with `<Highlight>` | See gotcha G1: Astro can't read props off children, so the `Children.toArray` pattern can't move over. The body stays markup, which keeps the spirit of `COMPONENT_PATTERNS.md`: content written as markup, not strings in an array. |
| Detail bodies | Each project's detail is rendered at build time into a **`<template data-detail="slug">`** and cloned into the pane on open | Template content is inert: its iframes don't load and its images don't fetch until cloned. You get the `next/dynamic` laziness with zero JS chunks. |
| Styles | Keep the per-component `.scss` files, **imported** by their `.astro` component (global, `nsc-` namespaced). Each file `@use`s the partials it needs (`@use "@/styles/breakpoints" as *`), as in the Next app. The `@` alias is set in both `tsconfig.json` and `vite.resolve.alias`, because Sass resolves through Vite. | `nsc-` already scopes, and the files port 1:1. Astro's scoped `<style>` is taught in lesson 02 and used on the lesson pages, but it isn't forced on the product (gotcha G5). |
| Images | `astro:assets` `<Image>`/`<Picture>` (AVIF + WebP, `sizes` as today). Advisor screenshots move from `public/` into `src/assets/` so they get optimized too. | Same features as `next/image`, minus the blur placeholder (G4). |
| Fonts | Astro's **Fonts API** (Archivo with `latin` + `latin-ext`, JetBrains Mono), with CSS variables `--font-archivo` / `--font-jetbrains-mono` kept | Self-hosted fonts with a metric-matched fallback, like `next/font`. Fontsource is the fallback option if the API doesn't fit. |
| GSAP | Copied usage, plain `gsap` + `ScrollTrigger` npm packages (no `@gsap/react`), and `gsap.matchMedia()` for breakpoint and reduced-motion gating | Same behaviour. `useGSAP`'s cleanup becomes `mm.revert()` / `disconnectedCallback`. |
| Lessons | A content collection `src/content/lessons/*.mdx` + a `LessonPage` layout at `/lessons/[id]` (`getStaticPaths`). They're `noindex` and left out of the sitemap. | The lesson layer teaches collections and dynamic routes itself. MDX lets a lesson import and run a live product component ("show me"). |
| Shared tools | Anything reused from another repo is **copied in**, never linked (workspace rule) | |
| Assets | **Copied** from `../web-portfolio`, only what's referenced, in the lesson that first needs it. Nothing in the Next repo is moved or deleted. | Workspace rule on files you didn't create. |

---

## 3. Target structure

```
web-portfolio-astro/
  astro.config.mjs          static output, mdx, fonts, `@` alias for Vite, devToolbar off
  src/
    content.config.ts       projects + lessons collections (Zod schemas)
    content/
      projects/advisor.mdx  frontmatter = props, body = points
      lessons/01-setup.mdx
    assets/projects/        thumbs (optimized)
    assets/advisor/         carousel screens (moved from public/, optimized)
    layouts/
      Base.astro            <html>, fonts, meta, globals
      LessonPage.astro      eyebrow, title, body, files, checklist
    components/
      showcase/             Showcase.astro + showcase.scss + showcase.ts (custom element)
      fixed-column/  section-rail/  side-menu/  detail-pane/
      band-*/               one folder per band
      thumbs/               static-thumb, fluid-thumb, radio-thumb, …
      details/              Advisor.astro, FourInOne.astro, Embed.astro (generic iframe)
      highlight/
    scripts/                motion-preference.ts, embed-preload.ts, scroller.ts
    styles/                 globals.scss, _breakpoints, _devices, _modern-normalize
    pages/
      index.astro           the portfolio
      work/[slug].astro     shareable per-project page (lesson 13)
      lessons/[id].astro
      lessons/index.astro
  public/                   cv/*.pdf, video/fnt.mp4, radio/static.gif, patterns/*.svg
```

Structure changes compared with the Next app:

1. **`page.tsx` + `registry.ts` + `project.tsx` collapse into one collection.** Adding a project means
   adding one `.mdx` file (plus a detail component only when it isn't a plain embed). Today it takes 3
   edits in 3 places.
2. **12 one-line iframe detail components → one `Embed.astro`** fed by `href` and `allow` from
   frontmatter. Only `advisor` and `four-in-one` keep a component of their own.
3. **Shell logic is split by concern** into small modules (history, scroll sequence, wheel
   forwarding, menu) instead of one 490-line component.
4. **Deep links (lesson 13):** `?project=slug` opens a project on load, and `/work/slug/` exists as a
   real page. Today there's no way to link to one project.

---

## 4. Performance: what changes

| Area | Next.js today | Astro target |
|---|---|---|
| Framework JS | React 19 + ReactDOM + Next runtime, and the whole page hydrates | None. Only the behaviour scripts + GSAP ship. Expect a large drop in JS and main-thread work. Lesson 12 measures it. |
| Detail chunks | `next/dynamic` chunk per project | `<template>` clone, no request until opened |
| Live iframes in the index | Entries with no thumb (e.g. Paint) render a **live iframe as their thumbnail** | Replace with a captured still or `loading="lazy"` + IO mount. Every live iframe is a whole page booting. |
| Canvas / WebGL thumbs | Run from mount | Load the module with dynamic `import()` when visible, and pause off-screen |
| Advisor screenshots | `public/`, unoptimized (~2.3 MB) | `src/assets`, AVIF/WebP, sized |
| Video | `preload="metadata"` | Add a `poster`, and check whether 2 MB can be re-encoded smaller |
| Unused assets | 3–4 unreferenced images in the repo | Not copied |

---

## 5. Gotchas and sensitive spots

- **G1 — Slots are opaque.** An Astro component gets its children as rendered HTML
  (`Astro.slots.render()` returns a string). There's no `Children.toArray(children).map(c => c.props)`.
  This is the single biggest reason the data becomes a collection.
- **G2 — `<script>` runs once per page, not once per component.** Astro bundles and dedupes component
  scripts. Ten `<StaticThumb>`s mean one script, which has to find all ten (custom elements make this
  natural). Processed scripts are `type="module"`, so they're deferred and run after parse.
  `is:inline` skips processing; use it only for something that has to run before paint.
- **G3 — Server/client boundary is different.** Frontmatter (`---`) runs at **build time** only. Passing
  data to a script goes through `data-*` attributes or `define:vars`. `define:vars` makes the script
  inline and un-bundled, so prefer `data-*`.
- **G4 — No `placeholder="blur"`.** `astro:assets` has no built-in blur-up. Options: a tiny `getImage()`
  (16px, inlined as a background) per thumb, or a dominant colour. Decided in lesson 05.
- **G5 — Scoped styles and cloned/injected DOM.** Scoped `<style>` adds `data-astro-cid-*` to the
  elements of *that* component. Content from another component's slot, or DOM created by a script, won't
  match. The imported `nsc-` SCSS avoids this entirely. That's the reason for the styles decision.
- **G6 — The scroller isn't the document.** ScrollTrigger needs `scroller: ".pane-scroll"` everywhere,
  the breakpoint swap (`.index-pane` scrolls below tablet) still applies, and the browser's scroll
  restoration doesn't cover an inner scroller. All the measured-offset logic (identity fade, section
  ownership, ResizeObserver → `ScrollTrigger.refresh()`) ports as-is, and it's the most fragile code.
  It gets a lesson of its own (09).
- **G7 — History with iframes.** The Navigation API / `history.go(-n)` logic exists because iframes push
  joint history entries. It ports unchanged. Adding `?project=` deep links has to keep that "close in
  one step" behaviour, and that's the part to review most carefully in lesson 08.
- **G8 — Initial state before JS.** No hydration means the HTML has to look right before scripts run:
  `--identity-fade: 1`, the rail unlit, the pane closed, the highlight finished under reduced motion.
  Anything that's set only from JS today is checked in lesson 06.
- **G9 — Fonts and diacritics.** Keep `latin-ext` (Ț and ă in the contact name). Check that the Fonts API
  generates a fallback with adjusted metrics, or the name will shift on swap.
- **G10 — Viewport.** Today's `maximum-scale=1, user-scalable=no` blocks pinch-zoom (WCAG 1.4.4).
  Proposal: drop it. If it was there to stop iOS zooming into inputs, a 16px input font fixes that.
- **G11 — Dev toolbar position.** Astro's dev toolbar sits bottom-centre/left, the same trap as Next's
  dev indicator over the rail menu button. Disable it or move it in the config.
- **G12 — Sass deprecations.** Recent `sass` warns on `@import` and global built-ins. Partials are
  `@use`d explicitly in each file. `additionalData` was rejected in lesson 02: it hides the dependency and
  duplicates any CSS a partial *emits* into every stylesheet.
- **G13 — Iframe permissions.** Keep `allow="camera"` (light-study) and `allow="clipboard-write"` (the
  tools) per project in frontmatter, plus `referrerPolicy`.
- **G14 — Not a git repo yet.** This folder needs `git init` before lesson 01 can be committed. You do
  that, or ask for it explicitly.

---

## 6. Decisions (settled 2026-10-26)

1. **Node / Astro:** Node 22/24 + **Astro 7**. You upgrade Node before lesson 01.
2. **Interactivity:** **vanilla custom elements**, no UI framework in the product.
3. **Lesson UI:** plain **`/lessons/*` pages**.
4. **Parity:** **1:1 port first.** Through lesson 11 the site looks and behaves exactly like the Next.js
   version, including the things the plan would change: the viewport setting (G10), live-iframe
   thumbnails, and no links to a single project. Visible or behavioural improvements wait for lessons
   12–14. Internal restructuring that the visitor can't see is still allowed where Astro needs it or it
   costs nothing: the content collection (G1), `<template>` details, one `Embed.astro`, and optimizing
   the Advisor screenshots.

---

## 7. Lessons

Each lesson = one commit + one lesson page. "Product change" is what the portfolio gains, "Concepts" is
what the lesson page explains (always with a **Next.js → Astro** comparison table).

| # | Lesson | Product change | Concepts |
|---|---|---|---|
| 01 | Setup + the lesson layer ✓ | `npm create astro`, TS strict, `astro.config`, `Base` layout, lessons collection, `LessonPage`, `/lessons` index, placeholder home | Anatomy of a `.astro` file (frontmatter = build time, template = HTML), file-based routing, static output, `getStaticPaths` for the lesson pages, why Astro ships zero JS by default |
| 02 | Styles, tokens, fonts ✓ | `globals.scss` + partials copied, explicit `@use` with the `@` alias, `Portfolio` layout (globals stay off the lesson pages), Fonts API (Archivo + latin-ext, JetBrains Mono), meta + viewport copied as-is | Scoped vs imported vs `is:global` styles, `class:list`, `define:vars` in `<style>`, font fallback metrics (G9, G12) |
| 03 | The shell + text-only bands ✓ | Two-pane track, fixed column (identity + blurb), `.pane-scroll` with columns 2–3, detail-pane frame (closed), plus Core technologies, Work history, Skills and Contact as plain `.astro` (CV links to `public/cv`), all with no JS. `scripts/compare-markup.mjs` checks each component root against the Next build | Components, `Astro.props` with a typed `Props` interface, default and **named slots**, slot fallbacks, `Astro.slots.has`, `.map()` and conditionals in templates, fragments, `set:html` (and when not to) |
| 04 | Projects as a content collection ✓ | `projects` collection + Zod schema, one `.mdx` per entry (`<Summary>` / `<Points>` in the body, rendered one at a time by `ProjectCopy`), `getProjects()`, drafts, thumbs copied into `src/assets`, smartypants off | Content layer, `glob()` loader, `image()` in schemas, `getCollection` + sorting, `render()` → `<Content />`, MDX components mapping. **G1: why not children props.** |
| 05 | Projects & experiments bands (markup + images) ✓ | Both bands rendered from the collection: sizes, groups (tools / various), `className` variants, all seven thumb components (canvas ones blank until 11), `Thumb.astro` (WebP + Next's blur placeholder rebuilt with sharp), compare script extended to images | `astro:assets` `<Image>` / `<Picture>`, `sizes` / `widths`, AVIF, CLS, the LQIP decision (G4), `public/` vs `src/assets` |
| 06 | First scripts: menu, rail, highlights ✓ | `<nsc-side-menu>` (no portal needed; kept as a div, popover noted as a later option), `<nsc-showcase>` controller (rail titles, menu → section scroll, `data-scroll-to` jumps), section rail + rail button markup, highlight fallback script, `motion.ts` helper | Processed `<script>` vs `is:inline`, bundling and dedupe (G2), **custom elements** as the Astro-native component behaviour, `data-*` handoff (G3), state before JS (G8) |
| 07 | Detail pane ✓ | `<nsc-showcase>` controller (state + one `render()`): open/close, `<template>` details, `Embed.astro` (+ `embedTitle`/`embedAllow`), `DetailBody` replaces the registry, Advisor (`<nsc-screen-carousel>`, shots via `import.meta.glob` + `getImage`) and FourInOne, Escape, `inert` | React state → DOM state + custom events, template laziness (nothing loads until cloned) |
| 08 | History ✓ | `pane-history.ts`: opening pushes a history entry, back closes the pane (`popstate` is the only thing that closes it), close returns in one step via the Navigation API with a `history.go(-n)` fallback; both paths tested with a same-origin iframe | `pushState` / `popstate`, the Navigation API, why iframes share the page's history (G7), URL as state |
| 09 | Scroll sequence ✓ | `scroll-sequence.ts` (identity fade, section ownership, outro, pinned highlight sweep, `ResizeObserver` re-measuring) and `forward-wheel.ts`. Plain DOM measurement, no GSAP. Sampled at 50 scroll positions against the Next build: identical | Custom scroller (G6), measure-then-write, passive listeners, `ResizeObserver`, why fractions of the pane beat fixed pixels |
| 10 | GSAP ✓ | Band thumb slides (GSAP bodies extracted verbatim from the Next components), elastic line, tile reveal, run line, `ResizeObserver` → coalesced `ScrollTrigger.refresh()`, `src/scripts/gsap.ts` shared chunk. 29 scroll positions × 19 values identical to the Next build | npm libs in client scripts, `ScrollTrigger` with a custom `scroller`, `gsap.matchMedia` for breakpoints and reduced motion, cleanup without `useGSAP` |
| 11 | Live thumbs + cursor card | Static noise, fluid WebGL, data-viz canvas, motion thumb, screen carousel, cursor card. Each loads its module only when visible and pauses off-screen | Dynamic `import()` on visibility as a hand-made `client:visible`. Optional lesson-page section: the same thumb as a **React island** with `client:load` / `client:visible` / `client:idle`, compared on bytes and timing (not part of the product) |
| 12 | Performance + first improvements | Embed preloading ported, live-iframe thumbs → stills, video poster/re-encode, `fetchpriority` on the first thumb, asset audit, viewport fix (G10) | `astro build` + `preview`, reading `dist/`, bundle visualizer, Lighthouse/WebPageTest, before/after against the Next build |
| 13 | Deep links | `?project=slug` opens a project on load (still closing in one step, G7), `/work/[slug]/` pages | `getStaticPaths` with props, reading the URL on load, keeping history consistent when the page starts with a project open |
| 14 | Ship it | OG/meta per page, sitemap (lessons excluded), robots, 404, Vercel deploy, README | Integrations, `Astro.site` / canonical URLs, deploying static output |

Possible extras after 14: View Transitions (`<ClientRouter />`) between `/` and `/work/slug`, the
floating lesson window from `data-viz`, moving project content to Sanity with a custom content loader.

---

## 8. Lesson workflow

1. You ask for lesson N.
2. Claude implements only that lesson: the product change + its lesson page + a tick in this roadmap.
   If the lesson table changes, `src/content/lessons-plan.yaml` (the "coming up" list on `/lessons`)
   changes with it.
   Routine edits follow the workspace `fast-iteration` rule. Lessons 01, 02, 04, 10, 11 (only if the
   React demo is added) and 14 add dependencies or config, so those get a build check.
3. The lesson page ends with **"Files in this lesson"** and a **"Review checklist"**.
4. You review, ask questions or request changes, then commit it as `lesson N`.
