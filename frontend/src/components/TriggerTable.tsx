"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AlertFeature } from "@/lib/types";
import { formatArea, formatPercent, formatScore, legalityMeta } from "@/lib/format";
import { formatCoordinates, polygonCentroid, copyCoordinatesToClipboard, getGoogleMapsUrl } from "@/lib/geo";
import { LegalityBadge } from "./LegalityBadge";
import { SlaCountdown } from "./SlaCountdown";
import {
  SearchIcon,
  CopyIcon,
  CheckIcon,
  ExternalLinkIcon,
  ChevronRightIcon,
  InfoIcon,
} from "./icons";


type SortField = "risk" | "area" | "change" | "id";

export function TriggerTable({
  alerts,
  selectedAlertId,
  onSelectAlert,
}: {
  alerts: AlertFeature[];
  selectedAlertId: number | null;
  onSelectAlert: (id: number) => void;
  onOpenMap?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [legalityFilter, setLegalityFilter] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortField>("risk");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  async function handleCopyCoords(e: React.MouseEvent, alertId: number, lat: number, lon: number) {
    e.stopPropagation();
    const success = await copyCoordinatesToClipboard(lat, lon);
    if (success) {
      setCopiedId(alertId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  const processedList = useMemo(() => {
    return alerts
      .filter((a) => {
        const p = a.properties;
        const matchSearch =
          !search.trim() ||
          (p.trigger_id && p.trigger_id.toLowerCase().includes(search.toLowerCase())) ||
          (p.location_name && p.location_name.toLowerCase().includes(search.toLowerCase())) ||
          (p.site_id && p.site_id.toLowerCase().includes(search.toLowerCase()));

        const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
        const matchLegality = legalityFilter === "ALL" || p.legality_flag === legalityFilter;

        return matchSearch && matchStatus && matchLegality;
      })
      .sort((a, b) => {
        const pA = a.properties;
        const pB = b.properties;
        let diff = 0;
        if (sortBy === "risk") diff = (pB.risk_score ?? 0) - (pA.risk_score ?? 0);
        else if (sortBy === "area") diff = (pB.disturbance_area_m2 ?? 0) - (pA.disturbance_area_m2 ?? 0);
        else if (sortBy === "change") diff = (pB.change_pct ?? 0) - (pA.change_pct ?? 0);
        else diff = (pB.id ?? 0) - (pA.id ?? 0);
        return sortOrder === "desc" ? diff : -diff;
      });
  }, [alerts, search, statusFilter, legalityFilter, sortBy, sortOrder]);

  const totalArea = useMemo(() => {
    return alerts.reduce((acc, a) => acc + (a.properties.disturbance_area_m2 ?? 0), 0);
  }, [alerts]);

  const violationsCount = useMemo(() => {
    return alerts.filter((a) => a.properties.legality_flag === "POTENTIAL_VIOLATION").length;
  }, [alerts]);

  const compliantCount = useMemo(() => {
    return alerts.filter((a) => a.properties.legality_flag === "APPEARS_COMPLIANT").length;
  }, [alerts]);

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Top Metrics Strip */}
      <div className="p-3.5 border-b border-border bg-surface grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
        <div className="p-2.5 rounded-lg border border-border bg-surface-raised">
          <div className="text-[10px] font-display uppercase tracking-wider text-text-faint">
            Total Multi-Sensor Triggers
          </div>
          <div className="font-display font-bold text-lg text-text mt-0.5">
            {alerts.length}
          </div>
        </div>
        <div className="p-2.5 rounded-lg border border-border bg-surface-raised">
          <div className="text-[10px] font-display uppercase tracking-wider text-text-faint">
            Encroachments (Violations)
          </div>
          <div className="font-display font-bold text-lg text-[var(--violation)] mt-0.5">
            {violationsCount}
          </div>
        </div>
        <div className="p-2.5 rounded-lg border border-border bg-surface-raised">
          <div className="text-[10px] font-display uppercase tracking-wider text-text-faint">
            Compliant Operations
          </div>
          <div className="font-display font-bold text-lg text-[var(--compliant)] mt-0.5">
            {compliantCount}
          </div>
        </div>
        <div className="p-2.5 rounded-lg border border-border bg-surface-raised">
          <div className="text-[10px] font-display uppercase tracking-wider text-text-faint">
            Total Disturbance
          </div>
          <div className="font-display font-bold text-lg text-text mt-0.5">
            {formatArea(totalArea)}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3 border-b border-border bg-surface/60 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex-1 min-w-[200px] relative">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search triggers by ID, AOI location..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-bg text-xs text-text outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filters */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-[11px] font-display text-text-muted">Status:</span>
            {["ALL", "PENDING_OFFICER", "ESCALATED_DGM", "RESOLVED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-1 rounded text-[10px] font-display uppercase transition-colors ${
                  statusFilter === st
                    ? "bg-accent text-accent-text font-bold"
                    : "bg-surface border border-border text-text-muted hover:text-text"
                }`}
              >
                {st === "ALL" ? "All" : st === "PENDING_OFFICER" ? "Pending" : st === "ESCALATED_DGM" ? "Escalated" : "Resolved"}
              </button>
            ))}
          </div>

          {/* Legality Filters */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-[11px] font-display text-text-muted">Legality:</span>
            <button
              onClick={() => setLegalityFilter("ALL")}
              className={`px-2.5 py-1 rounded text-[10px] font-display uppercase transition-colors ${
                legalityFilter === "ALL"
                  ? "bg-accent text-accent-text font-bold"
                  : "bg-surface border border-border text-text-muted hover:text-text"
              }`}
            >
              All MSS ({alerts.length})
            </button>
            <button
              onClick={() => setLegalityFilter("POTENTIAL_VIOLATION")}
              className={`px-2.5 py-1 rounded text-[10px] font-display uppercase transition-colors ${
                legalityFilter === "POTENTIAL_VIOLATION"
                  ? "bg-accent text-accent-text font-bold"
                  : "bg-surface border border-border text-text-muted hover:text-text"
              }`}
            >
              Violations ({violationsCount})
            </button>
            <button
              onClick={() => setLegalityFilter("APPEARS_COMPLIANT")}
              className={`px-2.5 py-1 rounded text-[10px] font-display uppercase transition-colors ${
                legalityFilter === "APPEARS_COMPLIANT"
                  ? "bg-accent text-accent-text font-bold"
                  : "bg-surface border border-border text-text-muted hover:text-text"
              }`}
            >
              Compliant ({compliantCount})
            </button>
          </div>

          <div className="flex items-center gap-1 text-xs ml-1">
            <span className="text-[11px] font-display text-text-muted">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="bg-surface border border-border rounded px-2 py-1 text-xs font-display text-text outline-none"
            >
              <option value="risk">Risk Score</option>
              <option value="area">Disturbance Area</option>
              <option value="change">NDVI Drop %</option>
              <option value="id">Trigger ID</option>
            </select>
            <button
              onClick={() => setSortOrder((o) => (o === "desc" ? "asc" : "desc"))}
              className="px-2 py-1 rounded border border-border bg-surface text-[11px] font-display text-text hover:border-accent"
              title="Toggle sort order"
            >
              {sortOrder === "desc" ? "↓ Desc" : "↑ Asc"}
            </button>

            <Link
              href="/about"
              className="px-2.5 py-1 rounded border border-border bg-surface text-[11px] font-display font-semibold text-text hover:border-accent hover:text-accent flex items-center gap-1 transition-colors ml-1"
              title="About BhuNetra Spaceborne Surveillance Architecture & Docs"
            >
              <InfoIcon size={13} className="text-accent" />
              <span>About Docs</span>
            </Link>
          </div>
        </div>
      </div>



      {/* Table Container */}
      <div className="flex-1 overflow-auto min-h-0">
        <div className="pb-36 min-w-full">
          <table className="w-full text-left text-xs border-collapse min-w-[880px]">
            <thead className="sticky top-0 bg-surface-raised border-b border-border text-[11px] font-display uppercase tracking-wider text-text-muted z-10">
              <tr>
                <th className="py-2.5 px-2.5 font-semibold text-center w-10">#</th>
                <th className="py-2.5 px-3 font-semibold">Trigger ID</th>
                <th className="py-2.5 px-2.5 font-semibold">Precise Coordinates</th>
                <th className="py-2.5 px-2.5 font-semibold">Risk & Tier</th>
                <th className="py-2.5 px-2.5 font-semibold">NDVI Loss</th>
                <th className="py-2.5 px-2.5 font-semibold">Nightlights (NTL)</th>
                <th className="py-2.5 px-2.5 font-semibold">SAR dB Delta</th>
                <th className="py-2.5 px-2.5 font-semibold">Disturbance</th>
                <th className="py-2.5 px-2.5 font-semibold">Legality</th>
                <th className="py-2.5 px-2.5 font-semibold">SLA / Status</th>
                <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border/50">

            {processedList.map((alert, index) => {
              const p = alert.properties;
              const isSelected = p.id === selectedAlertId;
              const [lat, lon] = polygonCentroid(alert.geometry);
              const meta = legalityMeta(p.legality_flag);

              return (
                <tr
                  key={p.id}
                  onClick={() => onSelectAlert(p.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface))] font-medium"
                      : "hover:bg-surface-raised/80 bg-surface"
                  }`}
                >
                  {/* Row Number */}
                  <td className="py-3 px-2.5 text-center font-display text-[11px] text-text-faint w-10">
                    {index + 1}
                  </td>

                  {/* Trigger ID */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: meta.color }}
                      />
                      <div>
                        <div className="font-display font-bold text-text">
                          {p.trigger_id ?? `Alert #${p.id}`}
                        </div>
                        <div className="text-[11px] text-text-muted truncate max-w-[140px]">
                          {p.location_name}
                        </div>
                      </div>
                    </div>
                  </td>


                  {/* Coordinates & Copy Tool */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 font-display text-[11px] text-text">
                      <span>{formatCoordinates(lat, lon, 4)}</span>
                      <button
                        onClick={(e) => handleCopyCoords(e, p.id, lat, lon)}
                        className="p-1 rounded hover:bg-bg text-text-muted hover:text-text transition-colors"
                        title="Copy Lat, Lon coordinates"
                      >
                        {copiedId === p.id ? (
                          <CheckIcon size={12} className="text-green-500" />
                        ) : (
                          <CopyIcon size={12} />
                        )}
                      </button>
                      <a
                        href={getGoogleMapsUrl(lat, lon)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded hover:bg-bg text-text-muted hover:text-accent transition-colors"
                        title="Open in Google Maps"
                      >
                        <ExternalLinkIcon size={12} />
                      </a>
                    </div>
                  </td>

                  {/* Risk Score */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="font-display font-bold text-text">
                      {formatScore(p.risk_score, 1)}
                    </div>
                    <div className="text-[10px] font-display uppercase tracking-wide text-text-faint">
                      {p.confidence_tier ?? "Watchlist"}
                    </div>
                  </td>

                  {/* NDVI Loss */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="font-display font-semibold text-red-500">
                      -{formatPercent(p.change_pct)}
                    </span>
                  </td>

                  {/* Nightlights NTL */}
                  <td className="py-3 px-3 whitespace-nowrap font-display text-[11px]">
                    {p.ntl_delta != null ? (
                      <span className="text-amber-500 font-semibold">
                        +{p.ntl_delta.toFixed(2)} nW
                      </span>
                    ) : (
                      <span className="text-text-faint">—</span>
                    )}
                  </td>

                  {/* SAR dB Delta */}
                  <td className="py-3 px-3 whitespace-nowrap font-display text-[11px]">
                    {p.sar_change_score != null ? (
                      <span className="text-blue-500 font-semibold">
                        {p.sar_change_score.toFixed(2)} dB
                      </span>
                    ) : (
                      <span className="text-text-faint">—</span>
                    )}
                  </td>

                  {/* Disturbance Area */}
                  <td className="py-3 px-3 whitespace-nowrap font-display text-text font-medium">
                    {formatArea(p.disturbance_area_m2)}
                  </td>

                  {/* Legality Badge */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <LegalityBadge flag={p.legality_flag} size="sm" />
                  </td>

                  {/* SLA / Status */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <SlaCountdown deadline={p.sla_deadline} status={p.status} size="sm" />
                  </td>

                  {/* Action Button */}
                  <td className="py-3 px-3.5 whitespace-nowrap text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAlert(p.id);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-surface text-xs font-display font-semibold text-text hover:border-accent transition-colors"
                    >
                      <span>Triage</span>
                      <ChevronRightIcon size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

