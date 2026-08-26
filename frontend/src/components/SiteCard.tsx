import type { Site } from "@/lib/types";
import { LegalityBadge } from "./LegalityBadge";
import { SlaCountdown } from "./SlaCountdown";
import { formatArea } from "@/lib/format";
import { ChevronRightIcon } from "./icons";

export function SiteCard({
  site,
  earliestDeadline,
  earliestStatus,
  selected,
  onClick,
}: {
  site: Site;
  earliestDeadline: string | null;
  earliestStatus: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-3.5 transition-colors active:scale-[0.99] ${
        selected ? "border-accent bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))]" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display font-bold text-base text-text truncate">
            Site {String(site.cluster_id).padStart(2, "0")}
          </div>
          <div className="text-xs text-text-muted mt-0.5">
            {site.member_count} detection{site.member_count === 1 ? "" : "s"} &middot;{" "}
            {formatArea(site.total_disturbance_area_m2)}
          </div>
        </div>
        <ChevronRightIcon size={18} className="text-text-faint mt-0.5 shrink-0" />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <LegalityBadge flag={site.legality_flag} size="sm" />
        {earliestDeadline && (
          <SlaCountdown deadline={earliestDeadline} status={earliestStatus} size="sm" />
        )}
      </div>
    </button>
  );
}
