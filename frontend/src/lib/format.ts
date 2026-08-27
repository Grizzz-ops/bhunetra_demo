export type SlaUrgency = "calm" | "warn" | "critical" | "breached" | "closed";

export interface SlaState {
  urgency: SlaUrgency;
  label: string;
  msRemaining: number;
}

const WARN_THRESHOLD_MS = 12 * 60 * 60 * 1000; // under 12h left -> amber
const CRITICAL_THRESHOLD_MS = 3 * 60 * 60 * 1000; // under 3h left -> red/pulsing

/** Never render a raw timestamp diff -- always classify into the officer-
 * facing urgency states the UI actually needs (calm/warn/critical/breached). */
export function slaState(
  deadlineIso: string,
  status: string,
  now: number = Date.now()
): SlaState {
  if (status !== "PENDING_OFFICER") {
    return { urgency: "closed", label: status === "RESOLVED" ? "Resolved" : "Escalated", msRemaining: 0 };
  }

  const deadline = new Date(deadlineIso).getTime();
  const msRemaining = deadline - now;

  if (msRemaining <= 0) {
    return { urgency: "breached", label: "SLA BREACHED", msRemaining };
  }

  const label = formatDuration(msRemaining) + " left";

  if (msRemaining <= CRITICAL_THRESHOLD_MS) {
    return { urgency: "critical", label, msRemaining };
  }
  if (msRemaining <= WARN_THRESHOLD_MS) {
    return { urgency: "warn", label, msRemaining };
  }
  return { urgency: "calm", label, msRemaining };
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatArea(m2: number | null | undefined): string {
  if (m2 == null) return "—";
  return `${Math.round(m2).toLocaleString()} m²`;
}


export function formatPercent(v: number | null | undefined, digits = 0): string {
  if (v == null) return "—";
  return `${v.toFixed(digits)}%`;
}

export function formatScore(v: number | null | undefined, digits = 2): string {
  if (v == null) return "—";
  return v.toFixed(digits);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatDeadline(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}


export const LEGALITY_META: Record<
  string,
  { label: string; color: string; bg: string; icon: "alert" | "question" | "check" }
> = {
  POTENTIAL_VIOLATION: {
    label: "VIOLATION",
    color: "var(--violation)",
    bg: "var(--violation-bg)",
    icon: "alert",
  },
  INSUFFICIENT_DATA: {
    label: "UNVERIFIED",
    color: "var(--unverified)",
    bg: "var(--unverified-bg)",
    icon: "question",
  },
  APPEARS_COMPLIANT: {
    label: "COMPLIANT",
    color: "var(--compliant)",
    bg: "var(--compliant-bg)",
    icon: "check",
  },
};

export function legalityMeta(flag: string | null | undefined) {
  return LEGALITY_META[flag ?? ""] ?? LEGALITY_META.INSUFFICIENT_DATA;
}

const CHECK_LABELS: Record<string, string> = {
  spatial_check: "Spatial (inside lease?)",
  temporal_check: "Temporal (lease valid?)",
  dispatch_check: "Dispatch passes",
  mineral_check: "Mineral estimate",
  volume_check: "Volume estimate",
};

export function checkLabel(key: string): string {
  return CHECK_LABELS[key] ?? key.replace(/_/g, " ");
}
