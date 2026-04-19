"use client";

import { useEffect, useState } from "react";

type ThemeMode = "dark" | "light";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as ThemeMode | null) ?? null;
    const resolved: ThemeMode = stored === "light" ? "light" : "dark";
    setTheme(resolved);
    document.documentElement.setAttribute("data-theme", resolved);
  }, []);

  const toggle = () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}
