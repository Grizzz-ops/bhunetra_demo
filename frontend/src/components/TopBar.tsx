"use client";

import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "./ThemeToggle";
import { LogoutIcon, RefreshIcon } from "./icons";

const ROLE_LABEL: Record<string, string> = {
  FIELD_OFFICER: "Field Officer",
  DGM_ADMIN: "DGM / IBM HQ",
};

export function TopBar({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  const { session, logout } = useAuth();

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-3.5 py-2.5 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <div className="font-display font-bold text-lg tracking-tight text-text shrink-0">
          BHUNETRA
        </div>
        {session && (
          <span
            className="hidden sm:inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-display font-semibold uppercase tracking-wide"
            style={{ background: "var(--unverified-bg)", color: "var(--unverified)" }}
          >
            {ROLE_LABEL[session.role] ?? session.role}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {session && (
          <span className="hidden md:block text-sm text-text-muted truncate max-w-[160px]">
            {session.name}
          </span>
        )}
        <button
          onClick={onRefresh}
          aria-label="Refresh"
          className="grid h-10 w-10 place-items-center rounded-lg border border-border text-text-muted active:scale-95 transition-transform"
        >
          <RefreshIcon size={17} className={refreshing ? "animate-spin" : ""} />
        </button>
        <ThemeToggle />
        <button
          onClick={logout}
          aria-label="Log out"
          className="grid h-10 w-10 place-items-center rounded-lg border border-border text-text-muted active:scale-95 transition-transform"
        >
          <LogoutIcon size={17} />
        </button>
      </div>
    </header>
  );
}
