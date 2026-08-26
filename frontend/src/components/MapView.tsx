"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Polygon, CircleMarker, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngTuple } from "leaflet";
import type { AlertFeature, LeaseFeature, Site } from "@/lib/types";
import { polygonToLatLngs } from "@/lib/geo";
import { legalityMeta } from "@/lib/format";

const DEFAULT_CENTER: LatLngTuple = [18.66, 81.23]; // Bailadila AOI fallback

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [bounds, map]);
  return null;
}

export default function MapView({
  alerts,
  sites,
  leases,
  selectedSiteId,
  selectedAlertId,
  onSelectSite,
  onSelectAlert,
}: {
  alerts: AlertFeature[];
  sites: Site[];
  leases: LeaseFeature[];
  selectedSiteId: number | null;
  selectedAlertId: number | null;
  onSelectSite: (id: number) => void;
  onSelectAlert: (id: number) => void;
}) {
  const initialBounds = useMemo<LatLngBoundsExpression | null>(() => {
    const points: LatLngTuple[] = sites.map((s) => [s.centroid.lat, s.centroid.lon]);
    if (points.length === 0) return null;
    return points as LatLngBoundsExpression;
  }, [sites]);

  const selectedSiteMembers = useMemo(
    () => (selectedSiteId != null ? alerts.filter((a) => a.properties.cluster_id === selectedSiteId) : []),
    [alerts, selectedSiteId]
  );

  const selectedBounds = useMemo<LatLngBoundsExpression | null>(() => {
    if (selectedSiteMembers.length === 0) return null;
    const pts: LatLngTuple[] = [];
    for (const a of selectedSiteMembers) {
      for (const ring of polygonToLatLngs(a.geometry)) {
        for (const p of ring as LatLngTuple[]) pts.push(p);
      }
    }
    return pts.length ? (pts as LatLngBoundsExpression) : null;
  }, [selectedSiteMembers]);

  const mountedOnce = useRef(false);
  useEffect(() => {
    mountedOnce.current = true;
  }, []);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={13}
      className="h-full w-full"
      zoomControl={true}
      attributionControl={true}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        attribution="&copy; OpenStreetMap contributors"
      />

      <FitBounds bounds={selectedBounds ?? initialBounds} />

      {leases.map((lease) => (
        <Polygon
          key={`lease-${lease.properties.id}`}
          positions={polygonToLatLngs(lease.geometry)}
          pathOptions={{
            color: "var(--text-faint)",
            weight: 1.5,
            dashArray: "4 4",
            fillOpacity: 0.02,
          }}
          interactive={false}
        />
      ))}

      {selectedSiteId == null &&
        sites.map((site) => {
          const meta = legalityMeta(site.legality_flag);
          const isSelected = site.cluster_id === selectedSiteId;
          return (
            <CircleMarker
              key={`site-${site.cluster_id}`}
              center={[site.centroid.lat, site.centroid.lon]}
              radius={Math.min(26, 11 + Math.sqrt(site.member_count) * 4)}
              pathOptions={{
                color: meta.color,
                weight: isSelected ? 3 : 2,
                fillColor: meta.color,
                fillOpacity: 0.35,
              }}
              eventHandlers={{ click: () => onSelectSite(site.cluster_id) }}
            />
          );
        })}

      {selectedSiteId != null &&
        selectedSiteMembers.map((alert) => {
          const meta = legalityMeta(alert.properties.legality_flag);
          const isSelectedAlert = alert.properties.id === selectedAlertId;
          return (
            <Polygon
              key={`alert-${alert.properties.id}`}
              positions={polygonToLatLngs(alert.geometry)}
              pathOptions={{
                color: meta.color,
                weight: isSelectedAlert ? 4 : 2,
                fillColor: meta.color,
                fillOpacity: isSelectedAlert ? 0.5 : 0.25,
              }}
              eventHandlers={{ click: () => onSelectAlert(alert.properties.id) }}
            />
          );
        })}

      {selectedSiteId != null &&
        (() => {
          const site = sites.find((s) => s.cluster_id === selectedSiteId);
          if (!site) return null;
          const meta = legalityMeta(site.legality_flag);
          return (
            <CircleMarker
              center={[site.centroid.lat, site.centroid.lon]}
              radius={7}
              pathOptions={{ color: meta.color, weight: 2, fillColor: "#fff", fillOpacity: 1 }}
              interactive={false}
            />
          );
        })()}
    </MapContainer>
  );
}
