"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppDispatch, useAppSelector } from "../store";
import type { RootState } from "../store";
import { login, register, logout } from "../store/slices/authSlice";

type Mode = "login" | "register";
type RegisterRole = "recruiter" | "candidate";

function HomeContent() {
  const dispatch = useAppDispatch();
  const { user, status, error } = useAppSelector((s: RootState) => s.auth);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<RegisterRole>("candidate");
  const [hasHydrated, setHasHydrated] = useState(false);
  const loginRequired = searchParams.get("loginRequired") === "1";

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    const qMode = searchParams.get("mode");
    if (qMode === "login" || qMode === "register") {
      setMode(qMode);
    }
  }, [searchParams]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "login") {
      dispatch(login({ email, password }));
    } else {
      dispatch(register({ email, password, name, role }));
    }
  };

  useEffect(() => {
    if (!user) return;
    if (user.role === "candidate") {
      router.push("/candidate");
    } else if (user.role === "owner") {
      router.push("/admin");
    } else {
      router.push("/recruiter");
    }
  }, [user, router]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
      {loginRequired && (
        <div role="status" className="mb-5 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Please first login to access this page.
        </div>
      )}

      <section className="grid overflow-hidden border border-slate-200 bg-white shadow-sm lg:min-h-[620px] lg:grid-cols-[1.08fr_0.92fr]">
        <div className="relative flex min-h-[420px] flex-col justify-between overflow-hidden bg-slate-950 p-7 sm:p-10 lg:min-h-0 lg:p-14">
          <Image
            src="/images/hire-faster.jpg"
            alt="Recruiter reviewing a candidate shortlist"
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover opacity-65"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-slate-950/10" />
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase text-white/75">HR Pain Solutions</p>
            <h1 className="mt-16 max-w-xl text-4xl font-semibold leading-tight text-white sm:mt-24 sm:text-5xl">
              Better hiring starts with better evidence.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/85">
              Bring candidate screening, structured interviews, and recruiter decisions into one considered workflow.
            </p>
          </div>
          <div className="relative z-10 mt-12 grid gap-5 border-t border-white/30 pt-5 sm:grid-cols-3">
            <div>
              <p className="text-sm font-semibold text-white">Evidence-led</p>
              <p className="mt-1 text-xs leading-5 text-white/75">See the experience behind every match.</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Consistent</p>
              <p className="mt-1 text-xs leading-5 text-white/75">Compare applicants against the same criteria.</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Human-owned</p>
              <p className="mt-1 text-xs leading-5 text-white/75">Keep hiring decisions with your team.</p>
            </div>
          </div>
        </div>

        <section id="auth" className="flex items-center px-6 py-10 sm:px-12 lg:px-14">
          <div className="mx-auto w-full max-w-md">
            <p className="text-xs font-semibold uppercase text-sky-800">Your hiring workspace</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {mode === "login" ? "Sign in to continue to your workspace." : "Choose how you will use the platform to get started."}
            </p>

            <div className="mt-7 grid grid-cols-2 border-b border-slate-200 text-sm font-semibold">
            <button
              type="button"
              aria-pressed={mode === "login"}
              onClick={() => setMode("login")}
              className={`border-b-2 px-3 py-3 ${mode === "login" ? "border-sky-700 text-sky-800" : "border-transparent text-slate-500 hover:text-slate-900"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              aria-pressed={mode === "register"}
              onClick={() => setMode("register")}
              className={`border-b-2 px-3 py-3 ${mode === "register" ? "border-sky-700 text-sky-800" : "border-transparent text-slate-500 hover:text-slate-900"}`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-5 text-sm">
            {mode === "register" && (
              <>
                <div className="space-y-1">
                  <label htmlFor="full-name" className="block text-xs font-semibold text-slate-700">Full name</label>
                  <input
                    id="full-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    className="w-full border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-sky-700 focus:ring-2 focus:ring-sky-100"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <span className="block text-xs font-semibold text-slate-700">I am joining as a</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {([
                      { id: "recruiter", label: "Recruiter" },
                      { id: "candidate", label: "Candidate" },
                    ] as { id: RegisterRole; label: string }[]).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={role === option.id}
                        onClick={() => setRole(option.id)}
                        className={`border px-3 py-3 text-sm font-semibold ${
                          role === option.id
                            ? "border-sky-700 bg-sky-50 text-sky-900"
                            : "border-slate-300 bg-white text-slate-600 hover:border-slate-500"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-sky-700 focus:ring-2 focus:ring-sky-100"
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-sky-700 focus:ring-2 focus:ring-sky-100"
                required
              />
            </div>

            {error && <p role="alert" className="border-l-4 border-red-600 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}

            <button
              type="submit"
              disabled={status === "loading"}
              className="mt-1 inline-flex min-h-12 w-full items-center justify-center bg-sky-800 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-800 disabled:cursor-wait disabled:opacity-60"
            >
              {hasHydrated && status === "loading"
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in securely"
                  : "Create account"}
            </button>
          </form>

          {user && (
            <button
              type="button"
              onClick={() => dispatch(logout())}
              className="mt-4 inline-flex w-full items-center justify-center border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              Logout
            </button>
          )}
          </div>
        </section>
      </section>

    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-8 text-sm text-slate-600">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
