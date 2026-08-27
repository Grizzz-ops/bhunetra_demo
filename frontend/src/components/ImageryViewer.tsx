"use client";

import { useEffect, useMemo, useState } from "react";
import * as api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ImageryBand } from "@/lib/types";
import { SatelliteIcon, MaximizeIcon, XIcon } from "./icons";

type CompareMode = "after" | "before" | "diff" | "composite";

export function ImageryViewer({ alertId }: { alertId: number }) {
  const { session } = useAuth();
  const token = session?.token ?? null;

  const [bands, setBands] = useState<ImageryBand[] | null>(null);
  const [error, setError] = useState(false);
  const [activeBandId, setActiveBandId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<CompareMode>("after");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setBands(null);
    setError(false);
    api
      .getAlertImagery(alertId, token ?? "")
      .then((res) => {
        if (ignore) return;
        setBands(res.bands);
        setActiveBandId(res.bands[0]?.id ?? null);
      })
      .catch(() => {
        if (!ignore) setError(true);
      });
    return () => {
      ignore = true;
    };
  }, [alertId, token]);

  const dataset = useMemo(
    () => bands?.find((b) => b.id === activeBandId) ?? bands?.[0] ?? null,
    [bands, activeBandId]
  );

  const currentImageSrc = useMemo(() => {
    if (!dataset) return null;
    if (compareMode === "before" && dataset.before) return dataset.before;
    if (compareMode === "diff" && dataset.diff) return dataset.diff;
    if (compareMode === "composite" && dataset.composite) return dataset.composite;
    return dataset.after || dataset.composite || dataset.before || null;
  }, [dataset, compareMode]);

  if (error || (bands && bands.length === 0)) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-xs text-text-muted">
        No satellite evidence imagery is on file for this trigger.
      </div>
    );
  }

  if (!bands || !dataset) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-xs text-text-muted animate-pulse">
        Loading satellite evidence…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="p-3.5 border-b border-border bg-surface-raised flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SatelliteIcon size={16} className="text-accent" />
          <span className="font-display font-bold text-xs uppercase tracking-wide text-text">
            Satellite &amp; Spectral Evidence
          </span>
        </div>
        {currentImageSrc && (
          <button
            onClick={() => setLightboxSrc(currentImageSrc)}
            className="flex items-center gap-1 text-[11px] font-display text-text-muted hover:text-text px-2 py-1 rounded border border-border"
            title="Open in full-screen lightbox"
          >
            <MaximizeIcon size={12} />
            Expand
          </button>
        )}
      </div>

      {/* Band Selector Pills */}
      <div className="flex gap-1.5 p-2.5 overflow-x-auto border-b border-border bg-bg/50 no-scrollbar">
        {bands.map((item) => {
          const isActive = item.id === dataset.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveBandId(item.id);
                if (!item.before && (compareMode === "before" || compareMode === "diff")) {
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
              backgroundColor: `color-mix(in srgb, ${dataset.badge_color} 15%, transparent)`,
              color: dataset.badge_color,
            }}
          >
            {dataset.badge}
          </span>
          <span className="text-text-muted font-display text-[11px] truncate max-w-[200px]">
            {dataset.sensor}
          </span>
        </div>
        <div className="text-[11px] font-display text-text-faint">Res: {dataset.resolution}</div>
      </div>

      {/* Comparison Controls */}
      {dataset.has_comparison && (
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
              After
            </button>
            {dataset.before && (
              <button
                onClick={() => setCompareMode("before")}
                className={`px-2.5 py-1 rounded text-xs font-display uppercase font-semibold transition-colors ${
                  compareMode === "before"
                    ? "bg-surface text-text border border-accent shadow-sm"
                    : "text-text-muted hover:text-text"
                }`}
              >
                Before
              </button>
            )}
            {dataset.diff && (
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
        </div>
      )}

      {/* Image Display */}
      <div className="relative aspect-square w-full bg-black/90 flex items-center justify-center overflow-hidden group">
        {currentImageSrc ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImageSrc}
              alt={dataset.title}
              className="w-full h-full object-contain cursor-zoom-in"
              onClick={() => setLightboxSrc(currentImageSrc)}
            />
            <button
              onClick={() => setLightboxSrc(currentImageSrc)}
              className="absolute bottom-2 right-2 pointer-events-auto bg-black/80 hover:bg-black/95 backdrop-blur-md p-1.5 rounded-md border border-white/20 text-white transition-transform active:scale-95"
              title="Full Resolution Lightbox"
            >
              <MaximizeIcon size={14} />
            </button>
          </>
        ) : (
          <span className="text-white/50 text-xs">No image for this view.</span>
        )}
      </div>

      {/* Description */}
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
              <p className="text-xs text-white/70">
                {dataset.sensor} &middot; {dataset.resolution}
              </p>
            </div>
            <button
              onClick={() => setLightboxSrc(null)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <XIcon size={20} />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center min-h-0 relative" onClick={(e) => e.stopPropagation()}>
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
