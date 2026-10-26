import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// One .mdx file per lesson in src/content/lessons. The file name is the entry
// id and the URL: 01-setup.mdx → /lessons/01-setup/.
const lessons = defineCollection({
  loader: glob({ base: "./src/content/lessons", pattern: "*.mdx" }),
  schema: z.object({
    number: z.number().int().positive(),
    title: z.string(),
    // One line for the lessons index.
    summary: z.string(),
  }),
});

// One .mdx file per entry in the projects and experiments bands, replacing the
// <LinearProject> declarations in the old page.tsx. The file name is the slug:
// advisor.mdx → id "advisor", which is what `data-scroll-to="advisor"` and the
// detail pane (lesson 07) look it up by.
//
// Frontmatter holds the props that are plain values. The two props that were
// JSX — `summary` and `points` — are the MDX body, inside <Summary> and
// <Points> (see src/components/project-copy/), so they stay markup.
const projects = defineCollection({
  loader: glob({ base: "./src/content/projects", pattern: "*.mdx" }),
  // `image` is a helper Astro passes in: a path relative to the .mdx file is
  // checked at build time and becomes an optimisable image (lesson 05).
  schema: ({ image }) =>
    z.object({
      // Position on the page. page.tsx used the order the entries were written
      // in; files have no order of their own, so it is a number here. Steps of
      // 10 leave room to slot one in without renumbering.
      order: z.number(),
      // Hidden from the page. For an entry that is written but not shown —
      // the old page.tsx did this by commenting the whole <LinearProject> out.
      draft: z.boolean().default(false),

      title: z.string(),
      // A shorter title for the vertical sidebar in the detail pane, for a
      // title too long to stand there whole. The card keeps `title`.
      railTitle: z.string().optional(),
      // A box in the embed (px from the top, and height) to centre that
      // sidebar title on, instead of its usual place under the button.
      railTitleBox: z.object({ top: z.number(), height: z.number() }).optional(),
      // Experiments carry no date, so this is optional — everything reads it
      // as "print it if it is there".
      year: z.string().optional(),
      role: z.string(),
      // Comma-separated, split into pills by the band.
      stack: z.string().optional(),

      // Which band this belongs to. No group means the projects band.
      group: z.enum(["experiments", "tools", "various"]).optional(),
      // Put on the entry's root: "xxl", "large", "wide", "tv"… are size and
      // layout variants defined in the band stylesheets.
      className: z.string().optional(),

      // Thumbnail for the index. Without one the block stays a flat placeholder.
      thumb: image().optional(),
      // A second thumbnail, shown beside the first.
      thumbAlt: image().optional(),
      // Prints the title over the thumbnail, for frames that are a texture or
      // noise rather than a picture of a screen.
      thumbLabel: z.boolean().default(false),
      // A thumbnail that is built rather than photographed. Wins over `thumb`.
      // A NAME here, not a component: frontmatter is data, so the band maps
      // the name to the component (lesson 05).
      thumbNode: z.enum(["radio", "randomize", "static", "fluid", "light-study", "motion", "data-viz"]).optional(),

      // Embeds fill the detail pane edge to edge; everything else gets padding.
      // An embed's detail is its `href` in an iframe (Embed.astro).
      embed: z.boolean().default(false),
      href: z.string().url().optional(),
      // The iframe's accessible title. Defaults to "<title>, live".
      embedTitle: z.string().optional(),
      // The iframe's `allow` (Permissions Policy), e.g. "camera".
      embedAllow: z.string().optional(),
      // Replaces the wording on the entry's button.
      viewLabel: z.string().optional(),
    }),
});

export const collections = { lessons, projects };
