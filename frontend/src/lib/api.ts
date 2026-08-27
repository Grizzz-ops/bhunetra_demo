import type {
  AlertsResponse,
  BriefResponse,
  ActionResponse,
  AuditLogEntry,
  AuditLogsResponse,
  LeasesResponse,
  LoginResponse,
  SitesResponse,
  AlertStatus,
} from "./types";

// Public, non-secret backend URL -- same one the pipeline scripts already
// hardcode (see pipeline/seed_backend.py). Override via env for local
// backend dev.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://bhunetrademo-production.up.railway.app";

const LOCAL_AUDIT_KEY = "bhunetra.audit_logs";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

/** Turns any fetch/HTTP failure into a message safe to show an officer
 * directly -- never a raw stack trace, always "what happened + what to do." */
function friendlyMessage(status: number, detail?: string): string {
  if (status === 0) {
    return "Can't reach the server. Check your connection and try again.";
  }
  if (status === 401) {
    return "Your session has expired. Please log in again.";
  }
  if (status === 404) {
    return "That record no longer exists.";
  }
  if (status === 409) {
    return detail || "This was already submitted.";
  }
  if (status === 503) {
    return detail || "The service is temporarily unavailable. Try again in a moment.";
  }
  if (status >= 500) {
    return "Something went wrong on the server. Try again in a moment.";
  }
  return detail || "That request didn't go through. Please try again.";
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string> | undefined),
  };
  if (token) {
    finalHeaders["Authorization"] = `Bearer ${token}`;
  }

  let resp: Response;
  try {
    resp = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
    });
  } catch {
    throw new ApiError(friendlyMessage(0), 0);
  }

  if (!resp.ok) {
    let detail: string | undefined;
    try {
      const body = await resp.json();
      detail = typeof body?.detail === "string" ? body.detail : undefined;
    } catch {
      // response wasn't JSON -- fall through with no detail
    }
    throw new ApiError(friendlyMessage(resp.status, detail), resp.status);
  }

  if (resp.status === 204) return undefined as T;
  return resp.json() as Promise<T>;
}

export function login(email: string, password: string) {
  return request<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getAlerts(token: string) {
  return request<AlertsResponse>("/api/v1/alerts", { token });
}

export function getSites(token: string) {
  return request<SitesResponse>("/api/v1/sites", { token });
}

export function getLeases(token: string) {
  return request<LeasesResponse>("/api/v1/leases", { token });
}

export function generateBrief(alertId: number, token: string) {
  return request<BriefResponse>(`/api/v1/alerts/${alertId}/brief`, {
    method: "POST",
    token,
  });
}

// Initial baseline mock audit logs to showcase history
const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 101,
    alert_id: 1,
    trigger_id: "MSS-D4D2AA",
    location_name: "Bailadila AOI-07 — MSS-D4D2AA",
    officer_id: 2,
    officer_name: "Inspector R. Verma",
    previous_status: "PENDING_OFFICER",
    new_status: "ESCALATED_DGM",
    action: "STATUS_UPDATED",
    notes: "Suspected large-scale violation — excavation outside lease boundary detected via Sentinel-2 optical.",
    timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
  {
    id: 102,
    alert_id: 2,
    trigger_id: "MSS-C1FF79",
    location_name: "Bailadila AOI-07 — MSS-C1FF79",
    officer_id: 2,
    officer_name: "Inspector R. Verma",
    previous_status: "PENDING_OFFICER",
    new_status: "RESOLVED",
    action: "STATUS_UPDATED",
    notes: "Site is licensed / already known — verified against local DMG registry lease records.",
    timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
  {
    id: 103,
    alert_id: 3,
    trigger_id: "MSS-07A189",
    location_name: "Bailadila AOI-07 — MSS-07A189",
    officer_id: 1,
    officer_name: "HQ Officer A. Sharma",
    previous_status: "PENDING_OFFICER",
    new_status: "ESCALATED_DGM",
    action: "STATUS_UPDATED",
    notes: "Needs DGM review — high SAR backscatter change confirmed through monsoon cloud cover.",
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

export function getLocalAuditLogs(): AuditLogEntry[] {
  if (typeof window === "undefined") return INITIAL_AUDIT_LOGS;
  try {
    const raw = window.localStorage.getItem(LOCAL_AUDIT_KEY);
    if (!raw) {
      window.localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(INITIAL_AUDIT_LOGS));
      return INITIAL_AUDIT_LOGS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_AUDIT_LOGS;
  }
}

export function appendLocalAuditLog(entry: AuditLogEntry): void {
  if (typeof window === "undefined") return;
  try {
    const logs = getLocalAuditLogs();
    const updated = [entry, ...logs.filter((l) => l.id !== entry.id)];
    window.localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(updated));
  } catch {
    // best-effort
  }
}

export async function getAuditLogs(token: string): Promise<AuditLogsResponse> {
  try {
    return await request<AuditLogsResponse>("/api/v1/audit-logs", { token });
  } catch {
    // Fallback to local persistent audit log store
    return { audit_logs: getLocalAuditLogs() };
  }
}

export async function updateAlertAction(
  alertId: number,
  newStatus: AlertStatus,
  notes: string,
  token: string,
  extra?: { triggerId?: string | null; locationName?: string; officerName?: string; officerId?: number | null; previousStatus?: AlertStatus }
) {
  let res: ActionResponse;
  try {
    res = await request<ActionResponse>(`/api/v1/alerts/${alertId}/action`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ new_status: newStatus, notes }),
    });
  } catch (err) {
    // If backend patch succeeds or even if local test, log action locally
    throw err;
  }

  // Record audit log entry
  const entry: AuditLogEntry = {
    id: Date.now(),
    alert_id: alertId,
    trigger_id: extra?.triggerId,
    location_name: extra?.locationName,
    officer_id: res.updated_by ?? extra?.officerId ?? 1,
    officer_name: extra?.officerName ?? "Current Officer",
    previous_status: res.previous_status ?? extra?.previousStatus ?? "PENDING_OFFICER",
    new_status: res.new_status ?? newStatus,
    action: "STATUS_UPDATED",
    notes,
    timestamp: new Date().toISOString(),
  };
  appendLocalAuditLog(entry);

  return res;
}

export async function updateAlertSla(
  alertId: number,
  params: { slaDeadline?: string; extensionHours?: number; reason?: string },
  token: string
) {
  return request<{ status: string; alert_id: number; previous_deadline?: string; new_deadline: string }>(
    `/api/v1/alerts/${alertId}/sla`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify({
        sla_deadline: params.slaDeadline,
        extension_hours: params.extensionHours,
        reason: params.reason ?? "Field officer inspection schedule adjustment",
      }),
    }
  );
}


