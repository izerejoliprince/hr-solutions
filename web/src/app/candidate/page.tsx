"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "../../store";
import type { RootState } from "../../store";
import { logout } from "../../store/slices/authSlice";

interface CandidateApplication {
  _id: string;
  createdAt: string;
  job: {
    _id: string;
    title: string;
    companyName?: string;
    companyLogoUrl?: string;
    location?: string;
    employmentType?: string;
    interviewConfig?: {
      enabled: boolean;
    };
  };
  screeningResult?: {
    matchScore: number;
    overallRecommendation?: string;
  };
  interviewResult?: {
    scores?: {
      overall: number;
    };
  };
}

interface EvidenceProject {
  name: string;
  url: string;
}

interface EvidenceCertificate {
  title: string;
  imageUrl: string;
  originalName?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

function assetUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

export default function CandidateDashboardPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector((s: RootState) => s.auth);
  const [applications, setApplications] = useState<CandidateApplication[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [evidenceProjects, setEvidenceProjects] = useState<EvidenceProject[]>([{ name: "", url: "" }]);
  const [existingCertificates, setExistingCertificates] = useState<EvidenceCertificate[]>([]);
  const [newCertificateFiles, setNewCertificateFiles] = useState<File[]>([]);
  const [newCertificateTitles, setNewCertificateTitles] = useState<string[]>([]);
  const [evidenceSaving, setEvidenceSaving] = useState(false);
  const [evidenceMessage, setEvidenceMessage] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status === "loading") return;
    if (!auth.user || auth.user.role !== "candidate") {
      router.push("/?loginRequired=1");
      return;
    }

