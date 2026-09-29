export type AuthState = { error?: string; message?: string };

export function readEmail(form: FormData) {
  const email = form.get("email");
  if (typeof email !== "string") return null;
  const normalized = email.trim();
  return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

export function readPassword(form: FormData, minimum = 10) {
  const password = form.get("password");
  return typeof password === "string" && password.length >= minimum && password.length <= 128 ? password : null;
}

export function validAuthCode(code: string | null): code is string {
  return code !== null && /^[a-zA-Z0-9_-]{16,2048}$/.test(code);
}
