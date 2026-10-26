// @ts-check
import { fileURLToPath } from "node:url";
import { defineConfig, fontProviders } from "astro/config";
import mdx from "@astrojs/mdx";

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // Static HTML in dist/, no server and no adapter. This is the default; it is
  // written out because the whole port leans on it (see lesson 01).
  output: "static",

  // Lessons and, from lesson 04, projects are written in MDX.
  integrations: [mdx()],

  // Markdown "smartypants" rewrites ' and " into curly quotes and -- into a
  // dash. The project copy came out of JSX, which printed them as typed, so a
  // 1:1 port has to leave them alone (lesson 04).
  markdown: { smartypants: false },

  // The dev toolbar sits at the bottom of the screen, which is where the
  // section rail puts its menu button from lesson 06 on. Same trap as Next's
  // dev indicator in the old next.config.ts, so it stays off.
  devToolbar: { enabled: false },

  vite: {
    resolve: {
      // The `@/` alias again, this time for Vite. Astro reads the `paths` in
      // tsconfig.json for TS/JS imports, but Sass resolves `@use` through Vite
      // and never sees tsconfig. A string key matches "@" followed by "/", so
      // scoped packages like "@astrojs/mdx" are untouched.
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
  },

  // Self-hosted at build time, the job next/font did in layout.tsx. Both are
  // variable fonts, so one weight RANGE each rather than a list of weights.
  // The variable names are the ones globals.scss already reads.
  fonts: [
    {
      name: "Archivo",
      cssVariable: "--font-archivo",
      provider: fontProviders.google(),
      weights: ["100 900"],
      styles: ["normal"],
      // latin-ext as well as latin: the name in Contact is set with Romanian
      // diacritics, and T-comma and a-breve are both outside the latin subset.
      // Without it those two letters alone drop to a fallback face, which at
      // display size is impossible to miss.
      subsets: ["latin", "latin-ext"],
      fallbacks: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
    },
    {
      name: "JetBrains Mono",
      cssVariable: "--font-jetbrains-mono",
      provider: fontProviders.google(),
      weights: ["100 800"],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["ui-monospace", "Menlo", "monospace"],
    },
  ],
});
