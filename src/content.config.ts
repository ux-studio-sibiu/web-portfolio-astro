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

export const collections = { lessons };
