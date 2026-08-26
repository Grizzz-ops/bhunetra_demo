import type { AlertFeature, Site } from "@/lib/types";
import { SiteCard } from "./SiteCard";
import { rankSites, siteEarliestDeadline } from "@/lib/rank";

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
  const ranked = rankSites(sites, alertsBySite);

  if (ranked.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-text-muted">
        No clustered sites yet. Run the clustering job to group detections into sites.
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3">
      {ranked.map((site) => {
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
