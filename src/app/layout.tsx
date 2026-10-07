import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Supabase AI Story Reference",
  description: "A small reference application exploring secure story workflows with Supabase.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection(); // Each rendered document receives a fresh CSP nonce.
  return <html lang="en"><body>{children}</body></html>;
}
