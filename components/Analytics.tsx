import { useEffect, useState } from "react";
import type { AlertsGeoJSON } from "../utils/api";

type AnalyticsProps = {
  alerts: AlertsGeoJSON | null;
};

export default function Analytics({
  alerts,
}: AnalyticsProps) {
  const features = alerts?.features || [];

  const [resolvedAlerts, setResolvedAlerts] =
    useState<number[]>([]);

  const [dismissedAlerts, setDismissedAlerts] =
    useState<number[]>([]);

  const loadAlertStatuses = () => {
    const savedResolvedAlerts = JSON.parse(
      localStorage.getItem(
        "bhunetra_resolved_alerts"
      ) || "[]"
    );

    const savedDismissedAlerts = JSON.parse(
      localStorage.getItem(
        "bhunetra_dismissed_alerts"
      ) || "[]"
    );

    setResolvedAlerts(savedResolvedAlerts);
    setDismissedAlerts(savedDismissedAlerts);
  };

  useEffect(() => {
    loadAlertStatuses();

    const handleAlertUpdate = () => {
      loadAlertStatuses();
    };

    window.addEventListener(
      "bhunetra_alert_updated",
      handleAlertUpdate
    );

    return () => {
      window.removeEventListener(
        "bhunetra_alert_updated",
        handleAlertUpdate
      );
    };
  }, []);

  const totalAlerts = features.length;

  const resolvedCount = features.filter(
    (feature) =>
      resolvedAlerts.includes(
        feature.properties.id
      )
  ).length;

  const dismissedCount = features.filter(
    (feature) =>
      dismissedAlerts.includes(
        feature.properties.id
      )
  ).length;

  const pendingAlerts = features.filter(
    (feature) =>
      !resolvedAlerts.includes(
        feature.properties.id
      ) &&
      !dismissedAlerts.includes(
        feature.properties.id
      ) &&
      feature.properties.status ===
        "PENDING_OFFICER"
  ).length;

  const escalatedAlerts = features.filter(
    (feature) =>
      !resolvedAlerts.includes(
        feature.properties.id
      ) &&
      !dismissedAlerts.includes(
        feature.properties.id
      ) &&
      feature.properties.status ===
        "ESCALATED_DGM"
  ).length;

  const averageRisk =
    totalAlerts > 0
      ? (
          features.reduce(
            (total, feature) =>
              total +
              feature.properties.risk_score,
            0
          ) / totalAlerts
        ).toFixed(1)
      : "0";

  return (
    <div className="space-y-6">

      {/* STATISTICS CARDS */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">

        <div className="rounded-xl bg-white p-5 shadow">
          <p className="text-sm text-gray-500">
            Total Alerts
          </p>

          <p className="mt-2 text-3xl font-bold">
            {totalAlerts}
          </p>
        </div>

        <div className="rounded-xl bg-yellow-50 p-5 shadow">
          <p className="text-sm text-gray-600">
            Pending Alerts
          </p>

          <p className="mt-2 text-3xl font-bold text-yellow-600">
            {pendingAlerts}
          </p>
        </div>

        <div className="rounded-xl bg-red-50 p-5 shadow">
          <p className="text-sm text-gray-600">
            Escalated Alerts
          </p>

          <p className="mt-2 text-3xl font-bold text-red-600">
            {escalatedAlerts}
          </p>
        </div>

        <div className="rounded-xl bg-green-50 p-5 shadow">
          <p className="text-sm text-gray-600">
            Resolved Alerts
          </p>

          <p className="mt-2 text-3xl font-bold text-green-600">
            {resolvedCount}
          </p>
        </div>

        <div className="rounded-xl bg-gray-100 p-5 shadow">
          <p className="text-sm text-gray-600">
            Dismissed Alerts
          </p>

          <p className="mt-2 text-3xl font-bold text-gray-700">
            {dismissedCount}
          </p>
        </div>

      </div>

      {/* AVERAGE RISK */}
      <div className="rounded-xl bg-blue-50 p-5 shadow">

        <p className="text-sm text-gray-600">
          Average Risk Score
        </p>

        <p className="mt-2 text-3xl font-bold text-blue-600">
          {averageRisk}%
        </p>

      </div>

      {/* ALERT STATUS OVERVIEW */}
      <div className="rounded-xl bg-white p-6 shadow">

        <h3 className="mb-5 text-lg font-bold">
          Alerts by Status
        </h3>

        <div className="space-y-4">

          {/* PENDING */}
          <StatusBar
            label="Pending"
            count={pendingAlerts}
            total={totalAlerts}
            color="bg-yellow-500"
          />

          {/* ESCALATED */}
          <StatusBar
            label="Escalated"
            count={escalatedAlerts}
            total={totalAlerts}
            color="bg-red-600"
          />

          {/* RESOLVED */}
          <StatusBar
            label="Resolved"
            count={resolvedCount}
            total={totalAlerts}
            color="bg-green-600"
          />

          {/* DISMISSED */}
          <StatusBar
            label="Dismissed"
            count={dismissedCount}
            total={totalAlerts}
            color="bg-gray-500"
          />

        </div>

      </div>

    </div>
  );
}

type StatusBarProps = {
  label: string;
  count: number;
  total: number;
  color: string;
};

function StatusBar({
  label,
  count,
  total,
  color,
}: StatusBarProps) {
  const percentage =
    total > 0
      ? (count / total) * 100
      : 0;

  return (
    <div>

      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>

        <span>{count}</span>
      </div>

      <div className="h-3 w-full rounded bg-gray-200">

        <div
          className={`h-3 rounded ${color}`}
          style={{
            width: `${percentage}%`,
          }}
        />

      </div>

    </div>
  );
}