import { describe, expect, it } from "vitest";
import { imageInputError, MAX_IMAGE_BYTES, readStory, validId } from "@/lib/stories/validation";

describe("story input boundaries", () => {
  it("accepts only details, trimming text and ignoring forged server fields", () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ title: "  Moon map  ", child_name: " Nova ", prompt: " Map adventure ", owner_id: "other", status: "complete" })) form.set(key, value);
    expect(readStory(form)).toEqual({ values: { title: "Moon map", child_name: "Nova", prompt: "Map adventure" } });
  });
  it.each(["title", "child_name", "prompt"])("requires bounded nonblank %s", key => {
    const form = new FormData(); form.set("title", "Map"); form.set("child_name", "Nova"); form.set("prompt", "Adventure");
    form.set(key, " "); expect(readStory(form).error).toBeTruthy();
    form.set(key, "a".repeat(2001)); expect(readStory(form).error).toBeTruthy();
  });
  it("rejects malformed IDs and path injection", () => {
    expect(validId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1")).toBe(true);
    for (const id of [null, "not-an-id", "../image", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/extra"]) expect(validId(id)).toBe(false);
  });
  it("rejects missing, empty, oversize and unsupported files", () => {
    for (const file of [null, "path.png", new File([], "empty.png", { type: "image/png" }), new File([Buffer.alloc(MAX_IMAGE_BYTES + 1)], "big.png", { type: "image/png" }), new File(["<svg/>"], "active.svg", { type: "image/svg+xml" })]) expect(imageInputError(file)).toBeTruthy();
    expect(imageInputError(new File(["bytes"], "hero.png", { type: "image/png" }))).toBeNull();
  });
});
