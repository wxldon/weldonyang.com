"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useRef, useState } from "react";
import type { Camera } from "@/lib/cameras";
import type { BuoyCam } from "@/lib/buoy-cams";
import type { WindStation, WindSpot } from "@/lib/wind";

const SF_CENTER: [number, number] = [37.7749, -122.4194];

function windColor(mph: number): string {
  if (mph < 6) return "#22c55e";
  if (mph < 14) return "#facc15";
  if (mph < 22) return "#f97316";
  return "#ef4444";
}

function cameraMarkerHtml(): string {
  return `<div class="bsr-cam-pin"></div>`;
}

function buoyMarkerHtml(b: BuoyCam): string {
  return `<div class="bsr-buoy-pin" title="${b.shortName}">
    <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
      <path d="M2 8 Q4 6 7 8 T12 8" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M2 11 Q4 9 7 11 T12 11" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.6"/>
    </svg>
  </div>`;
}

function windMarkerHtml(w: WindStation): string {
  const color = windColor(w.windMph);
  const arrowDeg = (w.directionDeg ?? 0) + 180;
  const hasDir = w.directionDeg != null && w.windMph > 0;
  return `
    <div class="bsr-wind-pill" style="--wind-color:${color}">
      ${
        hasDir
          ? `<svg class="bsr-wind-arrow" style="transform: rotate(${arrowDeg}deg)" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M5 0 L9 8 L5 6 L1 8 Z" fill="currentColor" />
            </svg>`
          : `<span class="bsr-wind-calm" aria-hidden="true">·</span>`
      }
      <span class="bsr-wind-mph">${w.windMph}</span>
    </div>
  `;
}

function spotMarkerHtml(s: WindSpot): string {
  const color = windColor(s.windMph);
  const arrowDeg = (s.directionDeg ?? 0) + 180;
  const hasDir = s.directionDeg != null && s.windMph > 0;
  return `
    <div class="bsr-wind-pill bsr-wind-pill--spot" style="--wind-color:${color}">
      ${
        hasDir
          ? `<svg class="bsr-wind-arrow" style="transform: rotate(${arrowDeg}deg)" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M5 0 L9 8 L5 6 L1 8 Z" fill="currentColor" />
            </svg>`
          : `<span class="bsr-wind-calm" aria-hidden="true">·</span>`
      }
      <span class="bsr-wind-mph">${s.windMph}</span>
    </div>
  `;
}

interface MapBundle {
  L: typeof Leaflet;
  map: Leaflet.Map;
  layers: {
    cam: Leaflet.LayerGroup;
    wind: Leaflet.LayerGroup;
    spot: Leaflet.LayerGroup;
    buoy: Leaflet.LayerGroup;
  };
}

