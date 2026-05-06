// NDBC BuoyCAMs — Pacific weather buoys with public 360° panoramic cameras.
// Source: https://www.ndbc.noaa.gov/buoycams.php (JSON list)
// Image URL pattern: https://www.ndbc.noaa.gov/buoycam.php?station={id}

import { unstable_cache } from "next/cache";

const LIST_URL = "https://www.ndbc.noaa.gov/buoycams.php";

// Use a wider radius than the on-shore network — Pacific buoys are sparse
// and useful for coastal scouting up to ~150 mi.
const SF_LAT = 37.7749;
const SF_LNG = -122.4194;
const RADIUS_MI = 150;

export interface BuoyCam {
  id: string;
  name: string;
  shortName: string;
  lat: number;
  lng: number;
  distanceMi: number;
  imageUrl: string;
  stationUrl: string;
}

interface RawBuoy {
  id: string;
  name: string;
  lat: number;
  lng: number;
  img: string;
  width: number;
  height: number;
}

function haversineMi(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.7613;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function fetchAndFilter(): Promise<BuoyCam[]> {
  const res = await fetch(LIST_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`ndbc buoycams ${res.status}`);
  const arr = (await res.json()) as RawBuoy[];

  const out: BuoyCam[] = [];
  for (const b of arr) {
    if (typeof b.lat !== "number" || typeof b.lng !== "number") continue;
    const dist = haversineMi(SF_LAT, SF_LNG, b.lat, b.lng);
    if (dist > RADIUS_MI) continue;

    // The "name" field from NDBC is verbose — e.g.
    // "SAN FRANCISCO - 18NM West of San Francisco, CA". Trim it.
    const shortName = b.name.split(" - ")[0]?.trim() || b.name;

    out.push({
      id: b.id,
      name: b.name,
      shortName: shortName.replace(/\s+/g, " "),
      lat: b.lat,
      lng: b.lng,
      distanceMi: dist,
      imageUrl: `https://www.ndbc.noaa.gov/buoycam.php?station=${b.id}`,
      stationUrl: `https://www.ndbc.noaa.gov/station_page.php?station=${b.id}`,
    });
  }

  out.sort((a, b) => a.distanceMi - b.distanceMi);
  return out;
}

export const getNearbyBuoyCams = unstable_cache(
  fetchAndFilter,
  ["ndbc-buoycams-sf-150mi"],
  { revalidate: 1800 },
);
