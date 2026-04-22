"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import { useAppSelector } from "../../../store";
import type { RootState } from "../../../store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

interface ExistingApplication {
  _id: string;
  createdAt: string;
  screeningResult?: {
    matchScore?: number;
  };
  interviewResult?: {
    scores?: {
      overall?: number;
    };
  };
}

export default function ApplyPage() {
  const auth = useAppSelector((s: RootState) => s.auth);
  const router = useRouter();
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [availabilityStatus, setAvailabilityStatus] = useState<"" | "available" | "open_to_opportunities" | "not_available">("");
  const [availabilityType, setAvailabilityType] = useState<"" | "full_time" | "part_time" | "contract">("");
  const [availabilityStartDate, setAvailabilityStartDate] = useState("");
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [existingApplication, setExistingApplication] = useState<ExistingApplication | null>(null);

  useEffect(() => {
    const loadExisting = async () => {
      if (!auth.user || auth.user.role !== "candidate" || !jobId) {
        setCheckingExisting(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/applications/candidate/applications`, {
          credentials: "include",
        });

        if (!res.ok) {
          setCheckingExisting(false);
          return;
        }

        const data = await res.json();
        const apps = (data.applications || []) as any[];
        const existing = apps.find((a) => String(a.job?._id) === String(jobId));
        setExistingApplication(existing || null);

        if (existing) {
          setFullName(existing?.candidateProfile?.fullName || "");
          setEmail(existing?.candidateProfile?.email || "");
          setHeadline(existing?.candidateProfile?.headline || "");
          setBio(existing?.candidateProfile?.bio || "");
          setLocation(existing?.candidateProfile?.location || "");
          setAvailabilityStatus(existing?.candidateProfile?.availability?.status || "");
          setAvailabilityType(existing?.candidateProfile?.availability?.type || "");
          setAvailabilityStartDate(existing?.candidateProfile?.availability?.startDate || "");
          setLinkedInUrl(existing?.candidateProfile?.linkedInUrl || "");
        }
      } finally {
        setCheckingExisting(false);
      }
    };

    void loadExisting();
  }, [auth.user, jobId]);

  if (auth.status !== "loading" && (!auth.user || auth.user.role !== "candidate")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-base font-semibold text-amber-900">Please first login to access this page.</p>
          <p className="mt-2 text-sm text-amber-800">Sign in as a candidate to apply for jobs.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (existingApplication) {
      setError("You already applied to this job.");
      return;
    }

    if (!jobId || !resumeFile) {
      setError("Job ID and resume are required");
      return;
    }

    try {
      setStatus("submitting");
      setError(null);

      const form = new FormData();
      form.append("jobId", String(jobId));
      form.append("fullName", fullName);
      form.append("email", email);
      if (headline) form.append("headline", headline);
      if (bio) form.append("bio", bio);
      if (location) form.append("location", location);
      if (linkedInUrl) form.append("linkedInUrl", linkedInUrl);
      if (availabilityStatus || availabilityType || availabilityStartDate) {
        form.append(
          "availability",
          JSON.stringify({
            ...(availabilityStatus ? { status: availabilityStatus } : {}),
            ...(availabilityType ? { type: availabilityType } : {}),
            ...(availabilityStartDate ? { startDate: availabilityStartDate } : {}),
          }),
        );
      }
      form.append("resumeFile", resumeFile);
      if (coverLetterFile) form.append("coverLetterFile", coverLetterFile);

      await axios.post(`${API_BASE_URL}/api/applications/upload`, form, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });

      setStatus("success");
    } catch (err: any) {
      const message = err.response?.data?.error ?? "Failed to submit application";
      setError(message);
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-cyan-50 px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_1fr]">
        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <img
            src="/images/looking-for-job.jpeg"
            alt="Candidate applying"
            className="h-56 w-full object-cover"
          />
          <div className="p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Apply Smart</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Show your strengths clearly</h1>
            <p className="mt-2 text-sm text-slate-700">
              Highlight your best skills, add a concise headline, and upload a clean resume. The AI will match
              your profile against the role and surface your strongest fit points.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>• Mention 3-5 core skills related to the role.</li>
              <li>• Use a direct headline that reflects your specialization.</li>
              <li>• Add LinkedIn if it contains relevant project proof.</li>
              <li>• Keep project links and certificate uploads updated from your dashboard evidence page.</li>
            </ul>
          </div>
        </aside>

        <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm px-8 py-8 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-slate-900">Apply for Job</h2>
            <button
              type="button"
              onClick={() => router.push("/candidate")}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Back to dashboard
            </button>
          </div>
          <p className="text-sm text-slate-600">Job ID: {String(jobId)}</p>

          {checkingExisting ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Checking your existing application status...
            </div>
          ) : existingApplication ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              <p className="font-semibold">Application already submitted</p>
              <p className="mt-1 text-xs text-amber-800">
                Applied on {new Date(existingApplication.createdAt).toLocaleDateString()}.
                {existingApplication.interviewResult?.scores?.overall != null
                  ? ` Interview score: ${Math.round(existingApplication.interviewResult.scores.overall)}%.`
                  : existingApplication.screeningResult?.matchScore != null
                    ? ` Screening in progress / completed. Current fit: ${Math.round(existingApplication.screeningResult.matchScore)}%.`
                    : " Status: Pending recruiter screening."}
              </p>
            </div>
          ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1 text-sm">
            <label className="block font-semibold text-slate-700">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={!!existingApplication}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </div>

          <div className="space-y-1 text-sm">
            <label className="block font-semibold text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!!existingApplication}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </div>

          <div className="space-y-1 text-sm">
            <label className="block font-semibold text-slate-700">Headline (optional)</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              disabled={!!existingApplication}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </div>

          <div className="space-y-1 text-sm">
            <label className="block font-semibold text-slate-700">Bio (optional)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              disabled={!!existingApplication}
              rows={3}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </div>

          <div className="space-y-1 text-sm">
            <label className="block font-semibold text-slate-700">Location (optional)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={!!existingApplication}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </div>

          <div className="space-y-1 text-sm">
            <label className="block font-semibold text-slate-700">LinkedIn URL (optional)</label>
            <input
              type="text"
              placeholder="linkedin.com/in/your-profile"
              value={linkedInUrl}
              onChange={(e) => setLinkedInUrl(e.target.value)}
              disabled={!!existingApplication}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
            <p className="text-[11px] text-slate-500">You can paste with or without https://</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1 text-sm">
              <label className="block font-semibold text-slate-700">Availability status (optional)</label>
              <select
                value={availabilityStatus}
                onChange={(e) => setAvailabilityStatus(e.target.value as any)}
                disabled={!!existingApplication}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              >
                <option value="">Select</option>
                <option value="available">Available</option>
                <option value="open_to_opportunities">Open to opportunities</option>
                <option value="not_available">Not available</option>
              </select>
            </div>
            <div className="space-y-1 text-sm">
              <label className="block font-semibold text-slate-700">Availability type (optional)</label>
              <select
                value={availabilityType}
                onChange={(e) => setAvailabilityType(e.target.value as any)}
                disabled={!!existingApplication}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              >
                <option value="">Select</option>
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
                <option value="contract">Contract</option>
              </select>
            </div>
            <div className="space-y-1 text-sm">
              <label className="block font-semibold text-slate-700">Start date (optional)</label>
              <input
                type="date"
                value={availabilityStartDate}
                onChange={(e) => setAvailabilityStartDate(e.target.value)}
                disabled={!!existingApplication}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              />
            </div>
          </div>

          <div className="space-y-1 text-sm">
            <label className="block font-semibold text-slate-700">Resume (PDF or DOCX)</label>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setResumeFile(file);
              }}
              required
              disabled={!!existingApplication}
              className="w-full text-sm text-slate-700"
            />
          </div>

          <div className="space-y-1 text-sm">
            <label className="block font-semibold text-slate-700">Cover letter (optional, PDF or DOCX)</label>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setCoverLetterFile(file);
              }}
              disabled={!!existingApplication}
              className="w-full text-sm text-slate-700"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {status === "success" && (
            <p className="text-sm text-emerald-700">Application submitted successfully.</p>
          )}

          <button
            type="submit"
            disabled={status === "submitting" || !!existingApplication || checkingExisting}
            className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
          >
            {status === "submitting"
              ? "Submitting..."
              : existingApplication
                ? "Already applied"
                : "Submit application"}
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}
