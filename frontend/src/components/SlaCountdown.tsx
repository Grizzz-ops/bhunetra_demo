"use client";

import { useEffect, useState } from "react";
import { slaState, formatDeadline } from "@/lib/format";
import { ClockIcon } from "./icons";

const COLORS: Record<string, string> = {
  calm: "var(--sla-calm)",
  warn: "var(--sla-warn)",
  critical: "var(--sla-critical)",
  breached: "var(--sla-critical)",
  closed: "var(--text-faint)",
};

export function SlaCountdown({
  deadline,
  status,
  size = "md",
  showExactDeadline = false,
}: {
  deadline: string;
  status: string;
  size?: "sm" | "md" | "lg";
  showExactDeadline?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const state = slaState(deadline, status, now);
  const color = COLORS[state.urgency];
  const pulsing = state.urgency === "critical" || state.urgency === "breached";

  const sizing =
    size === "lg"
      ? "px-3.5 py-2 text-sm gap-2"
      : size === "sm"
        ? "px-2 py-0.5 text-[11px] gap-1"
        : "px-2.5 py-1 text-xs gap-1.5";

  const exactFormatted = formatDeadline(deadline);

  return (
    <div className="inline-flex flex-col gap-0.5" title={`Target Enforcement Deadline: ${exactFormatted}`}>
      <span
        className={`inline-flex items-center ${sizing} rounded-md font-display font-semibold whitespace-nowrap ${pulsing ? "pulse-critical" : ""}`}
        style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
      >
        <ClockIcon size={size === "lg" ? 16 : size === "sm" ? 11 : 13} />
        <span>{state.urgency === "breached" ? "SLA BREACHED" : state.label}</span>
      </span>
      {showExactDeadline && exactFormatted !== "—" && (
        <span className="text-[10px] font-display text-text-faint pl-1">
          Due: {exactFormatted}
        </span>
      )}
    </div>
  );
}

