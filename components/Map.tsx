import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
} from "react-leaflet";
import type { Layer } from "leaflet";

import { getAlerts, AlertsGeoJSON } from "../utils/api";

import "leaflet/dist/leaflet.css";

export default function Map() {
  const [alerts, setAlerts] = useState<AlertsGeoJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAlerts() {
      try {
        const data = await getAlerts();
        setAlerts(data);
      } catch (err) {
        console.error(err);
        setError("Unable to load alerts");
      } finally {
        setLoading(false);
      }
    }

    loadAlerts();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-xl border">
        Loading alerts...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-xl border">
        {error}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <MapContainer
        center={[21.454, 78.122]}
        zoom={14}
        style={{ height: "500px", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {alerts && (
          <GeoJSON
            data={alerts}
            style={() => ({
              weight: 2,
              fillOpacity: 0.4,
            })}
            onEachFeature={(feature, layer: Layer) => {
              const properties = feature.properties;

              layer.bindPopup(`
                <div>
                  <strong>${properties.location_name}</strong>
                  <br />
                  Risk Score: ${properties.risk_score}
                  <br />
                  Status: ${properties.status}
                  <br />
                  SLA Deadline: ${properties.sla_deadline}
                </div>
              `);
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}