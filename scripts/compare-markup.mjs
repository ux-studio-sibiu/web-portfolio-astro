// Compares the Astro build with the Next build, one component root at a time,
// so a 1:1 port can be checked instead of eyeballed.
//
//   node scripts/compare-markup.mjs [next.html] [astro.html]
//
// Defaults: ../web-portfolio/.next/server/app/index.html (run `npm run build`
// in the Next repo first) and dist/index.html (run `npm run build` here).
//
// Both files are normalised before comparing: comments, scripts and Astro's
// data-astro-cid-* attributes are dropped, runs of whitespace become one space,
// and the data-* hooks this port adds for its scripts are ignored. Whitespace
// itself is NOT dropped, so a missing {" "} still shows up as a difference.
import { readFileSync } from "node:fs";

const [nextFile = "../web-portfolio/.next/server/app/index.html", astroFile = "dist/index.html"] = process.argv.slice(2);

// Each component root to compare: [tag, a class on it].
const ROOTS = [
  ["aside", "nsc-fixed-column"],
  ["section", "nsc-band-core-technologies"],
  ["section", "nsc-band-work-history"],
  ["section", "nsc-band-skills"],
  ["section", "nsc-band-contact"],
  ["section", "nsc-detail-pane"],
  ["svg", "nsc-elastic-line"],
];

// data-* attributes the port adds as hooks for its own scripts.
const PORT_HOOKS = ["words", "scroll-to"];

const normalise = (html) =>
  html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/\sdata-astro-cid-[a-z0-9]+(="")?/g, "")
    .replace(new RegExp(String.raw`\sdata-(${PORT_HOOKS.join("|")})="[^"]*"`, "g"), "")
    // Same markup, spelt differently: React writes boolean attributes as
    // open="" and entities as the character; Astro keeps them as written.
    .replace(/(\s[a-z-]+)=""/g, "$1")
    .replace(/&larr;/g, "←")
    .replace(/&rarr;/g, "→")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

// The outer HTML of the first <tag> whose class list contains `cls`, found by
// counting opening and closing tags of the same name.
const outerHtml = (html, tag, cls) => {
  const start = html.search(new RegExp(String.raw`<${tag}\b[^>]*class="[^"]*\b${cls}\b`));
  if (start < 0) return null;
  const tags = new RegExp(String.raw`<(/?)${tag}\b`, "g");
  tags.lastIndex = start;
  let depth = 0;
  for (let m; (m = tags.exec(html)); ) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, html.indexOf(">", m.index) + 1);
  }
  return null;
};

const next = normalise(readFileSync(nextFile, "utf8"));
const astro = normalise(readFileSync(astroFile, "utf8"));
let failures = 0;

for (const [tag, cls] of ROOTS) {
  const a = outerHtml(next, tag, cls);
  const b = outerHtml(astro, tag, cls);

  if (!a || !b) {
    failures++;
    console.log(`MISSING  ${cls}  (next: ${a ? "found" : "not found"}, astro: ${b ? "found" : "not found"})`);
    continue;
  }
  if (a === b) {
    console.log(`SAME     ${cls}  (${a.length} chars)`);
    continue;
  }

  failures++;
  let i = 0;
  while (a[i] === b[i]) i++;
  console.log(`DIFF     ${cls}  at char ${i}`);
  console.log(`  next : …${a.slice(Math.max(0, i - 80), i + 120)}`);
  console.log(`  astro: …${b.slice(Math.max(0, i - 80), i + 120)}`);
}

process.exitCode = failures ? 1 : 0;
