"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "./api";
import type { AlertFeature, AlertStatus, Site } from "./types";
import { useAuth } from "./auth";

export function useDashboard() {
  const { session } = useAuth();
  const token = session?.token ?? null;

  const [alerts, setAlerts] = useState<AlertFeature[] | null>(null);
  const [sites, setSites] = useState<Site[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [alertsRes, sitesRes] = await Promise.all([
        api.getAlerts(token ?? ""),
        api.getSites(token ?? ""),
      ]);
      setAlerts(alertsRes.features);
      setSites(sitesRes.sites);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load triage data.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

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
    await api.updateAlertAction(alertId, newStatus, notes, token ?? "");
    patchAlert(alertId, { status: newStatus });
  }

  return {
    alerts,
    sites,
    alertsById,
    alertsBySite,
    loading,
    error,
    reload: load,
    generateBrief,
    submitAction,
  };
}
