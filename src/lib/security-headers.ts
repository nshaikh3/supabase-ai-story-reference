export function contentSecurityPolicy(nonce: string, supabaseUrl: string, development: boolean, hosted: boolean) {
  const websocket = supabaseUrl.replace(/^http/, "ws");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    `connect-src 'self' ${supabaseUrl} ${websocket}`,
    "img-src 'self' blob: data:", "font-src 'self'", "object-src 'none'",
    "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    ...(hosted ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};
