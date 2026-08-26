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
  if (!ring || ring.length === 0) return [0, 0];
  let sumLat = 0;
  let sumLon = 0;
  for (const [lat, lon] of ring) {
    sumLat += lat;
    sumLon += lon;
  }
  return [sumLat / ring.length, sumLon / ring.length];
}

export function formatCoordinates(lat: number, lon: number, digits = 5): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(digits)}° ${latDir}, ${Math.abs(lon).toFixed(digits)}° ${lonDir}`;
}

export function toDMS(val: number, isLat: boolean): string {
  const dir = isLat ? (val >= 0 ? "N" : "S") : val >= 0 ? "E" : "W";
  const abs = Math.abs(val);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(1);
  return `${deg}° ${min}' ${sec}" ${dir}`;
}

export function formatCoordinatesDMS(lat: number, lon: number): string {
  return `${toDMS(lat, true)}, ${toDMS(lon, false)}`;
}

export function getGoogleMapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

export function getOpenStreetMapUrl(lat: number, lon: number, zoom = 16): string {
  return `https://www.openstreetmap.org/#map=${zoom}/${lat}/${lon}`;
}

export async function copyCoordinatesToClipboard(lat: number, lon: number): Promise<boolean> {
  const text = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // clipboard API denied or unsupported
  }
  return false;
}

