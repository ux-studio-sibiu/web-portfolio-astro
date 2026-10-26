import { getCollection, type CollectionEntry } from "astro:content";

export type Project = CollectionEntry<"projects">;

// Every project that is on the page, in page order. getCollection's order is
// not guaranteed, so the `order` field decides; drafts are left out.
export async function getProjects(): Promise<Project[]> {
  const entries = await getCollection("projects", ({ data }) => !data.draft);
  return entries.sort((a, b) => a.data.order - b.data.order);
}

// The page title with nothing open (the layout's default), and while a
// project is open. The controller switches document.title between the two.
export const HOME_TITLE = "Razvan Turcanu — Frontend Developer";
export const projectTitle = (entry: Project) => `${entry.data.title} — Razvan Turcanu`;

// The summary as plain text, for a <meta name="description">: the raw MDX of
// <Summary>, tags taken out. Some entries have an empty summary (Advisor) or
// none, so it falls back to the points that are not group headings, joined
// and cut at a word to the ~160 characters a search result shows; then to the
// role, then to nothing (and the layout's default).
export function summaryText(entry: Project): string | undefined {
  const body = entry.body?.replace(/\{\/\*[\s\S]*?\*\/\}/g, "") ?? "";
  const plain = (raw?: string) => raw?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const summary = plain(body.match(/<Summary>([\s\S]*?)<\/Summary>/)?.[1]);
  if (summary) return summary;

  const points = [...body.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => plain(m[1])).filter(Boolean).join(" ");
  if (points) return points.length <= 160 ? points : `${points.slice(0, 157).replace(/\s+\S*$/, "")}…`;

  return entry.data.role || undefined;
}

// Whether the MDX body has a <Summary> / <Points> at all — checked on the raw
// source, so a caller can leave out the wrapper element instead of rendering
// an empty one. An empty <Summary></Summary> still counts: the old page did
// the same with `summary={<></>}`.
export function hasCopy(entry: Project, part: "summary" | "points"): boolean {
  const tag = part === "summary" ? "<Summary" : "<Points";
  return entry.body?.includes(tag) ?? false;
}
