"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/format";
import { SparkleIcon, RefreshIcon, AlertOctagonIcon } from "./icons";

export function BriefSection({
  briefText,
  briefGeneratedAt,
  onGenerate,
}: {
  briefText: string | null;
  briefGeneratedAt: string | null;
  onGenerate: () => Promise<{ cached: boolean }>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      await onGenerate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate a briefing.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 font-display font-semibold text-xs uppercase tracking-wide text-text-muted">
          <SparkleIcon size={14} />
          Officer briefing
        </div>
        {briefGeneratedAt && (
          <span className="text-[11px] text-text-faint">{formatDateTime(briefGeneratedAt)}</span>
        )}
      </div>

      {briefText && (
        <p className="text-sm leading-relaxed text-text mb-3">{briefText}</p>
      )}

      {error && (
        <div
          className="flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs mb-3"
          style={{ borderColor: "var(--violation)", background: "var(--violation-bg)", color: "var(--violation)" }}
        >
          <AlertOctagonIcon size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleClick}
        disabled={pending}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border py-3 text-sm font-display font-semibold uppercase tracking-wide text-text active:scale-[0.98] transition-transform disabled:opacity-60"
      >
        {pending ? (
          <>
            <RefreshIcon size={15} className="animate-spin" />
            Generating…
          </>
        ) : briefText ? (
          <>
            <RefreshIcon size={15} />
            Regenerate brief
          </>
        ) : (
          <>
            <SparkleIcon size={15} />
            Generate brief
          </>
        )}
      </button>
    </div>
  );
}
