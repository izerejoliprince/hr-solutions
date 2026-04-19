"use client";

import { useEffect, useMemo, useState } from "react";
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
}

interface ScreeningResult {
  matchScore: number;
  llmScore?: number;
  deterministicScore?: number;
  agreementGap?: number;
  confidenceLevel?: "low" | "medium" | "high";
  overallRecommendation: "strong_match" | "consider" | "not_recommended";
  strengths: string[];
  gaps: string[];
}

interface InterviewScores {
  overall: number;
  llmOverall?: number;
  deterministicOverall?: number;
  agreementGap?: number;
  confidenceLevel?: "low" | "medium" | "high";
  overallWithScreening?: number;
}

interface InterviewResult {
  scores?: InterviewScores;
}

interface Application {
  _id: string;
  candidateProfile: CandidateProfile;
  candidateUserId?: {
    profilePhotoUrl?: string;
    name?: string;
  };
  screeningResult?: ScreeningResult;
  interviewResult?: InterviewResult;
  createdAt: string;
}

interface JobApplicationsResponse {
  jobId: string;
  totalApplications: number;
  applications: Application[];
}

export default function JobCandidatesPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const jobId = params.jobId;

  const [data, setData] = useState<JobApplicationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axios.get<JobApplicationsResponse>(
          `${API_BASE_URL}/api/jobs/${jobId}/applications`,
          { withCredentials: true },
        );
        setData(res.data);
      } catch (err: any) {
        const message = err.response?.data?.error ?? "Failed to load applications";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    if (jobId) {
      void fetchApplications();
    }
  }, [jobId]);

  const { topCandidates, others } = useMemo(() => {
    if (!data?.applications) return { topCandidates: [], others: [] };
    const apps = data.applications;
    const top = apps.slice(0, 10);
    const rest = apps.slice(10);
    return { topCandidates: top, others: rest };
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
        <p className="text-sm">Loading candidates…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700 px-4">
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-sm">
          <p className="font-semibold text-red-700">Unable to load candidates</p>
          <p className="mt-1 text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const handleViewCandidate = (applicationId: string) => {
    router.push(`/recruiter/applications/${applicationId}`);
  };

  return (
    <div className="app-shell px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
            <p className="text-sm text-slate-600">
              Ranked by AI screening match score. Top profiles appear first.
            </p>
          </div>
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
              onClick={() => router.push("/recruiter")}
              className="btn-primary px-4 py-2 text-sm"
            >
              Back to recruiter dashboard
            </button>
          </div>
        </header>

        {!data || data.totalApplications === 0 ? (
          <p className="text-sm text-slate-600">No applications yet for this job.</p>
        ) : (
          <div className="space-y-6">
            <section className="space-y-3">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <p>
                  Top {Math.min(10, data.totalApplications)} of {data.totalApplications} applicants
                </p>
              </div>
              <div className="space-y-2">
                {topCandidates.map((app) => (
                  <CandidateRow key={app._id} application={app} onView={handleViewCandidate} />
                ))}
              </div>
            </section>

            {others.length > 0 && (
              <section className="space-y-3">
                <p className="text-sm font-medium text-slate-600">Other applicants</p>
                <div className="space-y-2">
                  {others.map((app) => (
                    <CandidateRow key={app._id} application={app} onView={handleViewCandidate} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CandidateRow({
  application,
  onView,
}: {
  application: Application;
  onView: (id: string) => void;
}) {
  const screening = application.screeningResult;
  const interviewScores = application.interviewResult?.scores;
  const matchScore = screening?.matchScore ?? 0;
  const overall = screening?.overallRecommendation;
  const interviewOverall = interviewScores?.overall;

  return (
    <button
      type="button"
      onClick={() => onView(application._id)}
      className="panel flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm hover:border-sky-300"
    >
      <div className="flex items-center gap-3">
        {assetUrl(application.candidateUserId?.profilePhotoUrl) ? (
          <img
            src={assetUrl(application.candidateUserId?.profilePhotoUrl)}
            alt="Candidate"
            className="h-11 w-11 rounded-full border border-slate-200 object-cover"
          />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700">
            {(application.candidateProfile.fullName?.[0] || "C").toUpperCase()}
          </div>
        )}
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-slate-900">{application.candidateProfile.fullName}</p>
          <p className="text-[12px] text-slate-600">{application.candidateProfile.headline}</p>
          <p className="text-[12px] text-slate-500">
            {application.candidateProfile.location} · {application.candidateProfile.email}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 text-[11px]">
        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5">
          <span className="text-slate-600">Match</span>
          <span className="font-semibold text-slate-900">{Math.round(matchScore)}%</span>
        </div>
        {typeof screening?.confidenceLevel === "string" && (
          <ConfidenceBadge scope="Screen" confidence={screening.confidenceLevel} />
        )}
        {typeof screening?.agreementGap === "number" && (
          <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-slate-700">
            <span className="text-slate-600">Screen gap</span>
            <span>{Math.round(screening.agreementGap)}</span>
          </div>
        )}
        {typeof interviewOverall === "number" && (
          <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5">
            <span className="text-slate-600">Interview</span>
            <span className="font-semibold text-slate-900">{Math.round(interviewOverall)}%</span>
          </div>
        )}
        {typeof interviewScores?.confidenceLevel === "string" && (
          <ConfidenceBadge scope="Interview" confidence={interviewScores.confidenceLevel} />
        )}
        {typeof interviewScores?.agreementGap === "number" && (
          <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-slate-700">
            <span className="text-slate-600">Interview gap</span>
            <span>{Math.round(interviewScores.agreementGap)}</span>
          </div>
        )}
        {overall && (
          <span className="text-[10px] uppercase tracking-wide text-slate-500">
            {overall.replace("_", " ")}
          </span>
        )}
      </div>
    </button>
  );
}

function ConfidenceBadge({
  scope,
  confidence,
}: {
  scope: "Screen" | "Interview";
  confidence: "low" | "medium" | "high";
}) {
  const confidenceTone = {
    high: "border-emerald-500/40 bg-emerald-950/40 text-emerald-200",
    medium: "border-amber-500/40 bg-amber-950/30 text-amber-200",
    low: "border-red-500/40 bg-red-950/30 text-red-200",
  } as const;

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${confidenceTone[confidence]}`}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide">{scope}</span>
      <span className="text-[10px] uppercase tracking-wide">{confidence}</span>
    </div>
  );
}
