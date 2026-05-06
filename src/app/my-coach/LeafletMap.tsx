"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function LeafletMap({ latlng }: { latlng: [number, number][] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || latlng.length < 2 || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    const polyline = L.polyline(latlng as L.LatLngTuple[], {
      color: "#8b5cf6",
      weight: 3,
      opacity: 0.95,
      lineJoin: "round",
      lineCap: "round",
    }).addTo(map);

    map.fitBounds(polyline.getBounds(), { padding: [24, 24] });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [latlng]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: 320,
        borderRadius: 6,
        overflow: "hidden",
        background: "rgba(255,255,255,0.025)",
      }}
    />
  );
}
