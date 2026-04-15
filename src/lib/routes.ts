export type LngLat = [number, number];

// Approximate running route SF → Boston following I-80 corridor (~3,100 mi)
export const RUN_ROUTE_SF_BOSTON: LngLat[] = [
  [-122.42, 37.77], // San Francisco
  [-122.03, 37.97], // Walnut Creek
  [-121.49, 38.58], // Sacramento
  [-120.2, 39.23], // Truckee
  [-119.81, 39.53], // Reno
  [-117.73, 40.28], // Winnemucca
  [-115.76, 40.83], // Elko
  [-114.04, 40.74], // Wendover
  [-111.89, 40.76], // Salt Lake City
  [-111.41, 41.24], // Ogden
  [-109.57, 41.59], // Rock Springs
  [-106.32, 41.31], // Laramie
  [-104.82, 41.14], // Cheyenne
  [-103.21, 41.12], // Sidney
  [-100.76, 41.13], // North Platte
  [-98.38, 40.92], // Grand Island
  [-96.68, 40.82], // Lincoln
  [-95.93, 41.26], // Omaha
  [-93.62, 41.59], // Des Moines
  [-91.53, 41.66], // Iowa City
  [-90.18, 41.52], // Davenport
  [-88.5, 41.93], // Joliet/Aurora
  [-87.63, 41.88], // Chicago
  [-86.25, 41.68], // South Bend
  [-85.13, 41.07], // Fort Wayne
  [-83.54, 41.65], // Toledo
  [-81.69, 41.5], // Cleveland
  [-80.09, 42.13], // Erie
  [-78.88, 42.89], // Buffalo
  [-77.6, 43.16], // Rochester
  [-76.15, 43.05], // Syracuse
  [-74.75, 43.1], // Utica
  [-73.76, 42.65], // Albany
  [-72.58, 42.1], // Springfield
  [-71.8, 42.27], // Worcester
  [-71.06, 42.36], // Boston
];

// Approximate biking route SF → Boston, scenic TransAm-style (~3,500 mi)
export const BIKE_ROUTE_SF_BOSTON: LngLat[] = [
  [-122.42, 37.77], // San Francisco
  [-121.49, 38.58], // Sacramento
  [-120.64, 39.09], // Auburn
  [-119.77, 39.16], // Carson City
  [-118.62, 38.54], // Hawthorne
  [-117.07, 38.42], // Tonopah
  [-114.89, 39.25], // Ely
  [-112.45, 39.53], // Delta
  [-111.67, 39.33], // Richfield
  [-109.53, 38.57], // Moab
  [-108.55, 39.06], // Grand Junction
  [-107.32, 38.53], // Montrose
  [-105.84, 38.82], // Salida
  [-104.82, 38.83], // Colorado Springs
  [-104.61, 38.25], // Pueblo
  [-102.52, 37.97], // Lamar
  [-100.89, 38.06], // Garden City
  [-97.34, 37.69], // Wichita
  [-95.73, 38.97], // Topeka
  [-94.58, 39.1], // Kansas City
  [-92.33, 38.95], // Columbia
  [-90.2, 38.63], // St. Louis
  [-88.28, 37.97], // Evansville approach
  [-87.57, 37.78], // Owensboro
  [-85.76, 38.25], // Louisville
  [-84.5, 38.04], // Lexington
  [-82.56, 38.34], // Ashland (KY)
  [-81.63, 38.35], // Charleston (WV)
  [-79.94, 37.27], // Roanoke
  [-78.88, 38.03], // Charlottesville
  [-77.43, 37.54], // Richmond
  [-77.03, 38.9], // Washington DC
  [-76.61, 39.29], // Baltimore
  [-75.17, 39.95], // Philadelphia
  [-74.44, 40.5], // Princeton
  [-74.01, 40.71], // New York
  [-73.0, 41.05], // Fairfield (CT)
  [-72.92, 41.31], // New Haven
  [-72.68, 41.76], // Hartford
  [-71.8, 42.27], // Worcester
  [-71.06, 42.36], // Boston
];

// Approximate SF Bay perimeter polyline (~420 mi one loop, rough shoreline)
export const SF_BAY_PERIMETER: LngLat[] = [
  [-122.42, 37.77], // SF Embarcadero
  [-122.47, 37.81], // SF northern tip (Presidio)
  [-122.48, 37.83], // GG Bridge south anchor
  [-122.48, 37.85], // crossing GG
  [-122.47, 37.86], // Marin headlands
  [-122.5, 37.91], // Sausalito
  [-122.48, 37.95], // Tiburon
  [-122.45, 38.05], // San Rafael
  [-122.38, 38.11], // Novato east
  [-122.28, 38.16], // Petaluma River mouth
  [-122.17, 38.16], // Napa River mouth
  [-122.12, 38.06], // Vallejo
  [-122.06, 38.03], // Benicia
  [-121.93, 38.03], // Martinez
  [-121.87, 37.97], // Concord-ish
  [-121.94, 37.9], // Port Chicago area
  [-122.15, 37.86], // Richmond
  [-122.21, 37.86], // El Cerrito
  [-122.27, 37.87], // Berkeley
  [-122.25, 37.8], // Oakland / Bay Bridge east
  [-122.23, 37.75], // Alameda
  [-122.13, 37.69], // San Leandro
  [-122.11, 37.5], // Hayward
  [-122.09, 37.47], // Union City
  [-122.04, 37.45], // Fremont
  [-121.98, 37.46], // Newark
  [-122.02, 37.41], // Milpitas
  [-121.89, 37.34], // San Jose north
  [-122.02, 37.38], // Alviso
  [-122.09, 37.42], // Sunnyvale
  [-122.15, 37.45], // Mountain View
  [-122.19, 37.48], // Palo Alto
  [-122.22, 37.51], // Menlo Park
  [-122.27, 37.55], // Redwood City
  [-122.3, 37.57], // San Carlos
  [-122.33, 37.6], // San Mateo Bridge west
  [-122.35, 37.62], // Foster City
  [-122.39, 37.65], // San Mateo
  [-122.4, 37.7], // SSF / Brisbane
  [-122.4, 37.74], // SF south
  [-122.42, 37.77], // back to start
];

// Great-circle distance in miles between two [lng, lat] points
export function haversine(a: LngLat, b: LngLat): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Cumulative distances along a route (in miles). Returns array same length as route.
export function cumulativeDistances(route: LngLat[]): number[] {
  const out = [0];
  for (let i = 1; i < route.length; i++) {
    out.push(out[i - 1] + haversine(route[i - 1], route[i]));
  }
  return out;
}

// Total distance of a route in miles
export function routeDistance(route: LngLat[]): number {
  const cum = cumulativeDistances(route);
  return cum[cum.length - 1];
}

// Given a route and a traveled distance (miles), return the partial route
// that represents the progress. Interpolates the last segment.
export function partialRoute(route: LngLat[], miles: number): LngLat[] {
  const cum = cumulativeDistances(route);
  const total = cum[cum.length - 1];
  if (miles <= 0) return [route[0]];
  if (miles >= total) return route;

  const result: LngLat[] = [route[0]];
  for (let i = 1; i < route.length; i++) {
    if (cum[i] < miles) {
      result.push(route[i]);
      continue;
    }
    const segLen = cum[i] - cum[i - 1];
    const t = (miles - cum[i - 1]) / segLen;
    const a = route[i - 1];
    const b = route[i];
    result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    break;
  }
  return result;
}
