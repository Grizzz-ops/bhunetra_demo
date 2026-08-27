"use client";

import type { AuditLogEntry } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { ClockIcon, CheckCircleIcon, AlertTriangleIcon, FileTextIcon } from "./icons";

export function AuditTrail({
  alertId,
  logs,
}: {
  alertId: number;
  logs: AuditLogEntry[];
}) {
  const alertLogs = logs
    .filter((l) => l.alert_id === alertId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="rounded-xl border border-border bg-surface p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-display font-semibold text-xs uppercase tracking-wide text-text-muted">
          <ClockIcon size={14} className="text-accent" />
          Audit & Action History
        </div>
        <span className="text-[11px] font-display text-text-faint">
          {alertLogs.length} event{alertLogs.length === 1 ? "" : "s"}
        </span>
      </div>

      {alertLogs.length === 0 ? (
        <div className="text-xs text-text-muted italic py-2">
          No officer actions logged yet. Actions submitted below will be permanently recorded into the audit trail.
        </div>
      ) : (
        <div className="space-y-2.5 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-border">
          {alertLogs.map((log) => {
            const isResolve = log.new_status === "RESOLVED";
            const isEscalate = log.new_status === "ESCALATED_DGM";

            return (
              <div key={log.id} className="relative pl-7 text-xs space-y-1">
                {/* Timeline node icon */}
                <div
                  className="absolute left-0 top-0.5 w-[23px] h-[23px] rounded-full border bg-surface flex items-center justify-center shadow-xs"
                  style={{
                    borderColor: isResolve ? "var(--compliant)" : isEscalate ? "var(--violation)" : "var(--border)",
                  }}
                >
                  {isResolve ? (
                    <CheckCircleIcon size={12} className="text-[var(--compliant)]" />
                  ) : isEscalate ? (
                    <AlertTriangleIcon size={12} className="text-[var(--violation)]" />
                  ) : (
                    <FileTextIcon size={12} className="text-text-muted" />
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-bold text-text">
                    {log.action.replace(/_/g, " ")} &middot;{" "}
                    <span
                      style={{
                        color: isResolve ? "var(--compliant)" : isEscalate ? "var(--violation)" : "var(--text-muted)",
                      }}
                    >
                      {log.new_status}
                    </span>
                  </span>
                  <span className="text-[10px] font-display text-text-faint">
                    {formatDateTime(log.timestamp)}
                  </span>
                </div>

                <div className="text-[11px] text-text-muted flex items-center gap-1">
                  <span>Officer: <strong>{log.officer_name ?? `ID #${log.officer_id}`}</strong></span>
                  {log.previous_status && (
                    <span className="text-text-faint">
                      ({log.previous_status} &rarr; {log.new_status})
                    </span>
                  )}
                </div>

                {log.notes && (
                  <div className="p-2 rounded bg-bg text-[11px] text-text border border-border/60 leading-normal">
                    {log.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
