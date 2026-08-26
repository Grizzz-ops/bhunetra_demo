import type { AlertFeature, AlertStatus } from "@/lib/types";
import { LegalityBadge } from "./LegalityBadge";
import { SlaCountdown } from "./SlaCountdown";
import { LegalityChecklist } from "./LegalityChecklist";
import { BriefSection } from "./BriefSection";
import { ActionSheet } from "./ActionSheet";
import { formatArea, formatPercent, formatScore } from "@/lib/format";
import { ChevronLeftIcon } from "./icons";

export function AlertPanel({
  alert,
  onBack,
  onGenerateBrief,
  onSubmitAction,
}: {
  alert: AlertFeature;
  onBack: () => void;
  onGenerateBrief: () => Promise<{ cached: boolean }>;
  onSubmitAction: (newStatus: AlertStatus, notes: string) => Promise<void>;
}) {
  const p = alert.properties;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2 shrink-0">
        <button
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border text-text-muted active:scale-95 transition-transform"
          aria-label="Back to site"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <div className="min-w-0">
          <div className="text-[11px] font-display uppercase tracking-wide text-text-faint">
            {p.trigger_id ?? `Alert #${p.id}`}
          </div>
          <div className="font-display font-bold text-base text-text truncate">
            {p.location_name}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 pb-3 space-y-4 min-h-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <LegalityBadge flag={p.legality_flag} />
          <SlaCountdown deadline={p.sla_deadline} status={p.status} />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Stat label="Confidence" value={p.confidence_tier ?? "—"} sub={formatScore(p.confidence_score)} />
          <Stat label="Change" value={formatPercent(p.change_pct)} sub="NDVI drop" />
          <Stat label="Disturbance" value={formatArea(p.disturbance_area_m2)} sub="area" />
          <Stat label="Boundary" value={(p.boundary_status ?? "—").replace(/_/g, " ")} sub="vs lease" />
        </div>

        <section>
          <h3 className="font-display font-semibold text-xs uppercase tracking-wide text-text-muted mb-2">
            Legality breakdown
          </h3>
          <LegalityChecklist assessment={p.legality_assessment} />
        </section>

        <section>
          <BriefSection
            briefText={p.brief_text}
            briefGeneratedAt={p.brief_generated_at}
            onGenerate={onGenerateBrief}
          />
        </section>
      </div>

      {/* Pinned, not scrolled away -- the primary action must stay
          thumb-reachable without hunting for it in a long detail view. */}
      <div className="shrink-0 border-t border-border bg-bg px-3.5 py-3 max-h-[55%] overflow-y-auto">
        <h3 className="font-display font-semibold text-xs uppercase tracking-wide text-text-muted mb-2">
          Officer action
        </h3>
        <ActionSheet status={p.status} onSubmit={onSubmitAction} />
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="text-[10px] font-display font-semibold uppercase tracking-wide text-text-faint">
        {label}
      </div>
      <div className="font-display font-bold text-sm text-text mt-0.5 truncate">{value}</div>
      {sub && <div className="text-[11px] text-text-muted truncate">{sub}</div>}
    </div>
  );
}
