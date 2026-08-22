import { useState } from "react";

import {
  updateAlertStatus,
  type AlertsGeoJSON,
} from "../utils/api";

type TriggerTableProps = {
  alerts: AlertsGeoJSON | null;
  onRefresh: () => Promise<void>;
};

export default function TriggerTable({
  alerts,
  onRefresh,
}: TriggerTableProps) {
  const [updating, setUpdating] = useState<number | null>(null);

  const features = alerts?.features || [];

  const handleUpdateAlertStatus = async (
  alertId: number,
  newStatus: "RESOLVED" | "DISMISSED",
  action: string
) => {
    setUpdating(alertId);

    try {
      await updateAlertStatus(
  alertId,
  newStatus,
  action
);
      // Get resolved alerts
      const resolvedAlerts = JSON.parse(
        localStorage.getItem("bhunetra_resolved_alerts") || "[]"
      );

      // Get dismissed alerts
      const dismissedAlerts = JSON.parse(
        localStorage.getItem("bhunetra_dismissed_alerts") || "[]"
      );

      if (newStatus === "RESOLVED") {
  if (!resolvedAlerts.includes(alertId)) {
    resolvedAlerts.push(alertId);
  }

  localStorage.setItem(
    "bhunetra_resolved_alerts",
    JSON.stringify(resolvedAlerts)
  );
}

if (newStatus === "DISMISSED") {
  if (!dismissedAlerts.includes(alertId)) {
    dismissedAlerts.push(alertId);
  }

  localStorage.setItem(
    "bhunetra_dismissed_alerts",
    JSON.stringify(dismissedAlerts)
  );
}

window.dispatchEvent(
  new Event("bhunetra_alert_updated")
);

      // Get audit logs
      const auditLogs = JSON.parse(
        localStorage.getItem("bhunetra_audit_logs") || "[]"
      );

      // Find the alert
      const alertFeature = features.find(
        (feature) => feature.properties.id === alertId
      );

      // Add audit log
      if (alertFeature) {
        auditLogs.unshift({
          alertId: alertFeature.properties.id,
          location: alertFeature.properties.location_name,
          previousStatus: alertFeature.properties.status,
          newStatus,
          officer:
            localStorage.getItem("bhunetra_name") ||
            "Field Officer",
          action,
          timestamp: new Date().toLocaleString(),
        });

        localStorage.setItem(
          "bhunetra_audit_logs",
          JSON.stringify(auditLogs)
        );

        // Tell AuditLog component to refresh
        window.dispatchEvent(
          new Event("bhunetra_audit_updated")
        );
      }

      alert(
        newStatus === "RESOLVED"
          ? "Alert resolved successfully."
          : "Alert dismissed successfully."
      );

      await onRefresh();
    } catch (error) {
      console.error(error);

      alert(
        "Failed to update alert. Please try again."
      );
    } finally {
      setUpdating(null);
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "PENDING_OFFICER":
        return "bg-yellow-500 text-black";

      case "ESCALATED_DGM":
        return "bg-red-600 text-white";

      case "RESOLVED":
        return "bg-green-600 text-white";

      case "DISMISSED":
        return "bg-gray-500 text-white";

      default:
        return "bg-gray-600 text-white";
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-800 text-gray-300">
          <tr>
            <th className="px-4 py-3">ID</th>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3">Risk Score</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">SLA Deadline</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>

        <tbody>
          {features.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-8 text-center text-gray-500"
              >
                No alerts found.
              </td>
            </tr>
          ) : (
            features.map((feature) => {
              const alertData = feature.properties;

              const resolvedAlerts = JSON.parse(
                localStorage.getItem(
                  "bhunetra_resolved_alerts"
                ) || "[]"
              );

              const dismissedAlerts = JSON.parse(
                localStorage.getItem(
                  "bhunetra_dismissed_alerts"
                ) || "[]"
              );

              const isResolved =
                resolvedAlerts.includes(alertData.id);

              const isDismissed =
                dismissedAlerts.includes(alertData.id);

              let currentStatus = alertData.status;

              if (isResolved) {
                currentStatus = "RESOLVED";
              }

              if (isDismissed) {
                currentStatus = "DISMISSED";
              }

              const deadline = new Date(
                alertData.sla_deadline
              );

              const isOverdue =
                deadline < new Date();

              return (
                <tr
                  key={alertData.id}
                  className="border-b border-gray-200 hover:bg-gray-50"
                >
                  {/* ID */}
                  <td className="px-4 py-4 font-semibold">
                    #{alertData.id}
                  </td>

                  {/* LOCATION */}
                  <td className="px-4 py-4">
                    {alertData.location_name}
                  </td>

                  {/* RISK SCORE */}
                  <td className="px-4 py-4 font-semibold">
                    {alertData.risk_score}%
                  </td>

                  {/* STATUS */}
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                        currentStatus
                      )}`}
                    >
                      {currentStatus}
                    </span>
                  </td>

                  {/* SLA DEADLINE */}
                  <td className="px-4 py-4">
                    <span
                      className={
                        isOverdue
                          ? "font-semibold text-red-600"
                          : "text-gray-700"
                      }
                    >
                      {deadline.toLocaleString()}
                    </span>
                  </td>

                  {/* ACTION */}
                  <td className="px-4 py-4">
                    {currentStatus !== "RESOLVED" &&
                    currentStatus !== "DISMISSED" ? (
                      <div className="flex gap-2">
                       {/* RESOLVE BUTTON */}
<button
  onClick={() =>
    handleUpdateAlertStatus(
      alertData.id,
      "RESOLVED",
      "Field visit completed."
    )
  }
  disabled={
    updating === alertData.id
  }
                          className="rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {updating === alertData.id
                            ? "Updating..."
                            : "Resolve"}
                        </button>

                        {/* DISMISS BUTTON */}
<button
  onClick={() =>
    handleUpdateAlertStatus(
      alertData.id,
      "DISMISSED",
      "Alert dismissed as false alarm."
    )
  }
  disabled={
    updating === alertData.id
  }
                          className="rounded-md bg-gray-600 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`text-sm font-semibold ${
                          currentStatus === "RESOLVED"
                            ? "text-green-600"
                            : "text-gray-600"
                        }`}
                      >
                        {currentStatus === "RESOLVED"
                          ? "Resolved"
                          : "Dismissed"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}