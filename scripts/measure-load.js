// What a page loads before the visitor does anything — paste into the DevTools
// console on a freshly loaded page (no scrolling first), at the viewport you
// want to measure. Used in lesson 12 to compare the Next build with this one.
//
// Sizes are GZIPPED for text (HTML, JS, CSS), worked out here with the
// browser's own CompressionStream so the comparison does not depend on whether
// the local server compresses. Images, fonts and video are already compressed
// formats, so their bytes are taken as they are.
//
// Live iframes are listed separately: whatever they load is a whole other page
// and does not show up in this page's resource list at all.
(async () => {
  const gzipSize = async (url) => {
    const res = await fetch(url, { cache: "force-cache" });
    const stream = res.body.pipeThrough(new CompressionStream("gzip"));
    return (await new Response(stream).arrayBuffer()).byteLength;
  };

  const kindOf = (entry) => {
    const url = entry.name.split("?")[0];
    if (/\.(js|mjs)$/.test(url) || entry.initiatorType === "script") return "js";
    if (/\.css$/.test(url) || entry.initiatorType === "css" && /\.css/.test(url)) return "css";
    if (/\.(woff2?|ttf|otf)$/.test(url)) return "font";
    if (/\.(avif|webp|jpe?g|png|gif|svg)$/.test(url) || url.includes("/_next/image") || url.includes("/_image")) return "image";
    if (/\.(mp4|webm)$/.test(url)) return "video";
    return "other";
  };

  const entries = performance.getEntriesByType("resource").filter((e) => !e.name.startsWith("data:"));
  const rows = [{ kind: "html", url: location.href, bytes: await gzipSize(location.href) }];
  for (const entry of entries) {
    const kind = kindOf(entry);
    const text = kind === "js" || kind === "css";
    rows.push({ kind, url: entry.name, bytes: text ? await gzipSize(entry.name) : entry.decodedBodySize || entry.encodedBodySize });
  }

  const totals = {};
  for (const row of rows) {
    totals[row.kind] ??= { requests: 0, kB: 0 };
    totals[row.kind].requests++;
    totals[row.kind].kB += row.bytes / 1024;
  }
  for (const t of Object.values(totals)) t.kB = Math.round(t.kB * 10) / 10;

  const lcp = await new Promise((resolve) => {
    new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1);
      resolve(last ? { ms: Math.round(last.startTime), element: last.element?.className || last.element?.tagName } : null);
    }).observe({ type: "largest-contentful-paint", buffered: true });
    setTimeout(() => resolve(null), 1000);
  });

  const result = {
    totals,
    totalKB: Math.round(rows.reduce((sum, r) => sum + r.bytes, 0) / 102.4) / 10,
    liveIframes: [...document.querySelectorAll("iframe")].filter((f) => f.src).map((f) => f.title || f.src),
    lcp,
    domNodes: document.getElementsByTagName("*").length,
  };
  console.table(totals);
  console.log(result);
  return result;
})();
