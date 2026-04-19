import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ThemeToggle } from "./theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HR Pain Solutions",
  description: "AI-powered candidate screening and ranking for modern hiring teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-950 text-zinc-50">
        <Providers>
          <div className="min-h-screen flex flex-col">
            <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
              <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
                <Link href="/" className="flex items-center gap-3 text-sm font-semibold tracking-tight text-slate-900">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-xs font-bold text-white">
                    HPS
                  </span>
                  <span className="hidden sm:inline">HR Pain Solutions</span>
                </Link>
                <nav className="flex items-center gap-5 text-sm text-slate-700">
                  <Link href="/" className="hover:text-slate-950">
                    Home
                  </Link>
                  <div className="relative group hidden md:block">
                    <button type="button" className="hover:text-slate-950">Solutions</button>
                    <div className="pointer-events-none absolute right-0 top-8 z-30 w-[44rem] rounded-2xl border border-slate-200 bg-white p-5 opacity-0 shadow-2xl transition group-hover:pointer-events-auto group-hover:opacity-100">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Screening intelligence</p>
                          <h3 className="mt-2 text-base font-semibold text-slate-900">Screen millions of applicants in two hours</h3>
                          <p className="mt-2 text-sm text-slate-600">Multi-agent resume parsing, scoring, and ranking with transparent fit explanations.</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Interview automation</p>
                          <h3 className="mt-2 text-base font-semibold text-slate-900">AI pre-screen interview</h3>
                          <p className="mt-2 text-sm text-slate-600">Voice-first question flow, transcript capture, and scorecards for recruiter-ready decisions.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Link href="/candidate" className="hover:text-slate-950">
                    Candidate
                  </Link>
                  <Link href="/recruiter" className="hover:text-slate-950">
                    Recruiter
                  </Link>
                  <Link href="/profile" className="hover:text-slate-950">
                    Profile
                  </Link>
                  <Link href="/?mode=login#auth" className="hover:text-slate-950">
                    Login
                  </Link>
                  <Link href="/?mode=register#auth" className="hover:text-slate-950">
                    Register
                  </Link>
                  <ThemeToggle />
                </nav>
              </div>
            </header>

            <main className="flex-1 bg-slate-50">
              {children}
            </main>

            <footer className="border-t border-slate-200 bg-white">
              <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">HR Pain Solutions</p>
                  <p className="mt-2 text-sm text-slate-600">AI screening and interview automation for high-volume and quality-first hiring teams.</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Platform</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    <li>Resume Screening</li>
                    <li>AI Interview</li>
                    <li>Candidate Ranking</li>
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Use Cases</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    <li>Startup Hiring</li>
                    <li>Recruitment Teams</li>
                    <li>Enterprise Intake</li>
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Contact</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    <li>Product Demo</li>
                    <li>Implementation Support</li>
                    <li>Security and Compliance</li>
                  </ul>
                </div>
              </div>
              <div className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
                © {new Date().getFullYear()} HR Pain Solutions. All rights reserved.
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
