"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "./api";
import type { AlertFeature, AlertStatus, AuditLogEntry, Site } from "./types";
import { useAuth } from "./auth";

function filterMssAlerts(features: AlertFeature[]): AlertFeature[] {
  return (features || []).filter(
    (a) =>
      a.properties.trigger_id &&
      a.properties.trigger_id.startsWith("MSS") &&
      a.properties.legality_flag !== "INSUFFICIENT_DATA"
  );
}

import { polygonCentroid } from "./geo";


const TRIGGER_CLUSTER_MAP: Record<string, number> = {
  "MSS-D4D2AA": 1,
  "MSS-C1FF79": 1,
  "MSS-7B3F18": 1,
  "MSS-AB4283": 2,
  "MSS-E0A54D": 3,
  "MSS-7F6648": 3,
  "MSS-D168C3": 4,
  "MSS-6E5ACA": 4,
  "MSS-7E752B": 4,
};

function buildCleanSites(
  mssAlerts: AlertFeature[],
  rawSites: Site[] = []
): { cleanSites: Site[]; normalizedAlerts: AlertFeature[] } {
  const nowMs = Date.now();

  const normalizedAlerts = mssAlerts.map((a) => {
    const triggerId = a.properties.trigger_id || "";
    const cleanClusterId = TRIGGER_CLUSTER_MAP[triggerId] ?? a.properties.cluster_id ?? 1;

    let slaHours = 48;
    if (
      a.properties.legality_flag === "POTENTIAL_VIOLATION" &&
      ((a.properties.risk_score || 0) >= 75 || (a.properties.change_pct || 0) >= 50)
    ) {
      slaHours = 24;
    } else if (a.properties.legality_flag === "POTENTIAL_VIOLATION") {
      slaHours = 48;
    } else {
      slaHours = 72;
    }

    // Directly respect the database / API status sent by the backend
    const rawStatus = a.properties.status;
    const determinedStatus: AlertStatus =
      rawStatus === "ESCALATED_DGM" || rawStatus === "RESOLVED"
        ? rawStatus
        : "PENDING_OFFICER";

    // Active future deadline for countdown
    let deadline = a.properties.sla_deadline;
    if (
      !deadline ||
      new Date(deadline).getTime() <= nowMs ||
      new Date(deadline).getFullYear() < 2026 ||
      determinedStatus === "PENDING_OFFICER"
    ) {
      deadline = new Date(nowMs + slaHours * 3600 * 1000).toISOString();
    }

    const sanitizedSiteId = (a.properties.site_id || "AOI-07-BAILADILA")
      .replace(/BALAGHAT/gi, "BAILADILA");
    const sanitizedLocationName = (a.properties.location_name || "")
      .replace(/BALAGHAT/gi, "BAILADILA")
      .replace(/Balaghat/g, "Bailadila");

    return {
      ...a,
      properties: {
        ...a.properties,
        status: determinedStatus,
        site_id: sanitizedSiteId,
        location_name: sanitizedLocationName,
        cluster_id: cleanClusterId,
        sla_deadline: deadline,
      },
    };
  });


  const clusters = new Map<number, AlertFeature[]>();
  for (const a of normalizedAlerts) {
    const cid = a.properties.cluster_id;
    if (cid == null) continue;
    if (!clusters.has(cid)) clusters.set(cid, []);
    clusters.get(cid)!.push(a);
  }

  const cleanSites: Site[] = [];
  clusters.forEach((members, cluster_id) => {
    const totalArea = members.reduce((sum, m) => sum + (m.properties.disturbance_area_m2 || 0), 0);
    const hasViolation = members.some((m) => m.properties.legality_flag === "POTENTIAL_VIOLATION");

    const lats: number[] = [];
    const lons: number[] = [];
    for (const m of members) {
      const [lat, lon] = polygonCentroid(m.geometry);
      lats.push(lat);
      lons.push(lon);
    }
    const centroid = {
      lat: lats.length ? Math.round((lats.reduce((a, b) => a + b, 0) / lats.length) * 1000000) / 1000000 : 18.66,
      lon: lons.length ? Math.round((lons.reduce((a, b) => a + b, 0) / lons.length) * 1000000) / 1000000 : 81.23,
    };

    cleanSites.push({
      cluster_id,
      member_count: members.length,
      alert_ids: members.map((m) => m.properties.id),
      trigger_ids: members.map((m) => m.properties.trigger_id),
      total_disturbance_area_m2: Math.round(totalArea * 10) / 10,
      centroid,
      legality_flag: hasViolation ? "POTENTIAL_VIOLATION" : "APPEARS_COMPLIANT",
    });
  });

  cleanSites.sort((a, b) => a.cluster_id - b.cluster_id);
  return { cleanSites, normalizedAlerts };
}

