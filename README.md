# web-portfolio-astro

Razvan Turcanu's portfolio, rebuilt in **Astro 7** from the Next.js version (`../web-portfolio`), in
14 lessons. The site is fully static: plain HTML and CSS, plus about 52 kB of JavaScript (gzipped)
for the behaviour, and no UI framework.

The lessons are part of the site, at **`/lessons/`**: what each step changed, why, and how it was
checked. They're `noindex` and left out of the sitemap. The plan and the decisions are in
[`ROADMAP.md`](ROADMAP.md).

## Commands

Node **22.23 or newer** (Astro 7 requires it; see `engines` in `package.json`).

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # → dist/
npm run preview    # serve dist/ locally
```

Comparing the port with the Next build:

```bash
node scripts/compare-markup.mjs   # markup of each component root vs ../web-portfolio/.next (build that first)
```

`scripts/measure-load.js` is a snippet for the DevTools console. It shows what a page loads before any
interaction, by type, gzipped; run it on both sites to compare.

## Where things are

```
src/
  pages/
    index.astro            the portfolio
    work/[slug].astro      the same, with one project open (one page per project)
    lessons/               the lessons index and pages
    404.astro, robots.txt.ts
  components/
    home/Home.astro        the page: every band, in order
    showcase/              the shell + its controller (<nsc-showcase>): panes, history, scroll sequence
    band-*/                one folder per band
    details/, embed/       what a project shows when opened
    *-thumb/               the built thumbnails
  content/
    projects/*.mdx         one file per project: frontmatter = data, body = <Summary> / <Points>
    lessons/*.mdx          the lessons
    lessons-plan.yaml      the full lesson list, for /lessons
  content.config.ts        the collections' schemas
  lib/                     helpers (projects, paths, blur placeholders)
  scripts/                 shared browser code (GSAP, motion preference, lazy start, preloading)
  styles/                  globals and SCSS partials
```

Adding a project means adding one `.mdx` file in `src/content/projects/`. A project whose detail is its
live site needs only that file. One with a body of its own also needs a component in `details/` and a
line in `detail-pane/DetailBody.astro`.

## Deploying (Vercel)

It's a static build, so there's no adapter and no `vercel.json`:

1. Import the GitHub repo in Vercel. The **Astro** framework preset is detected (build `npm run build`,
   output `dist`).
2. In Project Settings → General, set the **Node.js version to 22.x**.
3. Optional, once there's a custom domain: add an environment variable `SITE_URL=https://your-domain`.
   Without it, the build uses Vercel's own `VERCEL_PROJECT_PRODUCTION_URL`, so canonical URLs, link
   previews and the sitemap point at the production `*.vercel.app` domain.

After the first deploy, check:

- a link preview: paste a `/work/<slug>/` URL into a chat, or a share-preview debugger;
- `/robots.txt` and `/sitemap-index.xml` name the real domain;
- an unknown URL shows the 404 page;
- PageSpeed Insights on `/`, for the field and lab numbers lesson 12 couldn't measure locally.
