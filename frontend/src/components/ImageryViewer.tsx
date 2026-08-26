"use client";

import { useState } from "react";
import { SatelliteIcon, MaximizeIcon, XIcon } from "./icons";


export type SpectralBand = "ndvi" | "ntl" | "sar" | "monsoon" | "overlay" | "full";

interface ImageryDataset {
  id: SpectralBand;
  title: string;
  badge: string;
  badgeColor: string;
  sensor: string;
  resolution: string;
  description: string;
  beforeSrc?: string;
  afterSrc?: string;
  diffSrc?: string;
  compositeSrc?: string;
  hasComparison: boolean;
}

const DATASETS: Record<SpectralBand, ImageryDataset> = {
  ndvi: {
    id: "ndvi",
    title: "NDVI Vegetation Loss",
    badge: "Optical",
    badgeColor: "#1f7a4d",
    sensor: "Sentinel-2 MSI (Band 4 Red + Band 8 NIR)",
    resolution: "10m / px",
    description: "Normalized Difference Vegetation Index tracking vegetation canopy loss. Red patches indicate severe surface clearing and excavation.",
    beforeSrc: "/imagery/ndvi_before.png",
    afterSrc: "/imagery/ndvi_after.png",
    diffSrc: "/imagery/ndvi_diff.png",
    compositeSrc: "/imagery/ndvi_preview.png",
    hasComparison: true,
  },
  ntl: {
    id: "ntl",
    title: "Nighttime Lights (NTL)",
    badge: "Thermal / Radiance",
    badgeColor: "#b3720c",
    sensor: "VIIRS Day/Night Band (Black Marble)",
    resolution: "500m / px",
    description: "Nighttime radiance emissions indicating night-shift mining activity, generator banks, and heavy mineral transport outside permitted hours.",
    beforeSrc: "/imagery/ntl_before.png",
    afterSrc: "/imagery/ntl_after.png",
    diffSrc: "/imagery/ntl_diff.png",
    compositeSrc: "/imagery/ntl_diff.png",
    hasComparison: true,
  },
  sar: {
    id: "sar",
    title: "SAR Radar (VV Backscatter)",
    badge: "Radar (Cloud-Penetrating)",
    badgeColor: "#2563eb",
    sensor: "Sentinel-1 C-Band SAR (Lee-Filtered VV)",
    resolution: "10m / px",
    description: "Active microwave radar backscatter in dB. Surface roughness and structural pit excavation alters dielectric scattering regardless of clouds.",
    beforeSrc: "/imagery/sar_before.png",
    afterSrc: "/imagery/sar_after.png",
    diffSrc: "/imagery/sar_diff.png",
    compositeSrc: "/imagery/sar_diff.png",
    hasComparison: true,
  },
  monsoon: {
    id: "monsoon",
    title: "Monsoon Radar vs Optical",
    badge: "Cloud Invariance",
    badgeColor: "#7c3aed",
    sensor: "Sentinel-2 (Cloud-Obscured) vs Sentinel-1 SAR",
    resolution: "10m / px",
    description: "Demonstrating SAR radar's ability to maintain 100% detection capability during heavy monsoon cloud cover when optical satellites are blinded.",
    compositeSrc: "/imagery/monsoon_comparison.png",
    afterSrc: "/imagery/monsoon_detection.png",
    hasComparison: false,
  },
  overlay: {
    id: "overlay",
    title: "Trigger Anomaly Overlay",
    badge: "Detections",
    badgeColor: "#d63a1a",
    sensor: "Multi-Sensor Fusion Engine",
    resolution: "10m / px",
    description: "Automated candidate triggers overlaid with bounding boxes and cluster centroids onto real satellite imagery.",
    compositeSrc: "/imagery/triggers_overlay.png",
    hasComparison: false,
  },
  full: {
    id: "full",
    title: "Multi-Spectral Overview",
    badge: "Full Evidence",
    badgeColor: "#e8420c",
    sensor: "Multi-Satellite Composite",
    resolution: "Multi-resolution",
    description: "Comprehensive 5-panel evidence sheet combining NDVI, SAR VV dB, SAR Lee-filtered change, and VIIRS Nighttime Lights radiance.",
    compositeSrc: "/imagery/full_preview.png",
    hasComparison: false,
  },
};

