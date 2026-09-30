// The small Deno surface used here is also checked by the application TypeScript
// gate. Runtime imports are pinned in deno.json and exercised in local Edge E2E.
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};
