"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "../../store";
import type { RootState } from "../../store";
import { logout } from "../../store/slices/authSlice";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

interface AdminJob {
  _id: string;
  title: string;
  companyName: string;
  description: string;
  companyLogoUrl?: string;
  requiredSkills: string[];
  createdAt: string;
  applicantCount: number;
  screenedCount: number;
  interviewedCount: number;
}

interface AdminOverview {
  totals: {
    jobs: number;
    applicants: number;
    screened: number;
    interviewed: number;
  };
  jobs: AdminJob[];
}

function assetUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE_URL}${path}`;
}

export default function AdminDashboardPage() {
  const auth = useAppSelector((s: RootState) => s.auth);
  const dispatch = useAppDispatch();
  const router = useRouter();

  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status === "loading") return;
    if (!auth.user || auth.user.role !== "owner") {
      router.push("/");
      return;
    }

    const loadOverview = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE_URL}/api/jobs/admin/overview`, {
          credentials: "include",
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || "Failed to load admin dashboard");
        }

        const payload = (await res.json()) as AdminOverview;
        setData(payload);
      } catch (err: any) {
        setError(err.message || "Failed to load admin dashboard");
      } finally {
        setLoading(false);
      }
    };

    void loadOverview();
  }, [auth.status, auth.user, router]);

  const sortedJobs = useMemo(() => {
    if (!data?.jobs) return [];
    return [...data.jobs].sort((a, b) => b.applicantCount - a.applicantCount);
  }, [data]);

  if (auth.status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-600">Loading admin dashboard...</p>
      </div>
    );
  }

  if (!auth.user || auth.user.role !== "owner") {
    return null;
  }

  return (
    <div className="app-shell px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Admin dashboard</h1>
            <p className="text-sm text-slate-600">Platform-wide overview for owner account.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/profile")}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Profile
            </button>
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

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-4">
          <StatCard label="Jobs" value={data?.totals.jobs ?? 0} />
          <StatCard label="Applicants" value={data?.totals.applicants ?? 0} />
          <StatCard label="Screened" value={data?.totals.screened ?? 0} />
          <StatCard label="Interviewed" value={data?.totals.interviewed ?? 0} />
        </section>

        <section className="panel p-5">
          <h2 className="text-base font-semibold text-slate-900">All jobs and applicant volume</h2>
          <p className="mt-1 text-xs text-slate-600">
            Ordered by applicant count so you can monitor active demand and hiring pressure.
          </p>

          {sortedJobs.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No jobs available yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Job</th>
                    <th className="py-2 pr-3">Company</th>
                    <th className="py-2 pr-3">Applicants</th>
                    <th className="py-2 pr-3">Screened</th>
                    <th className="py-2 pr-3">Interviewed</th>
                    <th className="py-2 pr-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedJobs.map((job) => (
                    <tr key={job._id} className="border-b border-slate-100 text-slate-700">
                      <td className="py-3 pr-3 font-medium text-slate-900">{job.title}</td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          {assetUrl(job.companyLogoUrl) ? (
                            <img
                              src={assetUrl(job.companyLogoUrl)}
                              alt={`${job.companyName} logo`}
                              className="h-8 w-8 rounded-lg border border-slate-200 bg-white object-cover p-1"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700">
                              {(job.companyName?.[0] || "C").toUpperCase()}
                            </div>
                          )}
                          <span>{job.companyName}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3">{job.applicantCount}</td>
                      <td className="py-3 pr-3">{job.screenedCount}</td>
                      <td className="py-3 pr-3">{job.interviewedCount}</td>
                      <td className="py-3 pr-3">{new Date(job.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
