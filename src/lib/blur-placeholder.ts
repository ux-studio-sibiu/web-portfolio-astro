import sharp from "sharp";
import type { ImageMetadata } from "astro";

// What next/image's `placeholder="blur"` put on every thumbnail, rebuilt at
// build time: an inline style whose background is a blurred, 8px-wide copy of
// the image, so the frame shows the picture's colours before the real file
// arrives. astro:assets has no blur placeholder of its own (gotcha G4).
//
// The SVG wrapper is the one Next writes (next/dist/shared/lib/image-blur-svg):
// blurring a tiny bitmap inside an SVG filter, rather than with CSS `filter`,
// keeps the edges of the frame sharp.
//
// It needs the image's file on disk, which Astro keeps on imported image
// metadata as `fsPath` — present, but not part of the public type, hence the
// cast. Without it the image simply gets no placeholder.

const cache = new Map<string, string>();

export async function blurStyle(image: ImageMetadata): Promise<string | undefined> {
  const fsPath = (image as ImageMetadata & { fsPath?: string }).fsPath;
  if (!fsPath) return undefined;

  const cached = cache.get(fsPath);
  if (cached) return cached;

  // 8px wide, like the blurDataURL Next generates for a static import.
  const height = Math.max(1, Math.round((8 * image.height) / image.width));
  const tiny = await sharp(fsPath).resize(8, height).toFormat(image.format === "png" ? "png" : "jpeg").toBuffer();
  const dataUrl = `data:image/${image.format === "png" ? "png" : "jpeg"};base64,${tiny.toString("base64")}`;

  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${8} ${height}'>` +
    `<filter id='b' color-interpolation-filters='sRGB'><feGaussianBlur stdDeviation='20'/>` +
    `<feColorMatrix values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 100 -1' result='s'/>` +
    `<feFlood x='0' y='0' width='100%' height='100%'/><feComposite operator='out' in='s'/>` +
    `<feComposite in2='SourceGraphic'/><feGaussianBlur stdDeviation='20'/></filter>` +
    `<image width='100%' height='100%' x='0' y='0' preserveAspectRatio='none' style='filter: url(#b);' href='${dataUrl}'/></svg>`;

  const style =
    "color:transparent;background-size:cover;background-position:50% 50%;background-repeat:no-repeat;" +
    `background-image:url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;

  cache.set(fsPath, style);
  return style;
}
