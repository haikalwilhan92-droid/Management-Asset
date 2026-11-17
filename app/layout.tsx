import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const metadata: Metadata = {
  title: "Investment Tracker",
  description: "Personal investment tracker",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body>
        {user && (
          <header className="border-b border-slate-200 bg-white">
            <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 text-sm">
              <span className="font-semibold">Investment Tracker</span>
              <Link href="/" className="text-slate-600 hover:text-slate-900">
                Dashboard
              </Link>
              <Link href="/transactions" className="text-slate-600 hover:text-slate-900">
                Transactions
              </Link>
              <form action={signOut} className="ml-auto">
                <button className="text-slate-500 hover:text-slate-900">Log out</button>
              </form>
            </nav>
          </header>
        )}
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
