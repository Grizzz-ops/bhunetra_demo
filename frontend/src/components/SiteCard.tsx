import type { Site } from "@/lib/types";
import { LegalityBadge } from "./LegalityBadge";
import { SlaCountdown } from "./SlaCountdown";
import { formatArea } from "@/lib/format";
import { formatCoordinates } from "@/lib/geo";
import { ChevronRightIcon, CrosshairIcon } from "./icons";

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
      className={`w-full text-left rounded-xl border p-3.5 transition-all active:scale-[0.99] shadow-xs ${
        selected ? "border-accent bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))]" : "border-border bg-surface hover:border-border/80"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display font-bold text-base text-text truncate">
            Site {String(site.cluster_id).padStart(2, "0")}
          </div>

          <div className="text-xs text-text-muted mt-0.5">
            {site.member_count} trigger{site.member_count === 1 ? "" : "s"} &middot;{" "}
            {formatArea(site.total_disturbance_area_m2)}
          </div>

          <div className="flex items-center gap-1 text-[11px] font-display text-text-faint mt-1">
            <CrosshairIcon size={11} className="text-accent" />
            <span>{formatCoordinates(site.centroid.lat, site.centroid.lon, 4)}</span>
          </div>
        </div>
        <ChevronRightIcon size={18} className="text-text-faint mt-0.5 shrink-0" />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40">
        <LegalityBadge flag={site.legality_flag} size="sm" />
        {earliestDeadline && (
          <SlaCountdown deadline={earliestDeadline} status={earliestStatus} size="sm" />
        )}
      </div>
    </button>
  );
}

