"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AlertOctagonIcon, ShieldIcon, BuildingIcon, CheckIcon } from "@/components/icons";

export default function LoginPage() {
  const { session, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) {
      if (session.role === "DGM_ADMIN") {
        router.replace("/dgm");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [loading, session, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await login(email.trim(), password);
      if (res.role === "DGM_ADMIN") {
        router.replace("/dgm");
      } else {
        router.replace("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleQuickFill(role: "field" | "dgm") {
    if (role === "field") {
      setEmail("field@bhunetra.demo");
      setPassword("field123");
    } else {
      setEmail("dgm@bhunetra.gov.in");
      setPassword("dgm123");
    }
    setError(null);
  }

  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <div className="flex-1 grid place-items-center px-4 pb-16">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight text-text">
              <span className="text-accent">◈</span>
              <span>BHUNETRA</span>
            </div>
            <div className="mt-1 text-sm text-text-muted">
              Spaceborne Mining Surveillance & Directorate Legal Action
            </div>
          </div>

          {/* Quick Credential Selectors */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill("field")}
              className={`p-3 rounded-xl border text-left transition-all active:scale-95 ${
                email === "field@bhunetra.demo"
                  ? "border-accent bg-surface-raised shadow-xs"
                  : "border-border bg-surface hover:bg-surface-raised"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-display font-bold uppercase tracking-wide text-accent flex items-center gap-1">
                  <ShieldIcon size={13} />
                  Field Officer
                </span>
                {email === "field@bhunetra.demo" && <CheckIcon size={12} className="text-accent" />}
              </div>
              <div className="text-[11px] font-mono text-text truncate">field@bhunetra.demo</div>
              <div className="text-[10px] text-text-faint">Pass: field123</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill("dgm")}
              className={`p-3 rounded-xl border text-left transition-all active:scale-95 ${
                email === "dgm@bhunetra.gov.in"
                  ? "border-amber-500 bg-surface-raised shadow-xs"
                  : "border-border bg-surface hover:bg-surface-raised"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-display font-bold uppercase tracking-wide text-amber-500 flex items-center gap-1">
                  <BuildingIcon size={13} />
                  DGM Admin
                </span>
                {email === "dgm@bhunetra.gov.in" && <CheckIcon size={12} className="text-amber-500" />}
              </div>
              <div className="text-[11px] font-mono text-text truncate">dgm@bhunetra.gov.in</div>
              <div className="text-[10px] text-text-faint">Pass: dgm123</div>
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow)] space-y-4"
          >
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-display font-semibold uppercase tracking-wide text-text-muted">
                Official Government Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-3.5 py-3 text-sm text-text outline-none focus:border-accent font-sans"
                placeholder="officer@bhunetra.gov.in or dgm@bhunetra.gov.in"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-display font-semibold uppercase tracking-wide text-text-muted">
                Secure Access Key / Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-3.5 py-3 text-sm text-text outline-none focus:border-accent"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div
                className="flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium"
                style={{ borderColor: "var(--violation)", background: "var(--violation-bg)", color: "var(--violation)" }}
              >
                <AlertOctagonIcon size={15} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-accent py-3.5 text-sm font-display font-bold uppercase tracking-wide text-accent-text active:scale-[0.98] transition-transform disabled:opacity-60 shadow-md hover:brightness-105"
            >
              {submitting ? "Authenticating Session…" : "Enter Surveillance Terminal"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-text-faint">
            Authorised for State Directorate of Geology & Mining (DGM) & Field Enforcers under MMDR Act 1957.
          </p>
        </div>
      </div>
    </div>
  );
}

