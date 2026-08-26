"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AlertOctagonIcon } from "@/components/icons";

export default function LoginPage() {
  const { session, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) router.replace("/dashboard");
  }, [loading, session, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <div className="flex-1 grid place-items-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="font-display text-3xl font-bold tracking-tight text-text">
              BHUNETRA
            </div>
            <div className="mt-1 text-sm text-text-muted">
              Field Command &middot; Mining Enforcement
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow)] space-y-4"
          >
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-display font-semibold uppercase tracking-wide text-text-muted">
                Officer email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3.5 py-3.5 text-base text-text outline-none focus:border-accent"
                placeholder="you@bhunetra.demo"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-display font-semibold uppercase tracking-wide text-text-muted">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3.5 py-3.5 text-base text-text outline-none focus:border-accent"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div
                className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm"
                style={{ borderColor: "var(--violation)", background: "var(--violation-bg)", color: "var(--violation)" }}
              >
                <AlertOctagonIcon size={16} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-accent py-3.5 text-base font-display font-bold uppercase tracking-wide text-accent-text active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-text-faint">
            Field officer or DGM/IBM HQ reviewer credentials only.
          </p>
        </div>
      </div>
    </div>
  );
}
