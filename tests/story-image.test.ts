import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
import { normalizeImage } from "@/lib/stories/image";

describe("image bytes and metadata", () => {
  it.each(["png", "jpeg", "webp"] as const)("decodes %s, normalizes orientation/size and strips metadata", async format => {
    const input = await sharp({ create: { width: 1700, height: 20, channels: 3, background: "#328568" } }).withExif({ IFD0: { Artist: "Synthetic fixture", Copyright: "Private metadata" } }).toFormat(format).toBuffer();
    const output = await normalizeImage(input, `image/${format}`);
    const metadata = await sharp(output).metadata();
    expect(metadata.format).toBe("webp"); expect(metadata.width).toBe(1600); expect(metadata.exif).toBeUndefined(); expect(metadata.icc).toBeUndefined();
  });
  it("rejects MIME spoofing, SVG, random and truncated bytes", async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } }).png().toBuffer();
    for (const [bytes, type] of [[png, "image/jpeg"], [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'), "image/png"], [Buffer.from("not an image"), "image/png"], [png.subarray(0, 40), "image/png"]] as const) await expect(normalizeImage(bytes, type)).rejects.toThrow();
  });
  it("blocks the SVG decoder before metadata inspection", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
    await expect(sharp(svg).metadata()).rejects.toThrow();
    await expect(normalizeImage(svg, "image/png")).rejects.toThrow();
  });
  it("bounds decompression dimensions", async () => {
    const huge = await sharp({ create: { width: 4001, height: 4001, channels: 3, background: "white" } }).png().toBuffer();
    await expect(normalizeImage(huge, "image/png")).rejects.toThrow();
  });
  it("rejects animated images", async () => {
    const frame = await sharp({ create: { width: 10, height: 10, channels: 3, background: "blue" } }).png().toBuffer();
    const second = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } }).png().toBuffer();
    const animated = await sharp([frame, second], { join: { animated: true } }).webp().toBuffer();
    await expect(normalizeImage(animated, "image/webp")).rejects.toThrow();
  });
});
