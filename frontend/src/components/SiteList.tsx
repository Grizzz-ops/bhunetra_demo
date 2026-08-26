import type { AlertFeature, Site } from "@/lib/types";
import { SiteCard } from "./SiteCard";
import { siteEarliestDeadline } from "@/lib/rank";


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
    <div className="space-y-2 p-3">
      <div className="px-1 pb-1 flex items-center justify-between text-xs font-display text-text-muted">
        <span className="font-semibold text-text">{sortedSites.length} Mine Site Clusters</span>
        <span className="text-[11px] text-text-faint">{totalTriggers} Total Triggers</span>
      </div>

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
  );
}

