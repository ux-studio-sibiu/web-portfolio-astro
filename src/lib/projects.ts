import { getCollection, type CollectionEntry } from "astro:content";

export type Project = CollectionEntry<"projects">;

// Every project that is on the page, in page order. getCollection's order is
// not guaranteed, so the `order` field decides; drafts are left out.
export async function getProjects(): Promise<Project[]> {
  const entries = await getCollection("projects", ({ data }) => !data.draft);
  return entries.sort((a, b) => a.data.order - b.data.order);
}

// Whether the MDX body has a <Summary> / <Points> at all — checked on the raw
// source, so a caller can leave out the wrapper element instead of rendering
// an empty one. An empty <Summary></Summary> still counts: the old page did
// the same with `summary={<></>}`.
export function hasCopy(entry: Project, part: "summary" | "points"): boolean {
  const tag = part === "summary" ? "<Summary" : "<Points";
  return entry.body?.includes(tag) ?? false;
}
