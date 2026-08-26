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

function buildCleanSites(
  mssAlerts: AlertFeature[],
  rawSites: Site[]
): { cleanSites: Site[]; normalizedAlerts: AlertFeature[] } {
  // Sort distinct cluster_ids present in the alerts
  const rawClusterIds = Array.from(
    new Set(mssAlerts.map((a) => a.properties.cluster_id).filter((id): id is number => id != null))
  ).sort((a, b) => a - b);

  // Map each raw cluster id to a clean 1-based sequential ID (1, 2, 3, 4)
  const idMap = new Map<number, number>();
  rawClusterIds.forEach((rawId, index) => {
    idMap.set(rawId, index + 1);
  });

  // Re-map cluster_id on all alerts
  const normalizedAlerts = mssAlerts.map((a) => {
    const rawCid = a.properties.cluster_id;
    const newCid = rawCid != null && idMap.has(rawCid) ? idMap.get(rawCid)! : 1;
    return {
      ...a,
      properties: {
        ...a.properties,
        cluster_id: newCid,
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
    const originalSite = rawSites.find((s) => idMap.get(s.cluster_id) === cluster_id);
    const totalArea = members.reduce((sum, m) => sum + (m.properties.disturbance_area_m2 || 0), 0);
    const hasViolation = members.some((m) => m.properties.legality_flag === "POTENTIAL_VIOLATION");

    cleanSites.push({
      cluster_id,
      member_count: members.length,
      alert_ids: members.map((m) => m.properties.id),
      trigger_ids: members.map((m) => m.properties.trigger_id),
      total_disturbance_area_m2: Math.round(totalArea * 10) / 10,
      centroid: originalSite?.centroid ?? { lat: 18.66, lon: 81.23 },
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
      const { cleanSites, normalizedAlerts } = buildCleanSites(validMssAlerts, sitesRes.sites);
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
    } catch {
      setAuditLogs(api.getLocalAuditLogs());
    } finally {
      setAuditLoading(false);
    }
  }, [token]);

  useEffect(() => {
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
          const { cleanSites, normalizedAlerts } = buildCleanSites(validMssAlerts, sitesRes.sites);
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
    const alert = alertsById.get(alertId);
    await api.updateAlertAction(alertId, newStatus, notes, token ?? "", {
      triggerId: alert?.properties.trigger_id,
      locationName: alert?.properties.location_name,
      officerName: session?.name,
      previousStatus: alert?.properties.status,
    });
    patchAlert(alertId, { status: newStatus });
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