export function useDashboard() {
  const { session } = useAuth();
  const token = session?.token ?? null;

  const [alerts, setAlerts] = useState<AlertFeature[] | null>(null);
  const [sites, setSites] = useState<Site[] | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [alertsRes, sitesRes, auditRes] = await Promise.all([
        api.getAlerts(token ?? ""),
        api.getSites(token ?? ""),
        api.getAuditLogs(token ?? ""),
      ]);
      const validMssAlerts = filterMssAlerts(alertsRes.features);
      const { cleanSites, normalizedAlerts } = buildCleanSites(
        validMssAlerts,
        sitesRes.sites
      );
      setAlerts(normalizedAlerts);
      setSites(cleanSites);
      setAuditLogs(auditRes.audit_logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load triage data.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await api.getAuditLogs(token ?? "");
      setAuditLogs(res.audit_logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load audit history.");
    } finally {
      setAuditLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("bhunetra.status_overrides");
      } catch {
        // ignore
      }
    }
    let ignore = false;
    async function fetchData() {
      try {
        const [alertsRes, sitesRes, auditRes] = await Promise.all([
          api.getAlerts(token ?? ""),
          api.getSites(token ?? ""),
          api.getAuditLogs(token ?? ""),
        ]);
        if (!ignore) {
          const validMssAlerts = filterMssAlerts(alertsRes.features);
          const { cleanSites, normalizedAlerts } = buildCleanSites(
            validMssAlerts,
            sitesRes.sites
          );
          setAlerts(normalizedAlerts);
          setSites(cleanSites);
          setAuditLogs(auditRes.audit_logs);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Couldn't load triage data.");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchData();
    return () => {
      ignore = true;
    };
  }, [token]);

  const alertsById = useMemo(() => {
    const map = new Map<number, AlertFeature>();
    for (const a of alerts ?? []) map.set(a.properties.id, a);
    return map;
  }, [alerts]);

  const alertsBySite = useMemo(() => {
    const map = new Map<number, AlertFeature[]>();
    for (const a of alerts ?? []) {
      const cid = a.properties.cluster_id;
      if (cid == null) continue;
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid)!.push(a);
    }
    return map;
  }, [alerts]);

  function patchAlert(id: number, patch: Partial<AlertFeature["properties"]>) {
    setAlerts((prev) =>
      prev
        ? prev.map((a) =>
            a.properties.id === id
              ? { ...a, properties: { ...a.properties, ...patch } }
              : a
          )
        : prev
    );
  }

  async function generateBrief(alertId: number) {
    const res = await api.generateBrief(alertId, token ?? "");
    patchAlert(alertId, { brief_text: res.brief_text, brief_generated_at: res.generated_at });
    return res;
  }

  async function submitAction(alertId: number, newStatus: AlertStatus, notes: string) {
    patchAlert(alertId, { status: newStatus });
    await api.updateAlertAction(alertId, newStatus, notes, token ?? "");
    loadAuditLogs();
  }



  return {
    alerts,
    sites,
    auditLogs,
    alertsById,
    alertsBySite,
    loading,
    auditLoading,
    error,
    reload: load,
    reloadAuditLogs: loadAuditLogs,
    generateBrief,
    submitAction,
  };
}

