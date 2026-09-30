import { describe, expect, it, vi } from "vitest";
import { GeminiStoryGenerator, MockStoryGenerator, boundedJson, generatorFor, validateOutput } from "../supabase/functions/_shared/generator";
const input = { title: "The moon map", child_name: "Nova", prompt: "A friendly garden adventure" };
const output = { title: input.title, pages: Array.from({ length: 5 }, (_, i) => ({ page: i + 1, text: `Page ${i + 1}` })) };
const response = (value: unknown) => Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(value) }] } }] });
describe("story providers", () => {
  it("defaults to a free deterministic five-page mock without network calls", async () => {
    const request = vi.spyOn(globalThis, "fetch");
    const { generator, name } = generatorFor(() => undefined);
    expect(name).toBe("mock");
    const first = await generator.generate(input);
    expect(first).toEqual(await new MockStoryGenerator().generate(input));
    expect(first.pages).toHaveLength(5);
    expect(first.pages.every(page => page.text.split(/\s+/).length >= 40 && page.text.split(/\s+/).length <= 80)).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ...output, pages: [] }, { ...output, title: " " }, { ...output, title: "x".repeat(121) }, { ...output, pages: output.pages.map(page => ({ ...page, page: 1 })) }, { ...output, pages: output.pages.map(page => ({ ...page, text: " " })) }, { ...output, pages: output.pages.map(page => ({ ...page, text: "x".repeat(4001) })) }])("rejects malformed output %#", value => {
    expect(() => validateOutput(value)).toThrow("invalid_output");
  });
  it("drops extra fields and returns text as data", () => {
    expect(validateOutput({ ...output, secret: "not persisted", pages: output.pages.map(page => ({ ...page, text: " <script>data</script> ", secret: "extra" })) })).toEqual({ title: output.title, pages: output.pages.map(page => ({ ...page, text: "<script>data</script>" })) });
  });
  it("rejects unknown providers without silently enabling a paid service", () => expect(() => generatorFor(() => "unknown")).toThrow("configuration_error"));
  it("requires explicit Gemini key and model", async () => {
    await expect(new GeminiStoryGenerator("", "gemini-example").generate(input)).rejects.toThrow("configuration_error");
    await expect(new GeminiStoryGenerator("test-only", "../../elsewhere").generate(input)).rejects.toThrow("configuration_error");
  });
  it("uses a fixed HTTPS endpoint, header key, bounded structured output and no tools/images", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response(output));
    expect(await new GeminiStoryGenerator("test-only-key", "gemini-example", request).generate(input)).toEqual(output);
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-example:generateContent");
    expect(options?.redirect).toBe("error");
    expect(options?.headers).toEqual({ "Content-Type": "application/json", "x-goog-api-key": "test-only-key" });
    const body = JSON.parse(options?.body as string);
    expect(body.tools).toBeUndefined();
    expect(body.contents[0].parts).toEqual([{ text: JSON.stringify(input) }]);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });
  it("redacts HTTP provider errors", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("secret provider details", { status: 429 }));
    await expect(new GeminiStoryGenerator("test-only", "gemini-example", request).generate(input)).rejects.toThrow(/^provider_unavailable$/);
  });
  it("classifies provider timeouts", async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new DOMException("private", "TimeoutError"));
    await expect(new GeminiStoryGenerator("test-only", "gemini-example", request).generate(input)).rejects.toThrow(/^provider_timeout$/);
  });
  it.each([
    { candidates: [] },
    { candidates: [{ finishReason: "SAFETY", content: { parts: [] } }] },
    { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: JSON.stringify(output) }] } }] },
    { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "not json" }] } }] },
  ])("rejects blocked, truncated or malformed Gemini responses %#", async value => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(value));
    await expect(new GeminiStoryGenerator("test-only", "gemini-example", request).generate(input)).rejects.toThrow("invalid_output");
  });
  it("limits actual streamed response bytes even without Content-Length", async () => {
    await expect(boundedJson(new Response('"' + "x".repeat(100) + '"'), 32)).rejects.toThrow("invalid_output");
  });
});
