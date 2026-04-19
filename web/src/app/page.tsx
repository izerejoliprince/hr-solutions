"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppDispatch, useAppSelector } from "../store";
import type { RootState } from "../store";
import { login, register, logout } from "../store/slices/authSlice";

type Mode = "login" | "register";
type RegisterRole = "recruiter" | "candidate";

const heroSlides = [
  {
    image: "/images/hire-faster.jpg",
    word: "speed",
    title: "Screen millions of applicants in just two hours",
    caption: "Move from resume overload to ranked shortlists with transparent AI scoring.",
  },
  {
    image: "/images/one-place-job.jpg",
    word: "focus",
    title: "One hiring workspace from sourcing to shortlist",
    caption: "Keep screening insights, interview scores, and final decisions in one place.",
  },
  {
    image: "/images/looking-for-job.jpeg",
    word: "clarity",
    title: "Understand every recommendation with clear reasons",
    caption: "See strengths, risks, and fit explanations for each candidate profile.",
  },
  {
    image: "/images/no-more-millions.webp",
    word: "quality",
    title: "No more manual triage of endless applications",
    caption: "Recruiters can prioritize top talent instantly and spend time where it matters.",
  },
  {
    image: "/images/focus-important.jpg",
    word: "confidence",
    title: "Interview smarter with AI pre-screen conversations",
    caption: "Evaluate communication, relevance, motivation, and practical knowledge consistently.",
  },
  {
    image: "/images/few-docs-scan.jpg",
    word: "fairness",
    title: "Standardized evaluation for scalable hiring",
    caption: "Use structured scoring to reduce noise and improve decision quality across teams.",
  },
];

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
  const [activeSlide, setActiveSlide] = useState(0);
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

  useEffect(() => {
    const slideTimer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6500);

    return () => {
      window.clearInterval(slideTimer);
    };
  }, []);

  const activeHero = heroSlides[activeSlide];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      {loginRequired && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Please first login to access this page.
        </div>
      )}

      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
          HR Pain Solutions
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
          Hire with <span className="text-sky-700">{activeHero.word}</span>. Hire faster.
        </h1>
        <p className="mt-1 text-sm text-slate-600 sm:text-base">
          AI resume screening and pre-screen interviews for faster, clearer hiring decisions.
        </p>
      </section>

      <section className="relative min-h-[19rem] overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-xl sm:min-h-[23rem]">
        {heroSlides.map((slide, idx) => (
          <img
            key={slide.image}
            src={slide.image}
            alt="Hiring workflow"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${idx === activeSlide ? "opacity-100" : "opacity-0"}`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/20 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
          <div className="max-w-2xl rounded-2xl border border-white/30 bg-white/15 p-3 backdrop-blur-sm sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
              Save millions of money and time in your HR activities
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">
              {activeHero.title}
            </h2>
            <p className="mt-1 text-xs text-slate-100 sm:text-sm">
              {activeHero.caption}
            </p>
            <div className="mt-3 flex gap-1.5">
              {heroSlides.map((slide, idx) => (
                <span
                  key={slide.image}
                  className={`h-1.5 rounded-full transition-all ${idx === activeSlide ? "w-7 bg-cyan-300" : "w-3 bg-white/60"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm lg:grid-cols-[1.2fr_0.9fr] lg:p-12">
          <div className="space-y-6">
            <p className="inline-flex items-center rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-xs font-semibold text-sky-900">
              AI multi-agent screening · Gemini · LangGraph
            </p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              Hire with
              <span className="ml-2 inline-block min-w-28 text-sky-700 transition-all duration-300">
                {activeHero.word}
              </span>
            </h1>
            <p className="max-w-2xl text-base text-slate-700">
              {activeHero.title}. {activeHero.caption}
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Screening speed</p>
                <p className="mt-2 text-sm text-slate-700">Screen millions of applicants in as little as two hours.</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Interview AI</p>
                <p className="mt-2 text-sm text-slate-700">Automated pre-screen interview scoring for quality shortlists.</p>
              </div>
              <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Ranking insight</p>
                <p className="mt-2 text-sm text-slate-700">Transparent match explanations recruiters and managers trust.</p>
              </div>
            </div>

            {user && (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-700">
                <span>
                  Signed in as <span className="font-semibold text-slate-900">{user.name}</span> ({user.role})
                </span>
                {user.role === "candidate" && (
                  <Link
                    href="/candidate"
                    className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                  >
                    Go to candidate dashboard
                  </Link>
                )}
                {(user.role === "owner" || user.role === "recruiter") && (
                  <Link
                    href={user.role === "owner" ? "/admin" : "/recruiter"}
                    className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                  >
                    {user.role === "owner" ? "Go to admin dashboard" : "Go to recruiter dashboard"}
                  </Link>
                )}
              </div>
            )}
          </div>

          <section id="auth" className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-7">
            <p className="mb-3 text-sm font-semibold text-slate-900">Access your workspace</p>
            <div className="mb-4 flex gap-2 rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-500">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-full px-3 py-1.5 ${
                mode === "login" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-700"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 rounded-full px-3 py-1.5 ${
                mode === "register" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-700"
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4 text-sm">
            {mode === "register" && (
              <>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Full name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Role</label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {([
                      { id: "recruiter", label: "Recruiter" },
                      { id: "candidate", label: "Candidate" },
                    ] as { id: RegisterRole; label: string }[]).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setRole(option.id)}
                        className={`rounded-md border px-2 py-1.5 ${
                          role === option.id
                            ? "border-sky-300 bg-sky-50 text-sky-800"
                            : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Choose <span className="font-semibold text-slate-700">Recruiter</span> for hiring roles,
                    or <span className="font-semibold text-slate-700">Candidate</span> if you are applying.
                  </p>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                required
              />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={status === "loading"}
              className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
            >
              {hasHydrated && status === "loading"
                ? "Please wait..."
                : mode === "login"
                  ? "Login"
                  : "Create account"}
            </button>

            <p className="pt-1 text-[11px] text-slate-500">
              By continuing you agree to use this demo responsibly. In production you would add SSO
              (Google, Microsoft) and stronger security policies.
            </p>
          </form>

          {user && (
            <button
              type="button"
              onClick={() => dispatch(logout())}
              className="btn-danger mt-4 inline-flex w-full items-center justify-center px-4 py-2 text-xs"
            >
              Logout
            </button>
          )}
          </section>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <img src="/images/few-docs-scan.jpg" alt="Resume screening" className="h-40 w-full object-cover" />
          <div className="p-6">
          <h2 className="text-base font-semibold text-slate-900">Intelligent Resume Screening</h2>
          <p className="mt-2 text-sm text-slate-600">Match candidates against role requirements using transparent scoring across skills, projects, education, and experience.</p>
          </div>
        </article>
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <img src="/images/focus-important.jpg" alt="AI interview" className="h-40 w-full object-cover" />
          <div className="p-6">
          <h2 className="text-base font-semibold text-slate-900">AI Pre-Screen Interviews</h2>
          <p className="mt-2 text-sm text-slate-600">Configure job-level interview logic and generate standardized candidate scorecards in minutes.</p>
          </div>
        </article>
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <img src="/images/one-place-job.jpg" alt="Recruiter dashboard" className="h-40 w-full object-cover" />
          <div className="p-6">
          <h2 className="text-base font-semibold text-slate-900">Recruiter Decision Cockpit</h2>
          <p className="mt-2 text-sm text-slate-600">Navigate top candidates, open detailed fit reports, and move from intake to shortlist faster.</p>
          </div>
        </article>
      </section>

      <section className="mt-10 rounded-3xl border border-slate-200 bg-gradient-to-r from-sky-50 to-emerald-50 p-8">
        <h2 className="text-2xl font-semibold text-slate-900">Built for teams that hire at high velocity</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-700">
          HR Pain Solutions brings together resume intelligence, AI interview scoring, and recruiter workflow orchestration.
          Founders, recruiters, and hiring managers get one consistent decision system that scales from a few roles to high-volume intake.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <img src="/images/hire-faster.jpg" alt="Fast hiring" className="h-44 w-full object-cover" />
            <div className="p-5">
              <p className="text-sm font-semibold text-slate-900">From days of manual review to hours</p>
              <p className="mt-1 text-sm text-slate-600">Configure jobs once and let AI rank applicants against the exact role context.</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <img src="/images/no-more-millions.webp" alt="Scale pipeline" className="h-44 w-full object-cover" />
            <div className="p-5">
              <p className="text-sm font-semibold text-slate-900">Scale without losing quality</p>
              <p className="mt-1 text-sm text-slate-600">Use consistent scorecards to compare candidates fairly across every stage.</p>
            </div>
          </div>
        </div>
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
