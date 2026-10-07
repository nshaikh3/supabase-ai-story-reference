import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), resetPassword: vi.fn(), updateUser: vi.fn(),
  requireUser: vi.fn(), revalidatePath: vi.fn(), createClient: vi.fn(),
  config: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: mocks.config }));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
import { signIn, signUp, signOut, requestPasswordReset, updatePassword } from "@/app/auth/actions";
function form() { const f = new FormData(); f.set("email", "alice@example.test"); f.set("password", "fictional-long-password"); return f; }
beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.mockReturnValue({ appUrl: "http://127.0.0.1:3100", signupAllowed: true });
  const client = { auth: { signInWithPassword: mocks.signIn, signUp: mocks.signUp, signOut: mocks.signOut, resetPasswordForEmail: mocks.resetPassword, updateUser: mocks.updateUser } };
  mocks.createClient.mockResolvedValue(client);
  mocks.requireUser.mockResolvedValue({ supabase: client, user: { id: "alice" } });
  for (const fn of [mocks.signIn, mocks.signUp, mocks.signOut, mocks.resetPassword, mocks.updateUser]) fn.mockResolvedValue({ error: null });
});
describe("server Auth actions", () => {
  it("denies hosted signup before any Auth request", async () => {
    mocks.config.mockReturnValue({ signupAllowed: false });
    expect((await signUp({}, form())).error).toContain("invitation-only");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("rejects invalid input before calling Auth", async () => {
    expect((await signIn({}, new FormData())).error).toBeTruthy();
    expect((await signUp({}, new FormData())).error).toBeTruthy();
    expect((await requestPasswordReset({}, new FormData())).error).toBeTruthy();
    expect((await updatePassword({}, new FormData())).error).toBeTruthy();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("signs in, clears route caches and redirects", async () => {
    await expect(signIn({}, form())).rejects.toThrow("REDIRECT:/account");
    expect(mocks.signIn).toHaveBeenCalledWith({ email: "alice@example.test", password: "fictional-long-password" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
  it("does not disclose provider errors or credentials", async () => {
    mocks.signIn.mockResolvedValue({ error: { message: "secret raw token and email" } });
    const result = await signIn({}, form()); expect(result.error).toMatch("Unable to sign in"); expect(JSON.stringify(result)).not.toMatch("secret raw");
  });
  it("uses the configured confirmation origin, not submitted redirect values", async () => {
    const f = form(); f.set("next", "https://evil.test");
    expect((await signUp({}, f)).message).toMatch("Check your email");
    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: { emailRedirectTo: "http://127.0.0.1:3100/auth/callback" } }));
  });
  it("handles upstream transport failures without exposing exception text", async () => {
    mocks.createClient.mockRejectedValue(new Error("private diagnostic"));
    for (const action of [signIn, signUp, requestPasswordReset]) expect((await action({}, form())).error).toMatch("temporarily unavailable");
  });
  it("signs out only the current session", async () => {
    await expect(signOut()).rejects.toThrow("REDIRECT:/sign-in?message=signed-out");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("does not falsely report success when sign-out fails", async () => {
    mocks.signOut.mockResolvedValue({ error: { message: "offline" } });
    await expect(signOut()).rejects.toThrow("REDIRECT:/account?error=sign-out");
  });
  it("returns a generic reset confirmation for existing and missing users", async () => {
    expect((await requestPasswordReset({}, form())).message).toMatch("If an account exists");
    expect(mocks.resetPassword).toHaveBeenCalledWith("alice@example.test", { redirectTo: "http://127.0.0.1:3100/auth/callback" });
  });
  it("checks identity again before changing a password", async () => {
    mocks.requireUser.mockRejectedValue(new Error("REDIRECT:/sign-in"));
    await expect(updatePassword({}, form())).rejects.toThrow("REDIRECT:/sign-in");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("updates a password in verified user context", async () => {
    expect((await updatePassword({}, form())).message).toBe("Your password has been updated.");
    expect(mocks.requireUser).toHaveBeenCalledOnce();
  });
});
