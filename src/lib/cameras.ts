// ALERTCalifornia / AlertWildfire fire-watch camera data.
// Public source: cameras.alertcalifornia.org (UC San Diego). See terms at
// https://alertcalifornia.org/terms-of-use/

const ALL_CAMERAS_URL =
  "https://cameras.alertcalifornia.org/public-camera-data/all_cameras-v3.json";

const SF_LAT = 37.7749;
const SF_LNG = -122.4194;
const RADIUS_MI = 75;

export interface Camera {
  id: string;
  name: string;
  county: string;
  state: string;
  lat: number;
  lng: number;
  elevationFt: number | null;
  azimuthDeg: number | null;
  tiltDeg: number | null;
  zoom: number | null;
  lastFrameTs: number | null;
  distanceMi: number;
  thumbUrl: string;
  frameUrl: string;
  viewerUrl: string;
}

interface RawFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number | null, number | null, number | null];
  };
  properties: {
    id: string;
    name: string;
    state: string;
    county: string;
    az_current?: number | null;
    tilt_current?: number | null;
    zoom_current?: number | null;
    last_frame_ts?: number | null;
  };
}

interface RawFeatureCollection {
  type: "FeatureCollection";
  features: RawFeature[];
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

export async function getNearbyFireCameras(): Promise<Camera[]> {
  const res = await fetch(ALL_CAMERAS_URL, { next: { revalidate: 300 } });
  if (!res.ok) {
    throw new Error(`alertcalifornia camera list ${res.status}`);
  }
  const fc = (await res.json()) as RawFeatureCollection;

  const cameras: Camera[] = [];
  for (const f of fc.features) {
    const [lng, lat, elev] = f.geometry.coordinates;
    if (lat == null || lng == null) continue;

    const dist = haversineMi(SF_LAT, SF_LNG, lat, lng);
    if (dist > RADIUS_MI) continue;

    const { id, name, county, state } = f.properties;
    cameras.push({
      id,
      name: name || id,
      county: county || "",
      state: state || "",
      lat,
      lng,
      elevationFt: typeof elev === "number" ? Math.round(elev * 3.28084) : null,
      azimuthDeg: f.properties.az_current ?? null,
      tiltDeg: f.properties.tilt_current ?? null,
      zoom: f.properties.zoom_current ?? null,
      lastFrameTs: f.properties.last_frame_ts ?? null,
      distanceMi: dist,
      thumbUrl: `https://cameras.alertcalifornia.org/public-camera-data/${id}/latest-thumb.jpg`,
      frameUrl: `https://cameras.alertcalifornia.org/public-camera-data/${id}/latest-frame.jpg`,
      viewerUrl: `https://cameras.alertcalifornia.org/?id=${encodeURIComponent(id)}`,
    });
  }

  cameras.sort((a, b) => a.distanceMi - b.distanceMi);
  return cameras;
}

export const SCOUT_CENTER = { lat: SF_LAT, lng: SF_LNG, radiusMi: RADIUS_MI };
