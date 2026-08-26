"use client";

import { useState } from "react";
import type { AlertFeature, AlertStatus, AuditLogEntry } from "@/lib/types";
import { LegalityBadge } from "./LegalityBadge";
import { SlaCountdown } from "./SlaCountdown";
import { LegalityChecklist } from "./LegalityChecklist";
import { BriefSection } from "./BriefSection";
import { ActionSheet } from "./ActionSheet";
import { ImageryViewer } from "./ImageryViewer";
import { AuditTrail } from "./AuditTrail";
import { formatArea, formatPercent, formatScore } from "@/lib/format";
import { formatCoordinates, polygonCentroid, copyCoordinatesToClipboard, getGoogleMapsUrl } from "@/lib/geo";
import { ChevronLeftIcon, CopyIcon, CheckIcon, ExternalLinkIcon, CrosshairIcon, XIcon } from "./icons";

export function AlertPanel({
  alert,
  auditLogs = [],
  onBack,
  onGenerateBrief,
  onSubmitAction,
}: {
  alert: AlertFeature;
  auditLogs?: AuditLogEntry[];
  onBack: () => void;
  onGenerateBrief: () => Promise<{ cached: boolean }>;
  onSubmitAction: (newStatus: AlertStatus, notes: string) => Promise<void>;
}) {
  const p = alert.properties;
  const [lat, lon] = polygonCentroid(alert.geometry);
  const [copied, setCopied] = useState(false);

  async function handleCopyCoords() {
    const ok = await copyCoordinatesToClipboard(lat, lon);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2.5 shrink-0 border-b border-border bg-surface">
        <button
          onClick={onBack}
          className="grid h-8 w-8 place-items-center rounded-lg border border-border text-text-muted hover:text-text active:scale-95 transition-transform"
          aria-label="Back"
          title="Back / Close"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-display uppercase tracking-wide text-text-faint truncate">
            {p.trigger_id ?? `Alert #${p.id}`} &middot; {p.site_id ?? "AOI-07"}
          </div>
          <div className="font-display font-bold text-base text-text truncate">
            {p.location_name}
          </div>
        </div>
        <button
          onClick={onBack}
          className="grid h-8 w-8 place-items-center rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface-raised active:scale-95 transition-all"
          title="Close details"
          aria-label="Close"
        >
          <XIcon size={16} />
        </button>
      </div>


      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-4 min-h-0">
        {/* Status badges & SLA */}
        <div className="flex flex-wrap items-center gap-1.5">
          <LegalityBadge flag={p.legality_flag} />
          <SlaCountdown deadline={p.sla_deadline} status={p.status} />
        </div>

        {/* Prominent Coordinates Bar */}
        <div className="rounded-xl border border-border bg-surface p-3 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-md bg-accent/10 text-accent shrink-0">
              <CrosshairIcon size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-display uppercase font-semibold text-text-faint">
                GPS / Geospatial Center
              </div>
              <div className="font-display font-bold text-xs text-text truncate">
                {formatCoordinates(lat, lon, 5)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleCopyCoords}
              className="flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-bg text-[11px] font-display text-text hover:border-accent transition-colors"
              title="Copy latitude & longitude"
            >
              {copied ? (
                <>
                  <CheckIcon size={12} className="text-green-500" />
                  <span className="text-green-500 font-bold">Copied</span>
                </>
              ) : (
                <>
                  <CopyIcon size={12} />
                  <span>Copy</span>
                </>
              )}
            </button>
            <a
              href={getGoogleMapsUrl(lat, lon)}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-md border border-border bg-bg text-text-muted hover:text-accent transition-colors"
              title="Open in Google Maps"
            >
              <ExternalLinkIcon size={13} />
            </a>
          </div>
        </div>

        {/* Multi-Sensor Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Stat label="Confidence" value={p.confidence_tier ?? "—"} sub={formatScore(p.confidence_score)} />
          <Stat label="NDVI Drop" value={`-${formatPercent(p.change_pct)}`} sub="Optical canopy loss" />
          <Stat label="Nightlight Δ" value={p.ntl_delta != null ? `+${p.ntl_delta.toFixed(2)} nW` : "—"} sub="VIIRS radiance" />
          <Stat label="SAR Change" value={p.sar_change_score != null ? `${p.sar_change_score.toFixed(2)} dB` : "—"} sub="Radar backscatter" />
          <Stat label="Disturbance" value={formatArea(p.disturbance_area_m2)} sub="Surface footprint" />
          <Stat label="Boundary" value={(p.boundary_status ?? "—").replace(/_/g, " ")} sub="Lease check" />
        </div>

        {/* Multi-Spectral Satellite Imagery Viewer */}
        <section>
          <ImageryViewer
            triggerId={p.trigger_id}
            changePct={p.change_pct}
            ntlDelta={p.ntl_delta}
            sarScore={p.sar_change_score}
          />
        </section>

        {/* Legality Checklist */}
        <section>
          <h3 className="font-display font-semibold text-xs uppercase tracking-wide text-text-muted mb-2">
            Legality Breakdown (Real vs Mock)
          </h3>
          <LegalityChecklist assessment={p.legality_assessment} />
        </section>

        {/* AI Brief Section */}
        <section>
          <BriefSection
            briefText={p.brief_text}
            briefGeneratedAt={p.brief_generated_at}
            onGenerate={onGenerateBrief}
          />
        </section>

        {/* Audit & Action Trail */}
        <section>
          <AuditTrail alertId={p.id} logs={auditLogs} />
        </section>
      </div>

      {/* Pinned Officer Action Sheet */}
      <div className="shrink-0 border-t border-border bg-surface px-3.5 py-3 max-h-[50%] overflow-y-auto">
        <h3 className="font-display font-semibold text-xs uppercase tracking-wide text-text-muted mb-2">
          Officer Enforcement Action
        </h3>
        <ActionSheet status={p.status} onSubmit={onSubmitAction} />
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-2.5 py-2">
      <div className="text-[10px] font-display font-semibold uppercase tracking-wide text-text-faint truncate">
        {label}
      </div>
      <div className="font-display font-bold text-xs text-text mt-0.5 truncate">{value}</div>
      {sub && <div className="text-[10px] text-text-muted truncate">{sub}</div>}
    </div>
  );
}