export default function ScoutingMap({
  cameras,
  winds,
  spotWinds,
  buoys,
  onSelectCamera,
  onSelectBuoy,
  onSelectSpot,
}: {
  cameras: Camera[];
  winds: WindStation[];
  spotWinds: WindSpot[];
  buoys: BuoyCam[];
  onSelectCamera: (c: Camera) => void;
  onSelectBuoy: (b: BuoyCam) => void;
  onSelectSpot: (s: WindSpot) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapBundle | null>(null);
  const fittedRef = useRef(false);
  const [ready, setReady] = useState(false);

  // Keep callbacks in a ref so the marker render effect doesn't need them
  // as deps (they change identity on every parent render).
  const cbRef = useRef({ onSelectCamera, onSelectBuoy, onSelectSpot });
  cbRef.current = { onSelectCamera, onSelectBuoy, onSelectSpot };

  // ---- Map init: runs once on mount ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      const el = containerRef.current;
      if (cancelled || !el) return;
      // Strict-mode double-mount guard: skip if Leaflet already attached.
      const elWithLeaflet = el as HTMLDivElement & { _leaflet_id?: number };
      if (elWithLeaflet._leaflet_id != null) return;

      const map = L.map(el, {
        center: SF_CENTER,
        zoom: 9,
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false,
      });
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          subdomains: "abcd",
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
      ).addTo(map);

      mapRef.current = {
        L,
        map,
        layers: {
          // Order matters — first added sits visually below.
          buoy: L.layerGroup().addTo(map),
          cam: L.layerGroup().addTo(map),
          wind: L.layerGroup().addTo(map),
          spot: L.layerGroup().addTo(map),
        },
      };
      setReady(true);
    })();

    return () => {
      cancelled = true;
      const bundle = mapRef.current;
      mapRef.current = null;
      fittedRef.current = false;
      if (bundle) {
        try {
          bundle.map.remove();
        } catch {
          /* leaflet sometimes throws on tear-down — safe to ignore */
        }
      }
      setReady(false);
    };
  }, []);

  // ---- Marker render: runs on data changes after init ----
  useEffect(() => {
    const bundle = mapRef.current;
    if (!ready || !bundle) return;
    const { L, map, layers } = bundle;

    layers.cam.clearLayers();
    layers.wind.clearLayers();
    layers.spot.clearLayers();
    layers.buoy.clearLayers();

    for (const b of buoys) {
      const icon = L.divIcon({
        className: "bsr-buoy-icon",
        html: buoyMarkerHtml(b),
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const marker = L.marker([b.lat, b.lng], { icon, title: b.shortName }).addTo(layers.buoy);
      marker.on("click", () => cbRef.current.onSelectBuoy(b));
    }

    for (const c of cameras) {
      const icon = L.divIcon({
        className: "bsr-cam-icon",
        html: cameraMarkerHtml(),
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      const marker = L.marker([c.lat, c.lng], { icon, title: c.name }).addTo(layers.cam);
      marker.on("click", () => cbRef.current.onSelectCamera(c));
    }

    for (const w of winds) {
      const icon = L.divIcon({
        className: "bsr-wind-icon",
        html: windMarkerHtml(w),
        iconSize: [44, 22],
        iconAnchor: [22, 11],
      });
      const popup = `
        <strong>${w.name}</strong><br/>
        ${w.windMph} mph${w.directionLabel ? ` from ${w.directionLabel}` : ""}${
          w.gustMph ? ` · gusts ${w.gustMph}` : ""
        }${w.tempF != null ? ` · ${Math.round(w.tempF)}°F` : ""}
      `;
      L.marker([w.lat, w.lng], { icon, title: w.name })
        .bindPopup(popup)
        .addTo(layers.wind);
    }

    for (const s of spotWinds) {
      const icon = L.divIcon({
        className: "bsr-spot-icon",
        html: spotMarkerHtml(s),
        iconSize: [44, 22],
        iconAnchor: [22, 11],
      });
      const marker = L.marker([s.lat, s.lng], {
        icon,
        title: s.name,
        zIndexOffset: 200,
      }).addTo(layers.spot);
      marker.on("click", () => cbRef.current.onSelectSpot(s));
    }

    // Fit-to-bounds only on the first paint; subsequent data refreshes
    // shouldn't re-zoom and yank the user's view around.
    if (!fittedRef.current) {
      const allLatLngs: [number, number][] = [
        ...cameras.map((c) => [c.lat, c.lng] as [number, number]),
        ...winds.map((w) => [w.lat, w.lng] as [number, number]),
        ...spotWinds.map((s) => [s.lat, s.lng] as [number, number]),
        ...buoys.map((b) => [b.lat, b.lng] as [number, number]),
      ];
      if (allLatLngs.length > 0) {
        map.fitBounds(L.latLngBounds(allLatLngs), { padding: [40, 40] });
        map.setZoom(map.getZoom() + 1);
        fittedRef.current = true;
      }
    }
  }, [ready, cameras, winds, spotWinds, buoys]);

  return <div ref={containerRef} className="bsr-map" />;
}
