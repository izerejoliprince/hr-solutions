"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useAppDispatch, useAppSelector } from "../../store";
import type { RootState } from "../../store";
import { initializeAuth } from "../../store/slices/authSlice";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

function assetUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE_URL}${path}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector((s: RootState) => s.auth);

  const [name, setName] = useState(auth.user?.name ?? "");
  const [companyName, setCompanyName] = useState(auth.user?.companyName ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [companyLogo, setCompanyLogo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dashboardPath =
    auth.user?.role === "owner"
      ? "/admin"
      : auth.user?.role === "recruiter"
        ? "/recruiter"
        : "/candidate";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const form = new FormData();
      form.append("name", name);
      if (companyName) form.append("companyName", companyName);
      if (currentPassword) form.append("currentPassword", currentPassword);
      if (newPassword) form.append("newPassword", newPassword);
      if (profilePhoto) form.append("profilePhoto", profilePhoto);
      if (companyLogo) form.append("companyLogo", companyLogo);

      await axios.put(`${API_BASE_URL}/auth/profile`, form, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });

      await dispatch(initializeAuth() as any);
      setCurrentPassword("");
      setNewPassword("");
      setProfilePhoto(null);
      setCompanyLogo(null);
      setMessage("Profile updated successfully.");
    } catch (err: any) {
      const apiError = err.response?.data?.error ?? "Failed to update profile";
      setError(apiError);
    } finally {
      setSaving(false);
    }
  };

  if (!auth.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-700 mb-3">Please login to access profile settings.</p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-md bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500"
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell px-4 py-10">
      <div className="mx-auto max-w-4xl panel p-7 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Profile settings</h1>
          <button
            type="button"
            onClick={() => router.push(dashboardPath)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Back to dashboard
          </button>
        </div>
        <p className="mt-1 text-base text-slate-600">
          Update your name, password, profile photo, and company branding.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Profile photo</p>
            <div className="mt-3 flex items-center gap-3">
              {assetUrl(auth.user.profilePhotoUrl) ? (
                <img
                  src={assetUrl(auth.user.profilePhotoUrl)}
                  alt="Profile"
                  className="h-14 w-14 rounded-full border border-slate-300 object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-700">
                  {(auth.user.name?.[0] || "U").toUpperCase()}
                </div>
              )}
              <div className="text-sm text-slate-600">This appears in dashboards and candidate/recruiter views.</div>
            </div>
          </div>
          {(auth.user.role === "owner" || auth.user.role === "recruiter") && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company logo</p>
              <div className="mt-3 flex items-center gap-3">
                {assetUrl(auth.user.companyLogoUrl) ? (
                  <img
                    src={assetUrl(auth.user.companyLogoUrl)}
                    alt="Company logo"
                    className="h-14 w-14 rounded-xl border border-slate-300 bg-white object-cover p-1"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-300 bg-white text-base font-semibold text-slate-700">
                    {(companyName?.[0] || auth.user.companyName?.[0] || "C").toUpperCase()}
                  </div>
                )}
                <div className="text-sm text-slate-600">This appears next to jobs and role cards.</div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="mt-7 space-y-5">
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-slate-700">Username</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-base text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              required
            />
          </div>

          {(auth.user.role === "owner" || auth.user.role === "recruiter") && (
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-slate-700">Company name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-base text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-slate-700">Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-base text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-slate-700">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-base text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-slate-700">Profile photo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setProfilePhoto(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
              />
            </div>
            {(auth.user.role === "owner" || auth.user.role === "recruiter") && (
              <div className="space-y-1">
                <label className="block text-sm font-semibold text-slate-700">Company logo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCompanyLogo(e.target.files?.[0] ?? null)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                />
              </div>
            )}
          </div>

          {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary inline-flex items-center px-5 py-2.5 text-sm disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
        </form>
      </div>
    </div>
  );
}
