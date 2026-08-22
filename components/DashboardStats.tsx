import { useEffect, useState } from "react";
import type { AlertsGeoJSON } from "../utils/api";

type DashboardStatsProps = {
  alerts: AlertsGeoJSON | null;
};

export default function DashboardStats({
  alerts,
}: DashboardStatsProps) {
  const features = alerts?.features || [];

  const [resolvedAlerts, setResolvedAlerts] = useState<number[]>([]);
const [dismissedAlerts, setDismissedAlerts] = useState<number[]>([]);

const loadAlertStatuses = () => {
  const savedResolvedAlerts = JSON.parse(
    localStorage.getItem("bhunetra_resolved_alerts") || "[]"
  );
  

  const savedDismissedAlerts = JSON.parse(
    localStorage.getItem("bhunetra_dismissed_alerts") || "[]"
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

  const resolvedCount = features.filter((feature) =>
    resolvedAlerts.includes(feature.properties.id)
  ).length;

  const dismissedCount = features.filter((feature) =>
  dismissedAlerts.includes(feature.properties.id)
).length;

  const escalatedCount = features.filter(
  (feature) =>
    !resolvedAlerts.includes(feature.properties.id) &&
    !dismissedAlerts.includes(feature.properties.id) &&
    feature.properties.status === "ESCALATED_DGM"
).length;



  const overdueCount = features.filter((feature) => {
    const deadline = new Date(
      feature.properties.sla_deadline
    );

    return (
  !resolvedAlerts.includes(feature.properties.id) &&
  !dismissedAlerts.includes(feature.properties.id) &&
  deadline < new Date()
);
  }).length;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">

      <div className="rounded-xl bg-white p-6 shadow">
        <p className="text-sm text-gray-500">
          Total Alerts
        </p>

        <p className="mt-2 text-3xl font-bold">
          {totalAlerts}
        </p>
      </div>

      <div className="rounded-xl bg-red-50 p-6 shadow">
        <p className="text-sm text-red-600">
          Escalated Alerts
        </p>

        <p className="mt-2 text-3xl font-bold text-red-700">
          {escalatedCount}
        </p>
      </div>

      <div className="rounded-xl bg-green-50 p-6 shadow">
        <p className="text-sm text-green-600">
          Resolved Alerts
        </p>

        <p className="mt-2 text-3xl font-bold text-green-700">
          {resolvedCount}
        </p>

      </div>

      <div className="rounded-xl bg-gray-100 p-6 shadow">
  <p className="text-sm text-gray-600">
    Dismissed Alerts
  </p>

  <p className="mt-2 text-3xl font-bold text-gray-700">
    {dismissedCount}
  </p>
</div>

      <div className="rounded-xl bg-yellow-50 p-6 shadow">
        <p className="text-sm text-yellow-700">
          Overdue Alerts
        </p>

        <p className="mt-2 text-3xl font-bold text-yellow-800">
          {overdueCount}
        </p>
      </div>

    </div>
  );
}