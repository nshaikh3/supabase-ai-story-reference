import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Supabase AI Story Reference",
  description: "A small reference application exploring secure story workflows with Supabase.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