export function ImageryViewer({
  triggerId,
  changePct,
  ntlDelta,
  sarScore,
}: {
  triggerId?: string | null;
  changePct?: number | null;
  ntlDelta?: number | null;
  sarScore?: number | null;
}) {
  const [activeBand, setActiveBand] = useState<SpectralBand>("ndvi");
  const [compareMode, setCompareMode] = useState<"after" | "before" | "diff" | "composite">("after");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);


  const dataset = DATASETS[activeBand];

  const currentImageSrc =
    compareMode === "before" && dataset.beforeSrc
      ? dataset.beforeSrc
      : compareMode === "diff" && dataset.diffSrc
      ? dataset.diffSrc
      : compareMode === "composite" && dataset.compositeSrc
      ? dataset.compositeSrc
      : dataset.afterSrc || dataset.compositeSrc || "/imagery/ndvi_after.png";

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="p-3.5 border-b border-border bg-surface-raised flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SatelliteIcon size={16} className="text-accent" />
          <span className="font-display font-bold text-xs uppercase tracking-wide text-text">
            Satellite & Spectral Evidence
          </span>
        </div>
        <button
          onClick={() => setLightboxSrc(currentImageSrc)}
          className="flex items-center gap-1 text-[11px] font-display text-text-muted hover:text-text px-2 py-1 rounded border border-border"
          title="Open in full-screen lightbox"
        >
          <MaximizeIcon size={12} />
          Expand
        </button>
      </div>

      {/* Band Selector Pills */}
      <div className="flex gap-1.5 p-2.5 overflow-x-auto border-b border-border bg-bg/50 no-scrollbar">
        {(Object.keys(DATASETS) as SpectralBand[]).map((bandKey) => {
          const item = DATASETS[bandKey];
          const isActive = activeBand === bandKey;
          return (
            <button
              key={bandKey}
              onClick={() => {
                setActiveBand(bandKey);
                if (!DATASETS[bandKey].beforeSrc && (compareMode === "before" || compareMode === "diff")) {
                  setCompareMode("composite");
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-display transition-all whitespace-nowrap ${
                isActive
                  ? "bg-accent text-accent-text font-bold shadow-sm"
                  : "bg-surface border border-border text-text-muted hover:text-text"
              }`}
            >
              <span>{item.title}</span>
            </button>
          );
        })}
      </div>

      {/* Dataset Metadata Bar */}
      <div className="px-3.5 py-2 border-b border-border bg-surface flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded text-[10px] font-display font-semibold uppercase"
            style={{
              backgroundColor: `color-mix(in srgb, ${dataset.badgeColor} 15%, transparent)`,
              color: dataset.badgeColor,
            }}
          >
            {dataset.badge}
          </span>
          <span className="text-text-muted font-display text-[11px] truncate max-w-[200px]">
            {dataset.sensor}
          </span>
        </div>
        <div className="text-[11px] font-display text-text-faint">
          Res: {dataset.resolution}
        </div>
      </div>

      {/* Comparison Controls (for NDVI, NTL, SAR) */}
      {dataset.hasComparison && (
        <div className="px-3.5 py-2 border-b border-border bg-bg/40 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setCompareMode("after")}
              className={`px-2.5 py-1 rounded text-xs font-display uppercase font-semibold transition-colors ${
                compareMode === "after"
                  ? "bg-surface text-text border border-accent shadow-sm"
                  : "text-text-muted hover:text-text"
              }`}
            >
              After (2024)
            </button>
            <button
              onClick={() => setCompareMode("before")}
              className={`px-2.5 py-1 rounded text-xs font-display uppercase font-semibold transition-colors ${
                compareMode === "before"
                  ? "bg-surface text-text border border-accent shadow-sm"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Before (2020)
            </button>
            {dataset.diffSrc && (
              <button
                onClick={() => setCompareMode("diff")}
                className={`px-2.5 py-1 rounded text-xs font-display uppercase font-semibold transition-colors ${
                  compareMode === "diff"
                    ? "bg-surface text-text border border-accent shadow-sm"
                    : "text-text-muted hover:text-text"
                }`}
              >
                Change Δ
              </button>
            )}
          </div>

          <span className="text-[11px] font-display text-text-faint">
            {compareMode === "after" ? "Recent Scene" : compareMode === "before" ? "Baseline" : "Delta Matrix"}
          </span>
        </div>
      )}

      {/* Image Display / Interactive View */}
      <div className="relative aspect-square w-full bg-black/90 flex items-center justify-center overflow-hidden group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentImageSrc}
          alt={dataset.title}
          className="w-full h-full object-contain cursor-zoom-in"
          onClick={() => setLightboxSrc(currentImageSrc)}
        />

        {/* Floating Quick Stats on Imagery */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
          <div className="bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/20 text-white text-[11px] font-display">
            {activeBand === "ndvi" && changePct != null && (
              <span>Δ NDVI Drop: <strong className="text-red-400">-{changePct}%</strong></span>
            )}
            {activeBand === "ntl" && ntlDelta != null && (
              <span>NTL Δ: <strong className="text-amber-400">+{ntlDelta.toFixed(2)} nW</strong></span>
            )}
            {activeBand === "sar" && sarScore != null && (
              <span>SAR Score: <strong className="text-blue-400">{sarScore.toFixed(2)}</strong></span>
            )}
            {(activeBand === "monsoon" || activeBand === "overlay" || activeBand === "full") && (
              <span>Site: <strong>{triggerId ?? "AOI-07"}</strong></span>
            )}
          </div>

          <button
            onClick={() => setLightboxSrc(currentImageSrc)}
            className="pointer-events-auto bg-black/80 hover:bg-black/95 backdrop-blur-md p-1.5 rounded-md border border-white/20 text-white transition-transform active:scale-95"
            title="Full Resolution Lightbox"
          >
            <MaximizeIcon size={14} />
          </button>
        </div>
      </div>

      {/* Description & Science Interpretation */}
      <div className="p-3 bg-surface text-xs text-text-muted leading-relaxed border-t border-border">
        <p>{dataset.description}</p>
      </div>

      {/* Lightbox Modal */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex flex-col p-4 md:p-8 animate-fadeIn"
          onClick={() => setLightboxSrc(null)}
        >
          <div className="flex items-center justify-between text-white mb-3" onClick={(e) => e.stopPropagation()}>
            <div>
              <h4 className="font-display font-bold text-base">{dataset.title}</h4>
              <p className="text-xs text-white/70">{dataset.sensor} &middot; {dataset.resolution}</p>
            </div>
            <button
              onClick={() => setLightboxSrc(null)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <XIcon size={20} />
            </button>
          </div>

          <div
            className="flex-1 flex items-center justify-center min-h-0 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxSrc}
              alt="High resolution satellite imagery"
              className="max-h-full max-w-full object-contain rounded-lg shadow-2xl border border-white/10"
            />
          </div>

          <div className="mt-3 text-center text-xs text-white/60 font-display">
            Click anywhere or press close to exit inspection mode.
          </div>
        </div>
      )}
    </div>
  );
}
