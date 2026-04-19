"use client";

import { FormEvent, useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "../../store";
import type { RootState } from "../../store";
import { logout } from "../../store/slices/authSlice";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

interface Job {
  _id: string;
  title: string;
  companyName: string;
  description: string;
  requiredSkills: string[];
  createdAt: string;
  rollingBasis?: boolean;
  companyLogoUrl?: string;
  applicationDeadline?: string;
  salaryMin?: number;
  salaryMax?: number;
  interviewConfig?: {
    enabled: boolean;
    languageCode: string;
    mode: "manual" | "auto";
    allowAiFollowups: boolean;
    questions: Array<{
      id: string;
      text: string;
      category:
        | "communication"
        | "problem_understanding"
        | "relevance_to_role"
        | "motivation_interest"
        | "practical_knowledge";
    }>;
  };
}

type NavSection = "overview" | "create" | "interview";

export default function RecruiterDashboard() {
  const auth = useAppSelector((s: RootState) => s.auth);

function assetUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE_URL}${path}`;
}
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screeningNotice, setScreeningNotice] = useState<string | null>(null);

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<NavSection>("overview");

  const [title, setTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [requiredSkillsInput, setRequiredSkillsInput] = useState("");
  const [niceToHaveSkillsInput, setNiceToHaveSkillsInput] = useState("");
  const [rollingBasis, setRollingBasis] = useState(true);
  const [applicationDeadline, setApplicationDeadline] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");

  const [interviewEnabled, setInterviewEnabled] = useState(false);
  const [interviewLanguage, setInterviewLanguage] = useState("en");
  const [interviewMode, setInterviewMode] = useState<"manual" | "auto">("auto");
  const [allowAiFollowups, setAllowAiFollowups] = useState(true);
  const [questionDraft, setQuestionDraft] = useState("");
  const [questionCategory, setQuestionCategory] = useState<
    "communication" | "problem_understanding" | "relevance_to_role" | "motivation_interest" | "practical_knowledge"
  >("communication");
  const [manualQuestions, setManualQuestions] = useState<
    {
      id: string;
      text: string;
      category:
        | "communication"
        | "problem_understanding"
        | "relevance_to_role"
        | "motivation_interest"
        | "practical_knowledge";
    }[]
  >([]);

  const selectedJob = jobs.find((j) => j._id === selectedJobId) ?? null;

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get<Job[]>(`${API_BASE_URL}/api/jobs`, {
        withCredentials: true,
      });
      setJobs(res.data);
      if (!selectedJobId && res.data.length > 0) {
        setSelectedJobId(res.data[0]._id);
      }
    } catch (err: any) {
      const message = err.response?.data?.error ?? "Failed to load jobs";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auth.user && (auth.user.role === "owner" || auth.user.role === "recruiter")) {
      void loadJobs();
    }
  }, [auth.user]);

  const onCreateJob = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const requiredSkills = requiredSkillsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const niceToHaveSkills = niceToHaveSkillsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await axios.post(
        `${API_BASE_URL}/api/jobs`,
        {
          title,
          companyName,
          description,
          requiredSkills,
          niceToHaveSkills,
          rollingBasis,
          ...(rollingBasis || !applicationDeadline ? {} : { applicationDeadline }),
          ...(salaryMin ? { salaryMin: Number(salaryMin) } : {}),
          ...(salaryMax ? { salaryMax: Number(salaryMax) } : {}),
        },
        { withCredentials: true },
      );

      setTitle("");
      setCompanyName("");
      setDescription("");
      setRequiredSkillsInput("");
      setNiceToHaveSkillsInput("");
      setRollingBasis(true);
      setApplicationDeadline("");
      setSalaryMin("");
      setSalaryMax("");

      await loadJobs();
    } catch (err: any) {
      const message = err.response?.data?.error ?? "Failed to create job";
      setError(message);
    }
  };

  const onRunScreening = async (jobId: string) => {
    try {
      setError(null);
      setScreeningNotice("Running AI screening...");
      const res = await axios.post(
        `${API_BASE_URL}/api/jobs/${jobId}/screen`,
        {},
        { withCredentials: true },
      );
      const total = res.data?.totalApplications;
      const message = res.data?.message;
      if (typeof total === "number") {
        setScreeningNotice(`Screening completed. Processed ${total} application${total === 1 ? "" : "s"}.`);
      } else if (message) {
        setScreeningNotice(String(message));
      } else {
        setScreeningNotice("Screening request completed.");
      }
      // For now we just refetch jobs to reflect any changes we might surface later.
      await loadJobs();
    } catch (err: any) {
      const message = err.response?.data?.error ?? "Failed to run screening";
      setError(message);
      setScreeningNotice(null);
    }
  };

  const syncInterviewStateFromJob = (job: Job | null) => {
    if (!job || !job.interviewConfig) {
      setInterviewEnabled(false);
      setInterviewLanguage("en");
      setInterviewMode("auto");
      setAllowAiFollowups(true);
      setQuestionDraft("");
      setQuestionCategory("communication");
       setManualQuestions([]);
      return;
    }
    const cfg = job.interviewConfig;
    setInterviewEnabled(cfg.enabled);
    setInterviewLanguage(cfg.languageCode || "en");
    setInterviewMode(cfg.mode || "auto");
    setAllowAiFollowups(cfg.allowAiFollowups);
    setQuestionDraft("");
    setQuestionCategory("communication");
    setManualQuestions(cfg.questions ?? []);
  };

  useEffect(() => {
    syncInterviewStateFromJob(selectedJob ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId]);

  const onSaveInterviewConfig = async () => {
    if (!selectedJob) return;
    try {
      setError(null);
      const body: any = {
        enabled: interviewEnabled,
        languageCode: interviewLanguage,
        mode: interviewMode,
        allowAiFollowups,
        questions: manualQuestions,
      };

      await axios.put(
        `${API_BASE_URL}/api/jobs/${selectedJob._id}/interview-config`,
        body,
        { withCredentials: true },
      );

      await loadJobs();
    } catch (err: any) {
      const message = err.response?.data?.error ?? "Failed to save interview settings";
      setError(message);
    }
  };

  if (!auth.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-sm text-zinc-700">
          Please log in as a recruiter or owner to access the recruiter dashboard.
        </p>
      </div>
    );
  }

  if (auth.user.role !== "owner" && auth.user.role !== "recruiter") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-sm text-zinc-700">You do not have access to this page.</p>
      </div>
    );
  }

  const jobsWithInterviewEnabled = jobs.filter((j) => j.interviewConfig?.enabled).length;
  const recruiterCompanyLogo = auth.user?.companyLogoUrl;

  return (
    <div className="app-shell px-4 py-8 text-slate-900">
      <div className="mx-auto flex max-w-6xl gap-6">
        <aside className="app-sidebar hidden w-72 shrink-0 flex-col gap-4 rounded-2xl p-5 text-base text-slate-700 md:flex">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Recruiter
            </p>
            <div className="mt-2 flex items-center gap-3">
              {assetUrl(auth.user.profilePhotoUrl) ? (
                <img
                  src={assetUrl(auth.user.profilePhotoUrl)}
                  alt="Profile"
                  className="h-11 w-11 rounded-full border border-slate-300 object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-base font-semibold text-slate-700">
                  {(auth.user.name?.[0] || "R").toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-lg font-semibold text-slate-900">{auth.user.name}</p>
                <p className="text-sm text-slate-500 capitalize">{auth.user.role}</p>
              </div>
            </div>
          </div>

          <nav className="space-y-2">
            <button
              type="button"
              onClick={() => setActiveSection("overview")}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                activeSection === "overview"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>Dashboard</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("create")}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                activeSection === "create"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                <span>Create job</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("interview")}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                activeSection === "interview"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                <span>Interview AI</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/profile")}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition bg-white text-slate-700 hover:bg-slate-100"
            >
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span>Update profile</span>
              </span>
            </button>
          </nav>

          <div className="mt-4 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold text-slate-700">Quick stats</p>
            <div className="flex flex-col gap-1 text-xs text-slate-600">
              <p>
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-zinc-400 mr-1" />
                Jobs: <span className="text-slate-900 font-medium">{jobs.length}</span>
              </p>
              <p>
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1" />
                Interview on: <span className="text-slate-900 font-medium">{jobsWithInterviewEnabled}</span>
              </p>
            </div>
          </div>
        </aside>

        <main className="flex-1 space-y-6">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Recruiter dashboard</h1>
              <p className="text-sm text-slate-600">
                Design roles, configure AI screening, and review candidates.
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <p>
                Signed in as <span className="font-medium text-slate-900">{auth.user.name}</span> ({auth.user.role})
              </p>
              <button
                type="button"
                onClick={async () => {
                  await dispatch(logout() as any);
                  router.push("/");
                }}
                className="btn-danger px-4 py-2 text-sm"
              >
                Logout
              </button>
            </div>
          </header>

          {(error || screeningNotice) && (
            <div className={`rounded-lg border px-3 py-2 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
              {error ?? screeningNotice}
            </div>
          )}

          {activeSection === "overview" && (
            <section className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3 text-xs sm:text-sm">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3">
                  <p className="text-[11px] font-medium text-zinc-400">Open roles</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-50">{jobs.length}</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3">
                  <p className="text-[11px] font-medium text-zinc-400">Interview enabled</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-50">{jobsWithInterviewEnabled}</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3">
                  <p className="text-[11px] font-medium text-zinc-400">Screening runs</p>
                  <p className="mt-1 text-xs text-zinc-500">Triggered per job from the list below.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-zinc-100 sm:text-base">Your jobs</h2>
                  <button
                    type="button"
                    onClick={() => void loadJobs()}
                    className="text-[11px] font-medium text-zinc-400 underline hover:text-zinc-200"
                  >
                    Refresh
                  </button>
                </div>
                {loading ? (
                  <p className="text-sm text-zinc-400">Loading jobs...</p>
                ) : jobs.length === 0 ? (
                  <p className="text-sm text-zinc-400">No jobs yet. Create your first job.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {jobs.map((job) => {
                      const isSelected = job._id === selectedJobId;
                      const cfg = job.interviewConfig;
                      const deadline = job.applicationDeadline ? new Date(job.applicationDeadline) : null;
                      const deadlineReached = Boolean(deadline && !Number.isNaN(deadline.getTime()) && deadline.getTime() <= Date.now());
                      return (
                        <li
                          key={job._id}
                          className={`cursor-pointer rounded-xl border px-3 py-2 transition ${
                            isSelected
                              ? "border-zinc-300 bg-zinc-100 text-zinc-900"
                              : "border-zinc-800 bg-zinc-950/60 text-zinc-200 hover:border-zinc-500"
                          }`}
                          onClick={() => setSelectedJobId(job._id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              {assetUrl(job.companyLogoUrl || recruiterCompanyLogo) ? (
                                <img
                                  src={assetUrl(job.companyLogoUrl || recruiterCompanyLogo)}
                                  alt={`${job.companyName} logo`}
                                  className="h-10 w-10 rounded-lg border border-slate-200 bg-white object-cover p-1"
                                />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700">
                                  {(job.companyName?.[0] || "C").toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-medium">{job.title}</p>
                                <p className="text-[11px] text-zinc-400">{job.companyName}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void onRunScreening(job._id);
                                }}
                                className={`inline-flex items-center justify-center rounded-md px-3 py-1 text-[11px] font-medium ${
                                  isSelected
                                    ? "bg-zinc-900 text-zinc-50 hover:bg-zinc-800"
                                    : "bg-zinc-100 text-zinc-900 hover:bg-white"
                                }`}
                              >
                                Run screening
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/recruiter/jobs/${job._id}`);
                                }}
                                className="inline-flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] font-medium text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800"
                              >
                                View candidates
                              </button>
                              <span className="text-[10px] text-zinc-400">
                                Interview: {cfg?.enabled ? "On" : "Off"}
                              </span>
                            </div>
                          </div>
                          <p className={`mt-1 text-[11px] ${isSelected ? "text-zinc-600" : "text-zinc-400"}`}>
                            {job.description}
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            Required: {job.requiredSkills.join(", ")}
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            Hiring mode: {job.rollingBasis === false ? "Deadline based" : "Rolling basis"}
                            {job.rollingBasis === false && job.applicationDeadline
                              ? ` (deadline ${new Date(job.applicationDeadline).toLocaleDateString()})`
                              : ""}
                          </p>
                          {(typeof job.salaryMin === "number" || typeof job.salaryMax === "number") && (
                            <p className="mt-1 text-[11px] text-zinc-500">
                              Salary range: {typeof job.salaryMin === "number" ? job.salaryMin.toLocaleString() : "0"}
                              {" - "}
                              {typeof job.salaryMax === "number" ? job.salaryMax.toLocaleString() : "Open"}
                            </p>
                          )}
                          {job.rollingBasis === false && (
                            <p className={`mt-1 text-[11px] ${deadlineReached ? "text-amber-300" : "text-zinc-500"}`}>
                              {deadlineReached
                                ? "Deadline reached: run screening to evaluate complete applicant pool."
                                : "Deadline pending: screening can be run now or after deadline."}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          )}

          {activeSection === "create" && (
            <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-lg shadow-black/40">
                  <h2 className="text-sm font-semibold text-zinc-100 sm:text-base">Create job</h2>
                  <p className="mb-3 text-xs text-zinc-400">
                    Define the role and required skills. The AI will use this to score candidates and design
                    interviews.
                  </p>
                  <form onSubmit={onCreateJob} className="space-y-3 text-sm">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-zinc-300">Job title</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-zinc-300">Company name</label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        required
                        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-zinc-300">Description</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        rows={3}
                        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-zinc-300">
                        Required skills <span className="font-normal text-zinc-400">(comma separated)</span>
                      </label>
                      <input
                        type="text"
                        value={requiredSkillsInput}
                        onChange={(e) => setRequiredSkillsInput(e.target.value)}
                        required
                        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-zinc-300">
                        Nice-to-have skills <span className="font-normal text-zinc-400">(comma separated)</span>
                      </label>
                      <input
                        type="text"
                        value={niceToHaveSkillsInput}
                        onChange={(e) => setNiceToHaveSkillsInput(e.target.value)}
                        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-600"
                      />
                    </div>

                    <div className="space-y-1 rounded-md border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                      <label className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                        <input
                          type="checkbox"
                          checked={rollingBasis}
                          onChange={(e) => setRollingBasis(e.target.checked)}
                          className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-zinc-100"
                        />
                        Rolling basis hiring
                      </label>
                      <p className="text-[11px] text-zinc-500">
                        Turn this off if you want to screen after a fixed application deadline.
                      </p>
                    </div>

                    {!rollingBasis && (
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-zinc-300">Application deadline</label>
                        <input
                          type="date"
                          value={applicationDeadline}
                          onChange={(e) => setApplicationDeadline(e.target.value)}
                          required={!rollingBasis}
                          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-600"
                        />
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-zinc-300">Salary min (optional)</label>
                        <input
                          type="number"
                          min={0}
                          value={salaryMin}
                          onChange={(e) => setSalaryMin(e.target.value)}
                          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-600"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-zinc-300">Salary max (optional)</label>
                        <input
                          type="number"
                          min={0}
                          value={salaryMax}
                          onChange={(e) => setSalaryMax(e.target.value)}
                          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-600"
                        />
                      </div>
                    </div>

                    {error && <p className="text-xs text-red-400">{error}</p>}

                    <button
                      type="submit"
                      className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white"
                    >
                      Create job
                    </button>
                  </form>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-xs text-zinc-400 sm:text-sm">
                  <p className="font-medium text-zinc-200">Interview AI</p>
                  <p className="mt-1">
                    Turn on pre-screen interviews per job. The AI will speak questions to candidates, record
                    their answers, and score communication, understanding, relevance, motivation, and practical
                    knowledge.
                  </p>
                </div>
              </div>
            </section>
          )}

          {activeSection === "interview" && (
            <section className="space-y-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-zinc-100 sm:text-base">Your jobs</h2>
                  <button
                    type="button"
                    onClick={() => void loadJobs()}
                    className="text-[11px] font-medium text-zinc-400 underline hover:text-zinc-200"
                  >
                    Refresh
                  </button>
                </div>
                {loading ? (
                  <p className="text-sm text-zinc-400">Loading jobs...</p>
                ) : jobs.length === 0 ? (
                  <p className="text-sm text-zinc-400">No jobs yet. Create your first job.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {jobs.map((job) => {
                      const isSelected = job._id === selectedJobId;
                      const cfg = job.interviewConfig;
                      return (
                        <li
                          key={job._id}
                          className={`cursor-pointer rounded-xl border px-3 py-2 transition ${
                            isSelected
                              ? "border-zinc-300 bg-zinc-100 text-zinc-900"
                              : "border-zinc-800 bg-zinc-950/60 text-zinc-200 hover:border-zinc-500"
                          }`}
                          onClick={() => setSelectedJobId(job._id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              {assetUrl(job.companyLogoUrl || recruiterCompanyLogo) ? (
                                <img
                                  src={assetUrl(job.companyLogoUrl || recruiterCompanyLogo)}
                                  alt={`${job.companyName} logo`}
                                  className="h-10 w-10 rounded-lg border border-slate-200 bg-white object-cover p-1"
                                />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700">
                                  {(job.companyName?.[0] || "C").toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-medium">{job.title}</p>
                                <p className="text-[11px] text-zinc-400">{job.companyName}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[10px] text-zinc-400">
                                Interview: {cfg?.enabled ? "On" : "Off"}
                              </span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-100 sm:text-base">Interview settings</h2>
                    <p className="text-[11px] text-zinc-400">
                      Configure how the AI interviewer behaves for this job.
                    </p>
                  </div>
                  {selectedJob && (
                    <span className="text-[11px] text-zinc-400">{selectedJob.title}</span>
                  )}
                </div>

                {!selectedJob ? (
                  <p className="text-sm text-zinc-400">Select a job from the list to edit interview settings.</p>
                ) : (
                  <div className="space-y-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-zinc-200">Enable pre-screen interview</p>
                        <p className="text-[11px] text-zinc-400">
                          If disabled, this job will only use resume-based screening.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInterviewEnabled((prev) => !prev)}
                        className={`inline-flex h-7 items-center rounded-full border px-2 text-[11px] font-medium transition ${
                          interviewEnabled
                            ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                            : "border-zinc-700 bg-zinc-900 text-zinc-300"
                        }`}
                      >
                        {interviewEnabled ? "Enabled" : "Disabled"}
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-zinc-300">Interview language</label>
                        <select
                          value={interviewLanguage}
                          onChange={(e) => setInterviewLanguage(e.target.value)}
                          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-600"
                        >
                          <option value="en">English</option>
                          <option value="fr">French</option>
                          <option value="de">German</option>
                          <option value="es">Spanish</option>
                          <option value="pt">Portuguese</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-zinc-300">Question mode</label>
                        <div className="flex gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setInterviewMode("auto")}
                            className={`flex-1 rounded-md border px-2 py-1.5 ${
                              interviewMode === "auto"
                                ? "border-zinc-300 bg-zinc-100 text-zinc-900"
                                : "border-zinc-700 bg-zinc-950 text-zinc-300"
                            }`}
                          >
                            AI-designed
                          </button>
                          <button
                            type="button"
                            onClick={() => setInterviewMode("manual")}
                            className={`flex-1 rounded-md border px-2 py-1.5 ${
                              interviewMode === "manual"
                                ? "border-zinc-300 bg-zinc-100 text-zinc-900"
                                : "border-zinc-700 bg-zinc-950 text-zinc-300"
                            }`}
                          >
                            My questions
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-zinc-200">Allow AI follow-ups</p>
                        <p className="text-[11px] text-zinc-400">
                          Let the interviewer ask 1-2 clarifying questions when answers are unclear.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAllowAiFollowups((prev) => !prev)}
                        className={`mt-1 inline-flex h-7 items-center rounded-full border px-2 text-[11px] font-medium transition ${
                          allowAiFollowups
                            ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                            : "border-zinc-700 bg-zinc-900 text-zinc-300"
                        }`}
                      >
                        {allowAiFollowups ? "Allowed" : "Disabled"}
                      </button>
                    </div>

                    {interviewMode === "manual" && (
                      <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                        <p className="text-xs font-medium text-zinc-200">Sample questions</p>
                        <p className="text-[11px] text-zinc-400">
                          We’ll use your questions as the base interview script. Later we’ll also propose
                          AI-generated follow-ups.
                        </p>
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1.8fr)_minmax(0,1.1fr)]">
                          <input
                            type="text"
                            value={questionDraft}
                            onChange={(e) => setQuestionDraft(e.target.value)}
                            placeholder="e.g. Walk me through a recent project you’re proud of."
                            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-600"
                          />
                          <select
                            value={questionCategory}
                            onChange={(e) =>
                              setQuestionCategory(e.target.value as typeof questionCategory)
                            }
                            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-600"
                          >
                            <option value="communication">Communication</option>
                            <option value="problem_understanding">Problem understanding</option>
                            <option value="relevance_to_role">Relevance to role</option>
                            <option value="motivation_interest">Motivation / interest</option>
                            <option value="practical_knowledge">Practical knowledge</option>
                          </select>
                        </div>
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              const text = questionDraft.trim();
                              if (!text) return;
                              setManualQuestions((prev) => [
                                ...prev,
                                {
                                  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                                  text,
                                  category: questionCategory,
                                },
                              ]);
                              setQuestionDraft("");
                              setQuestionCategory("communication");
                            }}
                            className="inline-flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800"
                          >
                            Add question
                          </button>
                        </div>

                        {manualQuestions.length > 0 && (
                          <ul className="mt-2 space-y-1 text-[11px]">
                            {manualQuestions.map((q) => (
                              <li
                                key={q.id}
                                className="flex items-start justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5"
                              >
                                <div>
                                  <p className="text-zinc-100">{q.text}</p>
                                  <p className="text-[10px] text-zinc-500">{q.category}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setManualQuestions((prev) => prev.filter((x) => x.id !== q.id))
                                  }
                                  className="mt-0.5 text-[10px] text-zinc-500 hover:text-zinc-300"
                                >
                                  Remove
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {error && <p className="text-xs text-red-400">{error}</p>}

                    <button
                      type="button"
                      onClick={() => void onSaveInterviewConfig()}
                      className="inline-flex w-full items-center justify-center rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white"
                    >
                      Save interview settings
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
