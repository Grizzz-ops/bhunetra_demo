import type { LatLngExpression, LatLngTuple } from "leaflet";
import type { GeoJSONPolygon } from "./types";

/** GeoJSON is [lon, lat]; Leaflet wants [lat, lon]. Every geometry in this
 * app crosses this boundary exactly once, here. */
export function polygonToLatLngs(geom: GeoJSONPolygon): LatLngExpression[][] {
  if (geom.type === "Polygon") {
    const rings = geom.coordinates as number[][][];
    return rings.map((ring) => ring.map(([lon, lat]) => [lat, lon] as LatLngTuple));
  }
  // MultiPolygon: flatten to the outer rings of each part for simple display
  const parts = geom.coordinates as number[][][][];
  return parts.map((rings) =>
    rings[0].map(([lon, lat]) => [lat, lon] as LatLngTuple)
  );
}

export function polygonCentroid(geom: GeoJSONPolygon): LatLngTuple {
  const rings = polygonToLatLngs(geom);
  const ring = rings[0] as LatLngTuple[];
  let sumLat = 0;
  let sumLon = 0;
  for (const [lat, lon] of ring) {
    sumLat += lat;
    sumLon += lon;
  }
  return [sumLat / ring.length, sumLon / ring.length];
}
