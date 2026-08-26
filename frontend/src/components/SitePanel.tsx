import type { AlertFeature, Site } from "@/lib/types";
import { LegalityBadge } from "./LegalityBadge";
import { SlaCountdown } from "./SlaCountdown";
import { formatArea } from "@/lib/format";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

export function SitePanel({
  site,
  members,
  onBack,
  onSelectAlert,
}: {
  site: Site;
  members: AlertFeature[];
  onBack: () => void;
  onSelectAlert: (id: number) => void;
}) {
  const sorted = [...members].sort((a, b) => {
    const order: Record<string, number> = { PENDING_OFFICER: 0, ESCALATED_DGM: 1, RESOLVED: 2 };
    return (order[a.properties.status] ?? 0) - (order[b.properties.status] ?? 0);
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2 shrink-0">
        <button
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border text-text-muted active:scale-95 transition-transform"
          aria-label="Back to all sites"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <div>
          <div className="text-[11px] font-display uppercase tracking-wide text-text-faint">
            Site {String(site.cluster_id).padStart(2, "0")}
          </div>
          <div className="font-display font-bold text-base text-text">
            {site.member_count} detection{site.member_count === 1 ? "" : "s"} &middot;{" "}
            {formatArea(site.total_disturbance_area_m2)}
          </div>
        </div>
      </div>

      <div className="px-3.5 pb-3 shrink-0">
        <LegalityBadge flag={site.legality_flag} />
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 pb-6 space-y-2">
        {sorted.map((alert) => {
          const p = alert.properties;
          return (
            <button
              key={p.id}
              onClick={() => onSelectAlert(p.id)}
              className="w-full text-left rounded-lg border border-border bg-surface p-3 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-display uppercase tracking-wide text-text-faint truncate">
                    {p.trigger_id ?? `Alert #${p.id}`}
                  </div>
                  <div className="text-sm text-text mt-0.5">{formatArea(p.disturbance_area_m2)}</div>
                </div>
                <ChevronRightIcon size={16} className="text-text-faint shrink-0" />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <LegalityBadge flag={p.legality_flag} size="sm" />
                <SlaCountdown deadline={p.sla_deadline} status={p.status} size="sm" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
