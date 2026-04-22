"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "../../../store";
import type { RootState } from "../../../store";
import { logout } from "../../../store/slices/authSlice";

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

export default function CandidateEvidencePage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector((s: RootState) => s.auth);

  const [evidenceProjects, setEvidenceProjects] = useState<EvidenceProject[]>([{ name: "", url: "" }]);
  const [existingCertificates, setExistingCertificates] = useState<EvidenceCertificate[]>([]);
  const [newCertificateFiles, setNewCertificateFiles] = useState<File[]>([]);
  const [newCertificateTitles, setNewCertificateTitles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status === "loading") return;
    if (!auth.user || auth.user.role !== "candidate") {
      router.push("/?loginRequired=1");
      return;
    }

    const fetchEvidence = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/applications/candidate/evidence`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("Failed to load evidence");
        }
        const data = await res.json();
        const projects = (data.projects || []) as EvidenceProject[];
        const certificates = (data.certificates || []) as EvidenceCertificate[];
        setEvidenceProjects(projects.length > 0 ? projects : [{ name: "", url: "" }]);
        setExistingCertificates(certificates);
      } catch (err: any) {
        setError(err.message || "Failed to load evidence");
      }
    };

    void fetchEvidence();
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
    setSaving(true);
    setError(null);
    setMessage(null);

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
        throw new Error(data.error || "Failed to save evidence");
      }

      setEvidenceProjects((data.projects || []).length > 0 ? data.projects : [{ name: "", url: "" }]);
      setExistingCertificates(data.certificates || []);
      setNewCertificateFiles([]);
      setNewCertificateTitles([]);
      setMessage("Saved. Recruiters and AI screening will use the updated evidence.");
    } catch (err: any) {
      setError(err.message || "Failed to save evidence");
    } finally {
      setSaving(false);
    }
  };

  if (auth.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-600">Loading...</p>
      </div>
    );
  }

  if (!auth.user || auth.user.role !== "candidate") {
    return null;
  }

  return (
    <div className="app-shell flex">
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
            <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase mb-1">Overview</div>
            <button
              type="button"
              onClick={() => router.push("/candidate")}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            >
              <span className="text-sky-500 text-lg">◦</span>
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
            <button
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 bg-slate-900 text-white border border-slate-800"
            >
              <span className="text-sky-400 text-lg">●</span>
              <span className="font-medium text-base">Upload projects & certificates</span>
            </button>
          </nav>
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">AI insight</p>
          <p className="text-sm text-slate-600">
            Changes here trigger a refreshed profile signal for your applications.
          </p>
        </div>
      </aside>

      <main className="flex-1 px-8 py-8 lg:px-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 mb-1">Projects and certificates</h1>
            <p className="text-sm text-slate-600">
              Keep your portfolio links and certificate evidence up to date.
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

        <section className="rounded-xl border border-slate-200 bg-white p-5">
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

            {error && <p className="text-xs text-red-600">{error}</p>}
            {message && <p className="text-xs text-emerald-700">{message}</p>}

            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-sky-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save evidence"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
