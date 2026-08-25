"""
BhuNetra — local OSM road extraction via GDAL's OSM driver (no live API calls).

Reads highway=* ways out of a local .osm.pbf extract (GDAL's OSM driver via
geopandas/pyogrio -- pyrosm was the original plan but can't be installed in
this environment without a C compiler/MSVC Build Tools), clips to the
Bailadila bbox with a safety margin, and writes real_data/roads.geojson for
score_triggers.py's road-access signal to consume offline.
"""
from pathlib import Path

import geopandas as gpd

# NOTE: not at the originally-expected raw_osm/central-zone-260820.osm.pbf --
# that file was confirmed corrupted and no longer exists. The re-downloaded
# replacement landed at the project root under a different filename.
PBF_FILE = "central-zone-260821.osm.pbf"
OUTPUT_FILE = Path("real_data/roads.geojson")

# Bailadila bbox with a safety margin beyond the tight detection AOI.
BBOX = (81.20, 18.63, 81.28, 18.70)  # (west, south, east, north)


def main():
    # GDAL's OSM driver exposes ways as the "lines" layer, with a "highway"
    # column when the way carries that tag.
    roads = gpd.read_file(PBF_FILE, layer="lines", bbox=BBOX)

    if "highway" not in roads.columns:
        raise RuntimeError(
            "'highway' column not found in the PBF 'lines' layer -- the "
            "extract may not include road tags, or the OSM driver's schema "
            "differs from expected."
        )

    roads = roads[roads["highway"].notna()][["highway", "geometry"]].reset_index(drop=True)

    if len(roads) == 0:
        print(f"No road segments found in bbox {BBOX} -- this is a real "
              f"finding about OSM coverage in this remote mining area, "
              f"not writing an empty file.")
        return

    OUTPUT_FILE.parent.mkdir(exist_ok=True)
    roads.to_file(OUTPUT_FILE, driver="GeoJSON")

    print(f"Found {len(roads)} road segment(s) in bbox {BBOX}")
    print("\nBreakdown by highway type:")
    for highway_type, count in roads["highway"].value_counts().items():
        print(f"  {highway_type:20s}  {count}")

    print(f"\nWritten to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
