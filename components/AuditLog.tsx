import { useEffect, useState } from "react";

type AuditLogEntry = {
  alertId: number;
  location: string;
  previousStatus: string;
  newStatus: string;
  officer: string;
  action: string;
  timestamp: string;
};

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  const loadLogs = () => {
    const savedLogs = JSON.parse(
      localStorage.getItem("bhunetra_audit_logs") || "[]"
    );

    setLogs(savedLogs);
  };

  useEffect(() => {
    loadLogs();

    const handleAuditLogUpdate = () => {
      loadLogs();
    };

    window.addEventListener(
      "bhunetra_audit_updated",
      handleAuditLogUpdate
    );

    return () => {
      window.removeEventListener(
        "bhunetra_audit_updated",
        handleAuditLogUpdate
      );
    };
  }, []);

  return (
    <div className="overflow-x-auto">
      {logs.length === 0 ? (
        <p className="py-6 text-center text-gray-500">
          No audit logs found.
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-800 text-gray-300">
            <tr>
              <th className="px-4 py-3">Alert ID</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Previous Status</th>
              <th className="px-4 py-3">New Status</th>
              <th className="px-4 py-3">Officer</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Timestamp</th>
            </tr>
          </thead>

          <tbody>
            {logs.map((log, index) => (
              <tr
                key={index}
                className="border-b border-gray-200 hover:bg-gray-50"
              >
                <td className="px-4 py-4 font-semibold">
                  #{log.alertId}
                </td>

                <td className="px-4 py-4">
                  {log.location}
                </td>

                <td className="px-4 py-4">
                  {log.previousStatus}
                </td>

                <td className="px-4 py-4 font-semibold text-green-600">
                  {log.newStatus}
                </td>

                <td className="px-4 py-4">
                  {log.officer}
                </td>

                <td className="px-4 py-4">
                  {log.action}
                </td>

                <td className="px-4 py-4">
                  {log.timestamp}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}