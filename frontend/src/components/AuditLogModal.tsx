"use client";

import { useMemo, useState } from "react";
import type { AuditLogEntry } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { XIcon, SearchIcon, DownloadIcon, FileTextIcon, CheckCircleIcon, AlertTriangleIcon, ClockIcon } from "./icons";

export function AuditLogModal({
  isOpen,
  onClose,
  auditLogs,
}: {
  isOpen: boolean;
  onClose: () => void;
  auditLogs: AuditLogEntry[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchSearch =
        !search.trim() ||
        (log.trigger_id && log.trigger_id.toLowerCase().includes(search.toLowerCase())) ||
        (log.location_name && log.location_name.toLowerCase().includes(search.toLowerCase())) ||
        (log.notes && log.notes.toLowerCase().includes(search.toLowerCase())) ||
        (log.officer_name && log.officer_name.toLowerCase().includes(search.toLowerCase())) ||
        String(log.alert_id).includes(search);

      const matchStatus =
        statusFilter === "ALL" ||
        log.new_status === statusFilter ||
        log.action === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [auditLogs, search, statusFilter]);

  function exportCSV() {
    const headers = ["ID", "Alert ID", "Trigger ID", "Location", "Officer", "Action", "Previous Status", "New Status", "Notes", "Timestamp"];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.alert_id,
      l.trigger_id ?? "",
      `"${(l.location_name ?? "").replace(/"/g, '""')}"`,
      `"${(l.officer_name ?? `ID #${l.officer_id}`).replace(/"/g, '""')}"`,
      l.action,
      l.previous_status ?? "",
      l.new_status ?? "",
      `"${(l.notes ?? "").replace(/"/g, '""')}"`,
      l.timestamp,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bhunetra_audit_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `bhunetra_audit_ledger_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border bg-surface-raised flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-accent/10 text-accent">
              <ClockIcon size={18} />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-text">
                Enforcement Audit Ledger
              </h2>
              <p className="text-xs text-text-muted">
                Immutable chronological log of all officer actions, triage decisions, and escalations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-display font-semibold text-text hover:bg-bg transition-colors"
              title="Export CSV"
            >
              <DownloadIcon size={14} />
              CSV
            </button>
            <button
              onClick={exportJSON}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-display font-semibold text-text hover:bg-bg transition-colors"
              title="Export JSON"
            >
              <FileTextIcon size={14} />
              JSON
            </button>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-text-muted hover:text-text active:scale-95 transition-transform"
            >
              <XIcon size={18} />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3.5 border-b border-border bg-bg/50 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex-1 min-w-[220px] relative">
            <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Trigger ID, officer, location, or notes..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-surface text-xs text-text outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center gap-1 text-xs">
            <span className="text-text-muted font-display text-[11px] mr-1">Status:</span>
            {["ALL", "RESOLVED", "ESCALATED_DGM", "PENDING_OFFICER"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-display uppercase transition-colors ${
                  statusFilter === st
                    ? "bg-accent text-accent-text font-bold"
                    : "bg-surface border border-border text-text-muted hover:text-text"
                }`}
              >
                {st === "ALL" ? "All" : st.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Table List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-sm text-text-muted">
              No audit entries matched the current query.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-surface-raised border-b border-border text-[11px] font-display uppercase tracking-wider text-text-muted z-10">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-3 font-semibold">Alert / Trigger</th>
                  <th className="py-2.5 px-3 font-semibold">Officer</th>
                  <th className="py-2.5 px-3 font-semibold">Transition</th>
                  <th className="py-2.5 px-4 font-semibold">Action Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredLogs.map((log) => {
                  const isResolve = log.new_status === "RESOLVED";
                  const isEscalate = log.new_status === "ESCALATED_DGM";

                  return (
                    <tr key={log.id} className="hover:bg-surface-raised/60 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap font-display text-[11px] text-text-faint">
                        {formatDateTime(log.timestamp)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-display font-bold text-text">
                          {log.trigger_id ?? `Alert #${log.alert_id}`}
                        </div>
                        {log.location_name && (
                          <div className="text-[11px] text-text-muted truncate max-w-[180px]">
                            {log.location_name}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-medium text-text">
                          {log.officer_name ?? `Officer #${log.officer_id}`}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-display font-semibold uppercase"
                          style={{
                            background: isResolve
                              ? "var(--compliant-bg)"
                              : isEscalate
                              ? "var(--violation-bg)"
                              : "var(--unverified-bg)",
                            color: isResolve
                              ? "var(--compliant)"
                              : isEscalate
                              ? "var(--violation)"
                              : "var(--unverified)",
                          }}
                        >
                          {isResolve ? (
                            <CheckCircleIcon size={12} />
                          ) : isEscalate ? (
                            <AlertTriangleIcon size={12} />
                          ) : null}
                          {log.new_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-text leading-relaxed">
                        {log.notes ? (
                          <div className="line-clamp-2 max-w-sm">{log.notes}</div>
                        ) : (
                          <span className="text-text-faint italic">No additional remarks</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 px-5 border-t border-border bg-surface-raised flex items-center justify-between text-xs text-text-muted">
          <span>Showing <strong>{filteredLogs.length}</strong> of <strong>{auditLogs.length}</strong> recorded audit events</span>
          <span className="font-display text-[11px] text-text-faint">Cryptographically tracked &middot; PostGIS Ledger</span>
        </div>
      </div>
    </div>
  );
}
