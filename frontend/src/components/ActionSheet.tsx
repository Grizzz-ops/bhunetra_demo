"use client";

import { useState } from "react";
import type { AlertStatus } from "@/lib/types";
import { AlertOctagonIcon, CheckCircleIcon, AlertTriangleIcon, RefreshIcon } from "./icons";

const RESOLVE_REASONS = [
  "No violation found on review",
  "Site is licensed / already known",
  "False detection (cloud, farming, shadow)",
  "Addressed on-site by officer",
];

const ESCALATE_REASONS = [
  "Needs DGM review",
  "Suspected large-scale violation",
  "Site access restricted",
  "Legal status ambiguous",
];

type Mode = "resolve" | "escalate" | null;

export function ActionSheet({
  status,
  onSubmit,
}: {
  status: AlertStatus;
  onSubmit: (newStatus: AlertStatus, notes: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [extra, setExtra] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "RESOLVED") {
    return (
      <div
        className="flex items-center gap-2 rounded-lg border px-3.5 py-3 text-sm font-display font-semibold uppercase tracking-wide"
        style={{ borderColor: "var(--compliant)", color: "var(--compliant)", background: "var(--compliant-bg)" }}
      >
        <CheckCircleIcon size={16} />
        Resolved
      </div>
    );
  }

  const reasons = mode === "resolve" ? RESOLVE_REASONS : ESCALATE_REASONS;
  const targetStatus: AlertStatus = mode === "resolve" ? "RESOLVED" : "ESCALATED_DGM";

  async function handleSubmit() {
    if (!reason) return;
    setPending(true);
    setError(null);
    try {
      const notes = extra.trim() ? `${reason} — ${extra.trim()}` : reason;
      await onSubmit(targetStatus, notes);
      setMode(null);
      setReason(null);
      setExtra("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (!mode) {
    return (
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => setMode("resolve")}
          className="flex items-center justify-center gap-2 rounded-lg py-4 text-sm font-display font-bold uppercase tracking-wide active:scale-[0.97] transition-transform"
          style={{ background: "var(--compliant-bg)", color: "var(--compliant)" }}
        >
          <CheckCircleIcon size={17} />
          Resolve
        </button>
        <button
          onClick={() => setMode("escalate")}
          className="flex items-center justify-center gap-2 rounded-lg py-4 text-sm font-display font-bold uppercase tracking-wide active:scale-[0.97] transition-transform"
          style={{ background: "var(--violation-bg)", color: "var(--violation)" }}
        >
          <AlertTriangleIcon size={17} />
          Escalate to DGM
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-display font-semibold text-sm uppercase tracking-wide text-text">
          {mode === "resolve" ? "Resolve — pick a reason" : "Escalate — pick a reason"}
        </span>
        <button onClick={() => setMode(null)} className="text-xs text-text-muted underline">
          Cancel
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {reasons.map((r) => (
          <button
            key={r}
            onClick={() => setReason(r)}
            className={`text-left rounded-lg border px-3.5 py-3 text-sm transition-colors ${
              reason === r ? "border-accent bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface))] text-text" : "border-border text-text-muted"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={extra}
        onChange={(e) => setExtra(e.target.value)}
        placeholder="Add detail (optional)"
        className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
      />

      {error && (
        <div
          className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs"
          style={{ borderColor: "var(--violation)", background: "var(--violation-bg)", color: "var(--violation)" }}
        >
          <AlertOctagonIcon size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!reason || pending}
        className="w-full rounded-lg bg-accent py-3.5 text-sm font-display font-bold uppercase tracking-wide text-accent-text active:scale-[0.98] transition-transform disabled:opacity-50"
      >
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <RefreshIcon size={15} className="animate-spin" />
            Submitting…
          </span>
        ) : mode === "resolve" ? (
          "Confirm resolve"
        ) : (
          "Confirm escalation"
        )}
      </button>
    </div>
  );
}
