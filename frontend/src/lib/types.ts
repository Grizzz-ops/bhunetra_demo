export type AlertStatus = "PENDING_OFFICER" | "ESCALATED_DGM" | "RESOLVED";

export type LegalityFlag =
  | "POTENTIAL_VIOLATION"
  | "INSUFFICIENT_DATA"
  | "APPEARS_COMPLIANT";

export type DataSource = "REAL" | "MOCK" | "DERIVED_FROM_IMAGERY" | string;

export interface LegalityCheck {
  value: string;
  data_source: DataSource;
}

export interface MineralIndicator {
  iron_oxide_ratio?: number;
  ferrous_mineral_ratio?: number;
}

export interface LegalityAssessment {
  spatial_check?: LegalityCheck;
  temporal_check?: LegalityCheck;
  dispatch_check?: LegalityCheck;
  mineral_check?: LegalityCheck;
  mineral_indicator?: MineralIndicator;
  volume_check?: LegalityCheck;
  [key: string]: LegalityCheck | MineralIndicator | undefined;
}

export interface GeoJSONPolygon {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}

export interface AlertProperties {
  id: number;
  trigger_id: string | null;
  site_id: string | null;
  cluster_id: number | null;
  location_name: string;
  risk_score: number;
  change_pct: number | null;
  boundary_status: string | null;
  sar_change_score: number | null;
  confidence_score: number | null;
  confidence_tier: string | null;
  disturbance_area_m2: number | null;
  ntl_delta: number | null;
  legality_flag: LegalityFlag | null;
  legality_assessment: LegalityAssessment | null;
  status: AlertStatus;
  sla_deadline: string;
  brief_text: string | null;
  brief_generated_at: string | null;
}

export interface AlertFeature {
  type: "Feature";
  geometry: GeoJSONPolygon;
  properties: AlertProperties;
}

export interface AlertsResponse {
  type: "FeatureCollection";
  features: AlertFeature[];
}

export interface Site {
  cluster_id: number;
  member_count: number;
  alert_ids: number[];
  trigger_ids: (string | null)[];
  total_disturbance_area_m2: number;
  centroid: { lon: number; lat: number };
  legality_flag: LegalityFlag;
}

export interface SitesResponse {
  sites: Site[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: string;
  name: string;
}

export interface BriefResponse {
  alert_id: number;
  brief_text: string;
  generated_at: string;
  cached: boolean;
}

export interface ActionResponse {
  status: string;
  alert_id: number;
  previous_status: AlertStatus;
  new_status: AlertStatus;
  updated_by: number;
}

export interface LeaseFeature {
  type: "Feature";
  geometry: GeoJSONPolygon;
  properties: {
    id: number;
    source: string | null;
    lessee_name: string | null;
    mineral_type: string | null;
    status: string | null;
  };
}

export interface LeasesResponse {
  type: "FeatureCollection";
  features: LeaseFeature[];
}
