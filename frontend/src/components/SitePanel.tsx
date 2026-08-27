"use client";

import { useState } from "react";
import type { AlertFeature, Site } from "@/lib/types";
import { LegalityBadge } from "./LegalityBadge";
import { SlaCountdown } from "./SlaCountdown";
import { formatArea, formatScore } from "@/lib/format";
import { formatCoordinates, polygonCentroid, copyCoordinatesToClipboard, getGoogleMapsUrl } from "@/lib/geo";
import { ChevronLeftIcon, ChevronRightIcon, CopyIcon, CheckIcon, ExternalLinkIcon, CrosshairIcon } from "./icons";

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
  const [copied, setCopied] = useState(false);

  const sorted = [...members].sort((a, b) => {
    const order: Record<string, number> = { PENDING_OFFICER: 0, ESCALATED_DGM: 1, RESOLVED: 2 };
    return (order[a.properties.status] ?? 0) - (order[b.properties.status] ?? 0);
  });

  async function handleCopySiteCoords() {
    const ok = await copyCoordinatesToClipboard(site.centroid.lat, site.centroid.lon);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2 shrink-0 border-b border-border bg-surface">
        <button
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border text-text-muted hover:text-text active:scale-95 transition-transform"
          aria-label="Back to all sites"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-display uppercase tracking-wide text-text-faint">
            Site {String(site.cluster_id).padStart(2, "0")}
          </div>

          <div className="font-display font-bold text-base text-text truncate">
            {site.member_count} trigger{site.member_count === 1 ? "" : "s"} &middot;{" "}
            {formatArea(site.total_disturbance_area_m2)}
          </div>

        </div>
      </div>

      <div className="p-3.5 space-y-3 shrink-0">
        <LegalityBadge flag={site.legality_flag} />

        {/* Site Centroid Coordinates Card */}
        <div className="rounded-xl border border-border bg-surface p-3 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-md bg-accent/10 text-accent shrink-0">
              <CrosshairIcon size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-display uppercase font-semibold text-text-faint">
                Cluster Center Coordinates
              </div>
              <div className="font-display font-bold text-xs text-text truncate">
                {formatCoordinates(site.centroid.lat, site.centroid.lon, 4)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleCopySiteCoords}
              className="p-1.5 rounded-md border border-border bg-bg text-text-muted hover:text-text transition-colors"
              title="Copy cluster centroid coordinates"
            >
              {copied ? <CheckIcon size={13} className="text-green-500" /> : <CopyIcon size={13} />}
            </button>
            <a
              href={getGoogleMapsUrl(site.centroid.lat, site.centroid.lon)}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-md border border-border bg-bg text-text-muted hover:text-accent transition-colors"
              title="Open in Google Maps"
            >
              <ExternalLinkIcon size={13} />
            </a>
          </div>
        </div>
      </div>

      {/* Detections / Triggers in this site */}
      <div className="px-3.5 pb-2 text-[11px] font-display font-semibold uppercase tracking-wider text-text-muted shrink-0">
        Member Detections & Triggers ({members.length})
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 pb-6 space-y-2.5 min-h-0">
        {sorted.map((alert) => {
          const p = alert.properties;
          const [lat, lon] = polygonCentroid(alert.geometry);

          return (
            <button
              key={p.id}
              onClick={() => onSelectAlert(p.id)}
              className="w-full text-left rounded-xl border border-border bg-surface p-3.5 hover:border-accent/60 active:scale-[0.99] transition-all shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-display font-bold text-text truncate">
                    {p.trigger_id ?? `Alert #${p.id}`}
                  </div>
                  <div className="text-[11px] font-display text-text-muted mt-0.5">
                    {formatCoordinates(lat, lon, 4)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display font-bold text-xs text-text">
                    {formatArea(p.disturbance_area_m2)}
                  </div>
                  <div className="text-[10px] font-display text-text-faint">
                    Risk: {formatScore(p.risk_score, 1)}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  <LegalityBadge flag={p.legality_flag} size="sm" />
                  <SlaCountdown deadline={p.sla_deadline} status={p.status} size="sm" />
                </div>
                <ChevronRightIcon size={15} className="text-text-faint shrink-0" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
