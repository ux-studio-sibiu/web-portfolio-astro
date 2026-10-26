// The address of a project opened in the detail pane (lesson 13). One place,
// because the page that builds these URLs, the controller that pushes them and
// the one that reads them back must agree.
//
// A module of its own, with no imports, because the BROWSER needs it too:
// showcase-controller.ts imports it. lib/projects.ts imports astro:content,
// which exists only at build time, and must never end up in a client script.
export const projectPath = (slug: string) => `/work/${slug}/`;

// The slug in a /work/<slug>/ path, or null for any other path.
export const slugFromPath = (path: string) => path.match(/^\/work\/([^/]+)\/?$/)?.[1] ?? null;
