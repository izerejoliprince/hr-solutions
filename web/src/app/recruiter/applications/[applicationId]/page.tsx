"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

function assetUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE_URL}${path}`;
}

interface CandidateProfile {
  fullName: string;
  email: string;
  headline?: string;
  location?: string;
  linkedInUrl?: string;
  resumeText: string;
}

interface ScreeningResult {
  matchScore: number;
  skillsScore?: number;
  experienceScore?: number;
  educationScore?: number;
  projectScore?: number;
  llmScore?: number;
  deterministicScore?: number;
  agreementGap?: number;
  confidenceLevel?: "low" | "medium" | "high";
  strengths: string[];
  gaps: string[];
  overallRecommendation: "strong_match" | "consider" | "not_recommended";
  rawExplanation: string;
}

interface InterviewScores {
  communicationClarity: number;
  problemUnderstanding: number;
  relevanceToRole: number;
  motivationInterest: number;
  practicalKnowledge: number;
  overall: number;
  llmOverall?: number;
  deterministicOverall?: number;
  agreementGap?: number;
  confidenceLevel?: "low" | "medium" | "high";
  overallWithScreening?: number;
  explanation: string;
}

interface InterviewResult {
  scores?: InterviewScores;
}

interface JobLite {
  title: string;
  companyName: string;
  description: string;
  requiredSkills: string[];
  createdAt: string;
}

interface ApplicationDetail {
  _id: string;
  job: JobLite;
  candidateUserId?: {
    profilePhotoUrl?: string;
    name?: string;
  };
  candidateProfile: CandidateProfile;
  screeningResult?: ScreeningResult;
  interviewResult?: InterviewResult;
  createdAt: string;
}

export default function ApplicationDetailPage() {
  const params = useParams<{ applicationId: string }>();
  const router = useRouter();
  const applicationId = params.applicationId;

  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApplication = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axios.get<ApplicationDetail>(
          `${API_BASE_URL}/api/applications/${applicationId}`,
          { withCredentials: true },
        );
        setApplication(res.data);
      } catch (err: any) {
        const message = err.response?.data?.error ?? "Failed to load application";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    if (applicationId) {
      void fetchApplication();
    }
  }, [applicationId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
        <p className="text-sm">Loading candidate profile…</p>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700 px-4">
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-sm">
          <p className="font-semibold text-red-700">Unable to load candidate</p>
          <p className="mt-1 text-red-600">{error ?? "Application not found"}</p>
          <button
            type="button"
            onClick={() => router.push("/recruiter")}
            className="mt-3 text-xs font-medium text-red-700 underline"
          >
            Back to recruiter dashboard
          </button>
        </div>
      </div>
    );
  }

  const { candidateProfile, screeningResult, interviewResult, job } = application;
  const interviewScores = interviewResult?.scores;

  return (
    <div className="app-shell px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Candidate overview</h1>
            <p className="text-sm text-slate-600">
              Combined view of resume-based fit and AI interview.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/profile")}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Update profile
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="btn-primary px-4 py-2 text-sm"
              >
                Back
              </button>
            </div>
            <p>
              Applied for <span className="font-medium text-slate-900">{job.title}</span> at
              {" "}
              <span className="font-medium text-slate-900">{job.companyName}</span>
            </p>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)]">
          <div className="space-y-4">
            <div className="panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Profile</h2>
                  <p className="mt-1 text-xs text-slate-600">Core candidate details and context.</p>
                </div>
                {candidateProfile.linkedInUrl && (
                  <a
                    href={candidateProfile.linkedInUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-medium text-slate-700 underline hover:text-slate-900"
                  >
                    View LinkedIn
                  </a>
                )}
              </div>
              <div className="mt-3 flex items-center gap-3">
                {assetUrl(application.candidateUserId?.profilePhotoUrl) ? (
                  <img
                    src={assetUrl(application.candidateUserId?.profilePhotoUrl)}
                    alt="Candidate"
                    className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-base font-semibold text-slate-700">
                    {(candidateProfile.fullName?.[0] || "C").toUpperCase()}
                  </div>
                )}
                <div className="space-y-1 text-sm text-slate-700">
                <p className="text-base font-medium text-slate-900">{candidateProfile.fullName}</p>
                <p className="text-slate-700">{candidateProfile.headline}</p>
                <p className="text-slate-500">
                  {candidateProfile.location && <span>{candidateProfile.location} · </span>}
                  {candidateProfile.email}
                </p>
                </div>
              </div>
            </div>

            {screeningResult && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-100">Resume-based fit</h2>
                  <div className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-3 py-1 text-[11px]">
                    <span className="text-zinc-400">Match score</span>
                    <span className="font-semibold text-zinc-50">{Math.round(screeningResult.matchScore)}%</span>
                  </div>
                </div>
                {(typeof screeningResult.llmScore === "number" ||
                  typeof screeningResult.deterministicScore === "number" ||
                  typeof screeningResult.agreementGap === "number" ||
                  typeof screeningResult.confidenceLevel === "string") && (
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    {typeof screeningResult.llmScore === "number" && (
                      <MiniMetric label="Screening LLM" value={screeningResult.llmScore} />
                    )}
                    {typeof screeningResult.deterministicScore === "number" && (
                      <MiniMetric
                        label="Screening deterministic"
                        value={screeningResult.deterministicScore}
                      />
                    )}
                    {typeof screeningResult.agreementGap === "number" && (
                      <MetaChip
                        label="Screening agreement gap"
                        value={screeningResult.agreementGap.toFixed(1)}
                      />
                    )}
                    {typeof screeningResult.confidenceLevel === "string" && (
                      <ConfidenceChip
                        scope="Screening"
                        confidence={screeningResult.confidenceLevel}
                      />
                    )}
                  </div>
                )}
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  {typeof screeningResult.skillsScore === "number" && (
                    <MiniMetric label="Skills" value={screeningResult.skillsScore} />
                  )}
                  {typeof screeningResult.experienceScore === "number" && (
                    <MiniMetric label="Experience" value={screeningResult.experienceScore} />
                  )}
                  {typeof screeningResult.educationScore === "number" && (
                    <MiniMetric label="Education" value={screeningResult.educationScore} />
                  )}
                  {typeof screeningResult.projectScore === "number" && (
                    <MiniMetric label="Projects" value={screeningResult.projectScore} />
                  )}
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="mb-1 font-medium text-emerald-300">Strengths</p>
                    <ul className="space-y-1 text-emerald-100">
                      {screeningResult.strengths.map((s, idx) => (
                        <li key={idx}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 font-medium text-amber-300">Gaps / risks</p>
                    <ul className="space-y-1 text-amber-100">
                      {screeningResult.gaps.map((g, idx) => (
                        <li key={idx}>• {g}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-sm leading-6 text-zinc-200">
                  <p className="mb-1 font-medium text-zinc-300">AI explanation</p>
                  <p className="whitespace-pre-line">{screeningResult.rawExplanation}</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {interviewScores && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-100">Interview evaluation</h2>
                  <div className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-3 py-1 text-[11px]">
                    <span className="text-zinc-400">Overall</span>
                    <span className="font-semibold text-zinc-50">{Math.round(interviewScores.overall)}%</span>
                  </div>
                </div>
                {(typeof interviewScores.llmOverall === "number" ||
                  typeof interviewScores.deterministicOverall === "number" ||
                  typeof interviewScores.agreementGap === "number" ||
                  typeof interviewScores.overallWithScreening === "number" ||
                  typeof interviewScores.confidenceLevel === "string") && (
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    {typeof interviewScores.llmOverall === "number" && (
                      <MiniMetric label="Interview LLM" value={interviewScores.llmOverall} />
                    )}
                    {typeof interviewScores.deterministicOverall === "number" && (
                      <MiniMetric
                        label="Interview deterministic"
                        value={interviewScores.deterministicOverall}
                      />
                    )}
                    {typeof interviewScores.overallWithScreening === "number" && (
                      <MiniMetric
                        label="Interview + screening"
                        value={interviewScores.overallWithScreening}
                      />
                    )}
                    {typeof interviewScores.agreementGap === "number" && (
                      <MetaChip
                        label="Interview agreement gap"
                        value={interviewScores.agreementGap.toFixed(1)}
                      />
                    )}
                    {typeof interviewScores.confidenceLevel === "string" && (
                      <ConfidenceChip
                        scope="Interview"
                        confidence={interviewScores.confidenceLevel}
                      />
                    )}
                  </div>
                )}
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <MiniMetric label="Communication" value={interviewScores.communicationClarity} />
                  <MiniMetric label="Problem understanding" value={interviewScores.problemUnderstanding} />
                  <MiniMetric label="Relevance to role" value={interviewScores.relevanceToRole} />
                  <MiniMetric label="Motivation / interest" value={interviewScores.motivationInterest} />
                  <MiniMetric label="Practical knowledge" value={interviewScores.practicalKnowledge} />
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-sm leading-6 text-zinc-200">
                  <p className="mb-1 font-medium text-zinc-300">Interview summary</p>
                  <p className="whitespace-pre-line">{interviewScores.explanation}</p>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 space-y-2 text-sm text-zinc-300">
              <p className="font-medium text-zinc-200">Job snapshot</p>
              <p className="text-sm text-zinc-400">{job.title} · {job.companyName}</p>
              <p className="text-zinc-400 line-clamp-4">{job.description}</p>
              {job.requiredSkills?.length > 0 && (
                <p className="text-zinc-500 mt-1">
                  Required skills: <span className="text-zinc-300">{job.requiredSkills.join(", ")}</span>
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
      <p className="text-[11px] text-zinc-400">{label}</p>
      <p className="text-sm font-semibold text-zinc-100">{Math.round(safe)}%</p>
    </div>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
      <p className="text-[11px] text-zinc-400">{label}</p>
      <p className="text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function ConfidenceChip({
  scope,
  confidence,
}: {
  scope: "Screening" | "Interview";
  confidence: "low" | "medium" | "high";
}) {
  const confidenceTone = {
    high: "border-emerald-500/40 bg-emerald-950/40 text-emerald-200",
    medium: "border-amber-500/40 bg-amber-950/30 text-amber-200",
    low: "border-red-500/40 bg-red-950/30 text-red-200",
  } as const;

  return (
    <div className={`rounded-lg border px-3 py-2 ${confidenceTone[confidence]}`}>
      <p className="text-[11px] uppercase tracking-wide">{scope} confidence</p>
      <p className="text-sm font-semibold uppercase">{confidence}</p>
    </div>
  );
}
