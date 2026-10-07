import "server-only";
import sharp from "sharp";
import { MAX_IMAGE_BYTES } from "./validation";

// This app accepts raster images only. Block the SVG loader before metadata
// inspection: a spoofed MIME type must never reach the librsvg decoder.
sharp.block({ operation: ["VipsForeignLoadSvg"] });

// Decode the pixels, reject MIME spoofing and animations, bound decompression,
// orient/resize, and re-encode without EXIF, GPS, ICC or other source metadata.
export async function normalizeImage(bytes: Buffer, mimeType: string): Promise<Buffer> {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("Invalid image size");
  const pipeline = sharp(bytes, { failOn: "warning", limitInputPixels: 16_000_000 }).timeout({ seconds: 10 });
  const metadata = await pipeline.metadata();
  const formats: Record<string, string> = { "image/png": "png", "image/jpeg": "jpeg", "image/webp": "webp" };
  if (!formats[mimeType] || metadata.format !== formats[mimeType] || (metadata.pages ?? 1) !== 1) throw new Error("Invalid image format");
  if (metadata.format === "png") {
    // libvips may decode only the first APNG frame; detect its animation chunk.
    for (let offset = 8; offset + 12 <= bytes.length;) {
      if (bytes.toString("ascii", offset + 4, offset + 8) === "acTL") throw new Error("Animated PNG is unsupported");
      offset += 12 + bytes.readUInt32BE(offset);
    }
  }
  const result = await pipeline.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).timeout({ seconds: 10 }).toBuffer();
  if (result.length > MAX_IMAGE_BYTES) throw new Error("Image output too large");
  return result;
}
