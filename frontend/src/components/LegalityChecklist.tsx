import type { LegalityAssessment, LegalityCheck } from "@/lib/types";
import { checkLabel } from "@/lib/format";
import { DataSourceTag } from "./LegalityBadge";

function isCheck(v: unknown): v is LegalityCheck {
  return !!v && typeof v === "object" && "value" in v && "data_source" in v;
}

export function LegalityChecklist({ assessment }: { assessment: LegalityAssessment | null }) {
  if (!assessment) {
    return (
      <p className="text-sm text-text-muted">
        No legality assessment recorded for this alert.
      </p>
    );
  }

  const entries = Object.entries(assessment).filter(([, v]) => isCheck(v)) as [string, LegalityCheck][];

  if (entries.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        No legality assessment recorded for this alert.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {entries.map(([key, check]) => (
        <li
          key={key}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"
        >
          <div className="min-w-0">
            <div className="text-xs font-display font-semibold uppercase tracking-wide text-text-muted">
              {checkLabel(key)}
            </div>
            <div className="text-sm text-text mt-0.5 truncate">
              {check.value.replace(/_/g, " ")}
            </div>
          </div>
          <DataSourceTag source={check.data_source} />
        </li>
      ))}
    </ul>
  );
}
