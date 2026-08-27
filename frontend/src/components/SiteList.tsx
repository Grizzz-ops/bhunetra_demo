import Link from "next/link";
import type { AlertFeature, Site } from "@/lib/types";
import { SiteCard } from "./SiteCard";
import { siteEarliestDeadline } from "@/lib/rank";
import { InfoIcon, ChevronRightIcon } from "./icons";

export function SiteList({
  sites,
  alertsBySite,
  selectedSiteId,
  onSelectSite,
}: {
  sites: Site[];
  alertsBySite: Map<number, AlertFeature[]>;
  selectedSiteId: number | null;
  onSelectSite: (id: number) => void;
}) {
  const sortedSites = [...sites].sort((a, b) => a.cluster_id - b.cluster_id);

  if (sortedSites.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-text-muted">
        No clustered sites yet. Run the clustering job to group detections into sites.
      </div>
    );
  }

  const totalTriggers = sortedSites.reduce((sum, s) => sum + (alertsBySite.get(s.cluster_id)?.length ?? 0), 0);

  return (
    <div className="space-y-2.5 p-3 flex flex-col h-full overflow-y-auto">
      <div className="px-1 pb-0.5 flex items-center justify-between text-xs font-display text-text-muted shrink-0">
        <span className="font-semibold text-text">{sortedSites.length} Mine Site Clusters</span>
        <span className="text-[11px] text-text-faint">{totalTriggers} Total Triggers</span>
      </div>

      <div className="space-y-2 flex-1 min-h-0">
        {sortedSites.map((site) => {
          const members = alertsBySite.get(site.cluster_id) ?? [];
          const deadline = siteEarliestDeadline(members);
          return (
            <SiteCard
              key={site.cluster_id}
              site={site}
              earliestDeadline={deadline}
              earliestStatus="PENDING_OFFICER"
              selected={site.cluster_id === selectedSiteId}
              onClick={() => onSelectSite(site.cluster_id)}
            />
          );
        })}
      </div>

      {/* Integrated About Page Button on Side */}
      <div className="pt-2 border-t border-border mt-auto shrink-0">
        <Link
          href="/about"
          className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface hover:border-accent hover:bg-surface-raised active:scale-[0.98] transition-all group shadow-xs"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <InfoIcon size={16} />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-xs text-text group-hover:text-accent transition-colors flex items-center gap-1.5">
                <span>About BhuNetra</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-accent/15 text-accent font-semibold">Docs</span>
              </div>
              <div className="text-[11px] text-text-muted truncate">
                Spaceborne Sensors & Mission Architecture
              </div>
            </div>
          </div>
          <div className="text-text-muted group-hover:text-accent transition-colors shrink-0 ml-2">
            <ChevronRightIcon size={16} />
          </div>
        </Link>
      </div>
    </div>
  );
}


