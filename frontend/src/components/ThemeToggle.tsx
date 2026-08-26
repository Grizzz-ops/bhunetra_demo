"use client";

import { useTheme } from "@/lib/theme";
import { MoonIcon, SunIcon } from "./icons";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle color theme"
      className="grid h-10 w-10 place-items-center rounded-lg border border-border text-text-muted hover:text-text active:scale-95 transition-transform"
    >
      {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  );
}
