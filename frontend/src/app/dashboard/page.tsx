"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useDashboard } from "@/lib/useDashboard";
import * as api from "@/lib/api";
import type { LeaseFeature } from "@/lib/types";
import { TopBar } from "@/components/TopBar";
import { SiteList } from "@/components/SiteList";
import { SitePanel } from "@/components/SitePanel";
import { AlertPanel } from "@/components/AlertPanel";
import { SiteListSkeleton } from "@/components/Skeletons";
import { ErrorBanner } from "@/components/ErrorBanner";
import MapView from "@/components/MapViewLoader";
import { ListIcon, MapIcon } from "@/components/icons";

export default function DashboardPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const {
    alerts,
    sites,
    alertsById,
    alertsBySite,
    loading,
    error,
    reload,
    generateBrief,
    submitAction,
  } = useDashboard();

  const [leases, setLeases] = useState<LeaseFeature[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [mobileTab, setMobileTab] = useState<"map" | "list">("list");

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login");
  }, [authLoading, session, router]);

  useEffect(() => {
    if (!session) return;
    api
      .getLeases(session.token)
      .then((res) => setLeases(res.features))
      .catch(() => setLeases([])); // lease overlay is a nice-to-have, never blocks triage
  }, [session]);

  const sitesList = sites ?? [];
  const selectedSite = useMemo(
    () => sitesList.find((s) => s.cluster_id === selectedSiteId) ?? null,
    [sitesList, selectedSiteId]
  );
  const selectedSiteMembers = selectedSiteId != null ? alertsBySite.get(selectedSiteId) ?? [] : [];
  const selectedAlert = selectedAlertId != null ? alertsById.get(selectedAlertId) ?? null : null;

  function handleSelectSite(id: number) {
    setSelectedSiteId(id);
    setSelectedAlertId(null);
    setSheetExpanded(true);
    setMobileTab("map");
  }
  function handleSelectAlert(id: number) {
    setSelectedAlertId(id);
    setSheetExpanded(true);
    setMobileTab("map");
  }
  function backToSites() {
    setSelectedSiteId(null);
    setSelectedAlertId(null);
  }
  function backToSite() {
    setSelectedAlertId(null);
  }

  if (authLoading || !session) {
    return (
      <div className="grid h-dvh place-items-center bg-bg">
        <div className="font-display text-sm tracking-widest text-text-faint uppercase">
          Loading…
        </div>
      </div>
    );
  }

  const panelContent = selectedAlert ? (
    <AlertPanel
      alert={selectedAlert}
      onBack={backToSite}
      onGenerateBrief={() => generateBrief(selectedAlert.properties.id)}
      onSubmitAction={(status, notes) => submitAction(selectedAlert.properties.id, status, notes)}
    />
  ) : selectedSite ? (
    <SitePanel
      site={selectedSite}
      members={selectedSiteMembers}
      onBack={backToSites}
      onSelectAlert={handleSelectAlert}
    />
  ) : loading ? (
    <SiteListSkeleton />
  ) : error ? (
    <div className="p-3.5">
      <ErrorBanner message={error} onRetry={reload} />
    </div>
  ) : (
    <SiteList
      sites={sitesList}
      alertsBySite={alertsBySite}
      selectedSiteId={selectedSiteId}
      onSelectSite={handleSelectSite}
    />
  );

  return (
    <div className="flex flex-col h-dvh bg-bg overflow-hidden">
      <TopBar onRefresh={reload} refreshing={loading} />

      {/* Desktop: map + fixed side panel */}
      <div className="hidden md:flex flex-1 min-h-0">
        <div className="flex-1 min-w-0">
          <MapView
            alerts={alerts ?? []}
            sites={sitesList}
            leases={leases}
            selectedSiteId={selectedSiteId}
            selectedAlertId={selectedAlertId}
            onSelectSite={handleSelectSite}
            onSelectAlert={handleSelectAlert}
          />
        </div>
        <div className="w-[420px] shrink-0 border-l border-border bg-bg overflow-hidden">
          {panelContent}
        </div>
      </div>

      {/* Mobile: tab-switched full-screen map or list, selection opens a bottom sheet over the map.
          Tab bar height (56px / h-14) is reserved via bottom-14 on both layers below it. */}
      <div className="md:hidden flex-1 min-h-0 relative">
        <div className={`absolute inset-x-0 top-0 bottom-14 ${mobileTab === "map" ? "" : "hidden"}`}>
          <MapView
            alerts={alerts ?? []}
            sites={sitesList}
            leases={leases}
            selectedSiteId={selectedSiteId}
            selectedAlertId={selectedAlertId}
            onSelectSite={handleSelectSite}
            onSelectAlert={handleSelectAlert}
          />

          {(selectedSite || selectedAlert) && (
            <div
              className="absolute left-0 right-0 bottom-0 rounded-t-2xl border-t border-border bg-bg shadow-[0_-4px_24px_rgba(0,0,0,0.25)] transition-[height] duration-200 flex flex-col"
              style={{ height: sheetExpanded ? "92%" : "48%" }}
            >
              <button
                onClick={() => setSheetExpanded((v) => !v)}
                className="w-full flex justify-center py-2 shrink-0"
                aria-label="Toggle sheet size"
              >
                <span className="h-1.5 w-10 rounded-full bg-border" />
              </button>
              <div className="flex-1 min-h-0">{panelContent}</div>
            </div>
          )}
        </div>

        <div className={`absolute inset-x-0 top-0 bottom-14 overflow-y-auto ${mobileTab === "list" ? "" : "hidden"}`}>
          {panelContent}
        </div>

        {/* Bottom tab bar -- large thumb-reachable targets, always on top */}
        <div className="absolute left-0 right-0 bottom-0 h-14 flex border-t border-border bg-surface z-[1000]">
          <button
            onClick={() => setMobileTab("map")}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 ${
              mobileTab === "map" ? "text-accent" : "text-text-muted"
            }`}
          >
            <MapIcon size={20} />
            <span className="text-[11px] font-display font-semibold uppercase tracking-wide">Map</span>
          </button>
          <button
            onClick={() => {
              setMobileTab("list");
              setSheetExpanded(false);
            }}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 ${
              mobileTab === "list" ? "text-accent" : "text-text-muted"
            }`}
          >
            <ListIcon size={20} />
            <span className="text-[11px] font-display font-semibold uppercase tracking-wide">Sites</span>
          </button>
        </div>
      </div>
    </div>
  );
}
