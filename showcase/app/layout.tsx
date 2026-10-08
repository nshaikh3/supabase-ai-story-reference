import type { Metadata } from "next";
import "../../src/app/globals.css";

export const metadata: Metadata = {
  title: "Supabase AI Story Reference",
  description: "An account-free fictional story demo and a technical tour of a locally runnable Supabase reference application.",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
