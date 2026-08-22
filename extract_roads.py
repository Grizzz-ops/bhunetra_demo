"""
BhuNetra — local OSM road extraction (no live API calls)

Reads highway=* ways out of a local .osm.pbf extract via GDAL's OSM driver
(through geopandas/pyogrio), clips to BBOX, and writes real_data/roads.geojson
for score_triggers.py's road-proximity logic to consume offline.
"""
from pathlib import Path

import geopandas as gpd

PBF_FILE   = "raw_osm/central-zone-260820.osm.pbf"
OUTPUT_FILE = Path("real_data/roads.geojson")

# Must match the BBOX in download_sentinel.py / detection.py's AOI.
BBOX = (81.22, 18.65, 81.245, 18.67)   # (west, south, east, north)


def main():
    gdf = gpd.read_file(PBF_FILE, layer="lines", bbox=BBOX)

    if "highway" not in gdf.columns:
        raise RuntimeError(
            "'highway' column not found in the PBF 'lines' layer -- the "
            "extract may not include road tags, or the OSM driver's schema "
            "differs from expected."
        )

    roads = gdf[gdf["highway"].notna()][["highway", "geometry"]].reset_index(drop=True)

    OUTPUT_FILE.parent.mkdir(exist_ok=True)
    roads.to_file(OUTPUT_FILE, driver="GeoJSON")

    print(f"Found {len(roads)} road segment(s) within {BBOX}")
    print(f"Written to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
