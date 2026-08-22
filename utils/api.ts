const API_URL = process.env.NEXT_PUBLIC_API_URL;

export type AlertProperties = {
  id: number;
  location_name: string;
  risk_score: number;
  status: string;
  sla_deadline: string;
};

export type AlertFeature = {
  type: "Feature";
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  properties: AlertProperties;
};

export type AlertsGeoJSON = {
  type: "FeatureCollection";
  features: AlertFeature[];
};

export async function getAlerts(): Promise<AlertsGeoJSON> {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  const response = await fetch(`${API_URL}/api/v1/alerts`);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch alerts: ${response.status}`
    );
  }

  return response.json();
}

export async function advanceSla() {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  const response = await fetch(
    `${API_URL}/api/v1/simulate/advance-sla`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to advance SLA: ${response.status}`
    );
  }

  return response.json();
}

export async function updateAlertStatus(
  alertId: number,
  newStatus: "RESOLVED" | "DISMISSED",
  notes: string
) {
  if (!API_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not configured"
    );
  }

  const token = localStorage.getItem(
    "bhunetra_token"
  );

  const response = await fetch(
    `${API_URL}/api/v1/alerts/${alertId}/action`,
    {
      method: "PATCH",

      headers: {
        "Content-Type": "application/json",

        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
      },

      body: JSON.stringify({
        new_status: newStatus,
        notes,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to update alert: ${response.status}`
    );
  }

  return response.json();
}