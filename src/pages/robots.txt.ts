import type { APIRoute } from "astro";

// robots.txt as an ENDPOINT rather than a file in public/: a .ts file in
// src/pages that exports GET is built into whatever it returns — here a plain
// text file at /robots.txt. That lets it name the sitemap by its absolute URL,
// which robots.txt requires, from `site` in astro.config.mjs instead of a
// domain typed in by hand (lesson 14).
//
// The lesson pages are NOT disallowed here, on purpose: they carry
// <meta name="robots" content="noindex">, and a crawler that is forbidden to
// fetch a page never gets to read that it should not index it.
export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL("sitemap-index.xml", site)}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