    const fetchApplications = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/applications/candidate/applications`, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to load applications");
        }

        const data = await res.json();
        setApplications(data.applications || []);
      } catch (err: any) {
        setError(err.message || "Failed to load applications");
      } finally {
        setLoading(false);
      }
    };

    const fetchJobs = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs`);
        if (!res.ok) throw new Error("Failed to load jobs");
        const data = await res.json();
        setJobs(data || []);
      } catch {
        // silently ignore for now
      }
    };

    const fetchEvidence = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/applications/candidate/evidence`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        const projects = (data.projects || []) as EvidenceProject[];
        const certificates = (data.certificates || []) as EvidenceCertificate[];
        setEvidenceProjects(projects.length > 0 ? projects : [{ name: "", url: "" }]);
        setExistingCertificates(certificates);
      } catch {
        // keep dashboard usable even if evidence load fails
      }
    };

    fetchApplications();
    fetchJobs();
    fetchEvidence();
  }, [auth.status, auth.user, router]);

  const addProjectRow = () => {
    setEvidenceProjects((prev) => [...prev, { name: "", url: "" }]);
  };

  const removeProjectRow = (index: number) => {
    setEvidenceProjects((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const updateProjectField = (index: number, field: keyof EvidenceProject, value: string) => {
    setEvidenceProjects((prev) =>
      prev.map((project, idx) => (idx === index ? { ...project, [field]: value } : project)),
    );
  };

  const submitEvidence = async (e: FormEvent) => {
    e.preventDefault();
    setEvidenceSaving(true);
    setEvidenceError(null);
    setEvidenceMessage(null);

    try {
      const form = new FormData();
      const cleanedProjects = evidenceProjects
        .map((project) => ({ name: project.name.trim(), url: project.url.trim() }))
        .filter((project) => project.name || project.url);

      form.append("projects", JSON.stringify(cleanedProjects));
      form.append("existingCertificates", JSON.stringify(existingCertificates));
      form.append("certificateTitles", JSON.stringify(newCertificateTitles));
      for (const file of newCertificateFiles) {
        form.append("certificateImages", file);
      }

      const res = await fetch(`${API_BASE}/api/applications/candidate/evidence`, {
        method: "PUT",
        credentials: "include",
        body: form,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save dashboard evidence");
      }

      setEvidenceProjects((data.projects || []).length > 0 ? data.projects : [{ name: "", url: "" }]);
      setExistingCertificates(data.certificates || []);
      setNewCertificateFiles([]);
      setNewCertificateTitles([]);
      setEvidenceMessage("Saved. New links and certificates will be considered in screening.");
    } catch (err: any) {
      setEvidenceError(err.message || "Failed to save dashboard evidence");
    } finally {
      setEvidenceSaving(false);
    }
  };

  if (auth.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-600">Loading your dashboard...</p>
      </div>
    );
  }

  if (!auth.user || auth.user.role !== "candidate") {
    return null;
  }

  const hasApplications = applications.length > 0;
  const hasJobs = jobs.length > 0;

  const recommendedInterviewApp = applications.find(
    (app) => app.job?.interviewConfig?.enabled && !app.interviewResult?.scores,
  );

  const appliedJobIds = new Set(applications.map((a) => a.job?._id).filter(Boolean));

  const filteredJobs = jobs.filter((job) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const haystack = [job.title, job.companyName, (job.requiredSkills || []).join(" ")]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  return (
    <div className="app-shell flex">
      {/* Aside navigation */}
      <aside className="app-sidebar w-80 px-7 py-7 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-10">
            {assetUrl(auth.user.profilePhotoUrl) ? (
              <img
                src={assetUrl(auth.user.profilePhotoUrl)}
                alt="Profile"
                className="h-12 w-12 rounded-full border border-slate-300 object-cover"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-sky-100 flex items-center justify-center border border-sky-300">
                <span className="text-sky-500 text-xl font-semibold">{(auth.user.name?.[0] || "C").toUpperCase()}</span>
              </div>
            )}
            <div>
              <div className="text-base font-semibold text-slate-900">{auth.user.name}</div>
              <div className="text-sm text-slate-500">Candidate dashboard</div>
            </div>
          </div>

          <nav className="space-y-3 text-base">
            <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase mb-1">
              Overview
            </div>
            <button
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 bg-slate-900 text-white border border-slate-800"
            >
              <span className="text-sky-400 text-lg">●</span>
              <span className="font-medium text-base">My applications</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/profile")}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            >
              <span className="text-sky-500 text-lg">◦</span>
              <span className="font-medium text-base">Update profile</span>
            </button>
          </nav>
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">AI insight</p>
          <p className="text-sm text-slate-600">
            Resume and interview scores are used only to help
            you and the recruiter find the best mutual fit.
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 px-8 py-8 lg:px-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 mb-1">
              Welcome back, {auth.user.name}
            </h1>
            <p className="text-sm text-slate-600">
              See recommended roles, your applications, and interview progress.
            </p>
          </div>
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
        </header>

        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Project links and certificate uploads</h2>
              <p className="text-xs text-slate-600">
                Keep this updated from your dashboard. Recruiters can review it, and AI screening re-checks changes.
              </p>
            </div>
          </div>

          <form onSubmit={submitEvidence} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Projects</p>
                <button
                  type="button"
                  onClick={addProjectRow}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Add project
                </button>
              </div>

              {evidenceProjects.map((project, index) => (
                <div key={index} className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    type="text"
                    value={project.name}
                    onChange={(e) => updateProjectField(index, "name", e.target.value)}
                    placeholder="Project name"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  />
                  <input
                    type="text"
                    value={project.url}
                    onChange={(e) => updateProjectField(index, "url", e.target.value)}
                    placeholder="GitHub / website / demo URL"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeProjectRow(index)}
                    disabled={evidenceProjects.length === 1}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Certificates</p>

              {existingCertificates.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {existingCertificates.map((certificate, index) => (
                    <div key={`${certificate.imageUrl}-${index}`} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                      <img
                        src={assetUrl(certificate.imageUrl)}
                        alt={certificate.title}
                        className="h-24 w-full rounded border border-slate-200 object-cover"
                      />
                      <input
                        type="text"
                        value={certificate.title}
                        onChange={(e) =>
                          setExistingCertificates((prev) =>
                            prev.map((item, idx) =>
                              idx === index ? { ...item, title: e.target.value } : item,
                            ),
                          )
                        }
                        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setExistingCertificates((prev) => prev.filter((_, idx) => idx !== index))
                        }
                        className="mt-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []).slice(0, 10);
                  setNewCertificateFiles(files);
                  setNewCertificateTitles(files.map((file) => file.name.replace(/\.[a-z0-9]+$/i, "")));
                }}
                className="w-full text-xs text-slate-700"
              />

              {newCertificateFiles.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {newCertificateFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="rounded-md border border-dashed border-slate-300 bg-white p-2">
                      <p className="truncate text-[11px] text-slate-600">{file.name}</p>
                      <input
                        type="text"
                        value={newCertificateTitles[index] || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          setNewCertificateTitles((prev) =>
                            prev.map((title, idx) => (idx === index ? value : title)),
                          );
                        }}
                        placeholder="Certificate title"
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {evidenceError && <p className="text-xs text-red-600">{evidenceError}</p>}
            {evidenceMessage && <p className="text-xs text-emerald-700">{evidenceMessage}</p>}

            <button
              type="submit"
              disabled={evidenceSaving}
              className="rounded-md bg-sky-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
            >
              {evidenceSaving ? "Saving..." : "Save dashboard evidence"}
            </button>
          </form>
        </section>

        {/* Recommended jobs / search */}
        {hasJobs && (
          <section className="mb-8">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Recommended roles
                </h2>
                <p className="text-xs text-slate-600">
                  Browse open roles from your recruiter. Jobs you have already applied to are marked.
                </p>
              </div>
              <div className="w-full max-w-xs">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Search roles
                </label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title, company, or skills"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-900">Certificates and project links</p>
                <p className="mt-1 text-xs text-slate-700">
                  Upload certificate images and add project GitHub links in the apply form for each role.
                </p>
                <p className="mt-1 text-[11px] text-slate-600">
                  Click <span className="font-semibold">Apply</span> on a job card below to submit them.
                </p>
              </div>

              {filteredJobs.length === 0 ? (
                <p className="text-xs text-slate-600">No roles match your search.</p>
              ) : (
                filteredJobs.slice(0, 6).map((job: any) => {
                  const alreadyApplied = appliedJobIds.has(job._id);
                  return (
                    <div
                      key={job._id}
                      className="panel flex items-center justify-between px-4 py-3 hover:border-sky-300 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {assetUrl(job.companyLogoUrl) ? (
                          <img
                            src={assetUrl(job.companyLogoUrl)}
                            alt={`${job.companyName || "Company"} logo`}
                            className="h-11 w-11 rounded-lg border border-slate-200 bg-white object-cover p-1"
                          />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700">
                            {(job.companyName?.[0] || "C").toUpperCase()}
                          </div>
                        )}
                        <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-900">
                            {job.title}
                          </p>
                          {alreadyApplied && (
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                              Applied
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600">
                          {[job.companyName, job.location].filter(Boolean).join(" • ")}
                        </p>
                        {job.requiredSkills?.length > 0 && (
                          <p className="text-[11px] text-slate-500">
                            Key skills: {job.requiredSkills.slice(0, 4).join(", ")}
                            {job.requiredSkills.length > 4 ? "…" : ""}
                          </p>
                        )}
                        </div>
                      </div>
                      <button
                        onClick={() => router.push(`/apply/${job._id}`)}
                        className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-sky-400 transition-colors"
                      >
                        {alreadyApplied ? "View application" : "Apply"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* Applications list */}
        {recommendedInterviewApp && (
          <section className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  AI interview available
                </h3>
                <p className="text-xs text-slate-700">
                  Your recruiter enabled the interview for {recommendedInterviewApp.job?.title}. Complete it now to strengthen your application.
                </p>
              </div>
              <button
                onClick={() => router.push(`/interview/${recommendedInterviewApp._id}`)}
                className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 transition-colors"
              >
                Start interview
              </button>
            </div>
          </section>
        )}

        {loading ? (
          <div className="text-sm text-slate-600">Loading your applications…</div>
        ) : error ? (
          <div className="text-sm text-red-400">{error}</div>
        ) : !hasApplications ? (
          <div className="border border-dashed border-slate-300 rounded-xl p-8 max-w-xl bg-white">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-7 w-7 rounded-full bg-sky-500/10 flex items-center justify-center border border-sky-500/40">
                <span className="text-sky-400 text-sm font-semibold">?</span>
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-1">
                  No applications yet
                </h2>
                <p className="text-xs text-slate-600 mb-3">
                  Once you apply to a role, it will appear here with
                  real-time AI screening and interview status.
                </p>
                <button
                  onClick={() => router.push("/")}
                  className="inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-sky-400 transition-colors"
                >
                  Explore open roles
                </button>
              </div>
            </div>
          </div>
        ) : (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">
                My applications
              </h2>
              <p className="text-xs text-slate-500">
                {applications.length} application{applications.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="space-y-3">
              {applications.map((app) => {
                const screeningMatch = app.screeningResult?.matchScore;
                const interviewScore = app.interviewResult?.scores?.overall;
                const interviewEnabled = !!app.job?.interviewConfig?.enabled;

                let statusLabel = "Submitted";
                if (screeningMatch != null && interviewScore != null) {
                  statusLabel = "Screened & interviewed";
                } else if (screeningMatch != null) {
                  statusLabel = "Screened";
                }

                return (
                  <div
                    key={app._id}
                    className="panel flex items-center justify-between px-4 py-3 hover:border-sky-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {assetUrl(app.job?.companyLogoUrl) ? (
                        <img
                          src={assetUrl(app.job.companyLogoUrl)}
                          alt={`${app.job?.companyName || "Company"} logo`}
                          className="h-11 w-11 rounded-lg border border-slate-200 bg-white object-cover p-1"
                        />
                      ) : (
                        <div className="h-11 w-11 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
                          <span className="text-slate-600 text-sm font-semibold">
                            {app.job?.title?.[0]?.toUpperCase() || "R"}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {app.job?.title || "Role"}
                        </div>
                        <div className="text-xs text-slate-600">
                          {[app.job?.companyName, app.job?.location]
                            .filter(Boolean)
                            .join(" • ")}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 border border-slate-700/70">
                            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                            {statusLabel}
                          </span>
                          {screeningMatch != null && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 border border-slate-700/70">
                              <span className="text-[10px] text-slate-300">Fit</span>
                              <span className="text-xs font-semibold text-white">
                                {Math.round(screeningMatch)}%
                              </span>
                            </span>
                          )}
                          {interviewScore != null && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 border border-slate-700/70">
                              <span className="text-[10px] text-slate-300">Interview</span>
                              <span className="text-xs font-semibold text-white">
                                {Math.round(interviewScore)}%
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <div className="text-[11px] text-slate-500">
                        Applied {new Date(app.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/apply/${app.job._id}`)}
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          View role
                        </button>
                        {interviewEnabled && (
                          <button
                            onClick={() => router.push(`/interview/${app._id}`)}
                            className="rounded-md bg-sky-500 px-2.5 py-1 text-[11px] font-medium text-slate-950 hover:bg-sky-400 transition-colors"
                          >
                            {interviewScore != null ? "View interview" : "Interview"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
