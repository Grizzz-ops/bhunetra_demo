import type {
  AlertsResponse,
  BriefResponse,
  ActionResponse,
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
  "https://bhunetra-demo-rosy.vercel.app";

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

export function getAuditLogs(token: string): Promise<AuditLogsResponse> {
  return request<AuditLogsResponse>("/api/v1/audit-logs", { token });
}

export function updateAlertAction(
  alertId: number,
  newStatus: AlertStatus,
  notes: string,
  token: string
) {
  return request<ActionResponse>(`/api/v1/alerts/${alertId}/action`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ new_status: newStatus, notes }),
  });
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


