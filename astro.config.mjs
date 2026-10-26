// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // Static HTML in dist/, no server and no adapter. This is the default; it is
  // written out because the whole port leans on it (see lesson 01).
  output: "static",

  // Lessons and, from lesson 04, projects are written in MDX.
  integrations: [mdx()],

  // The dev toolbar sits at the bottom of the screen, which is where the
  // section rail puts its menu button from lesson 06 on. Same trap as Next's
  // dev indicator in the old next.config.ts, so it stays off.
  devToolbar: { enabled: false },
});
