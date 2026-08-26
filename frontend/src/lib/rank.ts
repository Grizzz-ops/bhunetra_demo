import type { AlertFeature, Site } from "./types";

const LEGALITY_RANK: Record<string, number> = {
  POTENTIAL_VIOLATION: 0,
  INSUFFICIENT_DATA: 1,
  APPEARS_COMPLIANT: 2,
};

/** Earliest still-pending SLA deadline among a site's member alerts, or
 * null if every member is already resolved/escalated. */
export function siteEarliestDeadline(members: AlertFeature[]): string | null {
  const pending = members.filter((m) => m.properties.status === "PENDING_OFFICER");
  if (pending.length === 0) return null;
  return pending.reduce((earliest, m) =>
    new Date(m.properties.sla_deadline) < new Date(earliest.properties.sla_deadline) ? m : earliest
  ).properties.sla_deadline;
}

/** Sites first: rank by legality severity, then by SLA urgency (soonest
 * deadline first), so the top of the list is always "what needs me now." */
export function rankSites(sites: Site[], alertsBySite: Map<number, AlertFeature[]>): Site[] {
  return [...sites].sort((a, b) => {
    const legalityDiff = (LEGALITY_RANK[a.legality_flag] ?? 1) - (LEGALITY_RANK[b.legality_flag] ?? 1);
    if (legalityDiff !== 0) return legalityDiff;

    const deadlineA = siteEarliestDeadline(alertsBySite.get(a.cluster_id) ?? []);
    const deadlineB = siteEarliestDeadline(alertsBySite.get(b.cluster_id) ?? []);
    if (deadlineA && deadlineB) return new Date(deadlineA).getTime() - new Date(deadlineB).getTime();
    if (deadlineA) return -1;
    if (deadlineB) return 1;
    return b.member_count - a.member_count;
  });
}
