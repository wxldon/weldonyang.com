"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import {
  haversine,
  SF_BAY_PERIMETER,
  type LngLat,
} from "@/lib/routes";

const WIDTH = 900;
const HEIGHT = 520;
const DRAW_MS = 5000;
const ZOOM_IN_MS = 600;
const ZOOM_OUT_MS = 1200;

interface Props {
  traveledMiles: number;
  accentColor?: string;
}

type Phase = "idle" | "zoomIn" | "drawing" | "zoomOut" | "done";

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Perimeter length (one loop) in miles
function perimeterLength(route: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    total += haversine(route[i - 1], route[i]);
  }
  return total;
}

// Build a path that wraps around the perimeter N times for a given total distance
function buildLappedPath(
  perimeter: LngLat[],
  miles: number
): { points: LngLat[]; loops: number } {
  const loopLen = perimeterLength(perimeter);
  if (miles <= 0) return { points: [perimeter[0]], loops: 0 };

  let remaining = miles;
  const out: LngLat[] = [perimeter[0]];
  let loops = 0;

  while (remaining > 0) {
    for (let i = 1; i < perimeter.length; i++) {
      const segLen = haversine(perimeter[i - 1], perimeter[i]);
      if (remaining >= segLen) {
        out.push(perimeter[i]);
        remaining -= segLen;
      } else {
        const t = remaining / segLen;
        const a = perimeter[i - 1];
        const b = perimeter[i];
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        remaining = 0;
        break;
      }
    }
    if (remaining > 0) loops += 1;
  }
  return { points: out, loops };
}

export default function BayMap({ traveledMiles, accentColor = "#3b82f6" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [viewBox, setViewBox] = useState<[number, number, number, number]>([
    0,
    0,
    WIDTH,
    HEIGHT,
  ]);
  const [drawProgress, setDrawProgress] = useState(0);

  const loopMiles = useMemo(() => perimeterLength(SF_BAY_PERIMETER), []);

  // Build projection that fits the full bay
  const { projection, pathGen, projectedPerimeter } = useMemo(() => {
    const proj = geoMercator();
    // Fit to the bay perimeter bounds
    const bayFeature = {
      type: "Feature" as const,
      geometry: {
        type: "Polygon" as const,
        coordinates: [SF_BAY_PERIMETER],
      },
      properties: {},
    };
    proj.fitExtent(
      [
        [40, 40],
        [WIDTH - 40, HEIGHT - 40],
      ],
      bayFeature
    );
    const gen = geoPath(proj);
    const projected = SF_BAY_PERIMETER.map((p) => proj(p)).filter(
      (p): p is [number, number] => p !== null
    );
    return { projection: proj, pathGen: gen, projectedPerimeter: projected };
  }, []);

  // Build the traveled (possibly multi-lap) path
  const { traveledPixels, traveledLen, loops, loopProgress } = useMemo(() => {
    const { points, loops } = buildLappedPath(SF_BAY_PERIMETER, traveledMiles);
    const pixels = points
      .map((p) => projection(p))
      .filter((p): p is [number, number] => p !== null);
    let len = 0;
    for (let i = 1; i < pixels.length; i++) {
      len += Math.hypot(
        pixels[i][0] - pixels[i - 1][0],
        pixels[i][1] - pixels[i - 1][1]
      );
    }
    const frac = loopMiles > 0 ? (traveledMiles % loopMiles) / loopMiles : 0;
    return {
      traveledPixels: pixels,
      traveledLen: len,
      loops,
      loopProgress: frac,
    };
  }, [traveledMiles, projection, loopMiles]);

  // Zoom bounds
  const { startView, endView } = useMemo(() => {
    const start = projectedPerimeter[0];
    const end: [number, number, number, number] = [0, 0, WIDTH, HEIGHT];
    if (!start) return { startView: end, endView: end };
    const zoomW = WIDTH / 4;
    const zoomH = HEIGHT / 4;
    const startV: [number, number, number, number] = [
      Math.max(0, start[0] - zoomW / 2),
      Math.max(0, start[1] - zoomH / 2),
      zoomW,
      zoomH,
    ];
    return { startView: startV, endView: end };
  }, [projectedPerimeter]);

  // Trigger on scroll into view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && phase === "idle") {
          setPhase("zoomIn");
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [phase]);

  // Animation timeline
  useEffect(() => {
    if (phase === "idle" || phase === "done") return;

    let raf = 0;
    const start = performance.now();

    if (phase === "zoomIn") {
      setViewBox(endView);
      const from = endView;
      const to = startView;
      const tick = (now: number) => {
        const t = Math.min((now - start) / ZOOM_IN_MS, 1);
        const e = easeInOutCubic(t);
        setViewBox([
          lerp(from[0], to[0], e),
          lerp(from[1], to[1], e),
          lerp(from[2], to[2], e),
          lerp(from[3], to[3], e),
        ]);
        if (t < 1) raf = requestAnimationFrame(tick);
        else setPhase("drawing");
      };
      raf = requestAnimationFrame(tick);
    } else if (phase === "drawing") {
      const from = startView;
      const to = endView;
      const tick = (now: number) => {
        const t = Math.min((now - start) / DRAW_MS, 1);
        setDrawProgress(t);
        const camT = Math.min(t * 1.1, 1);
        const camE = easeInOutCubic(camT);
        setViewBox([
          lerp(from[0], to[0], camE),
          lerp(from[1], to[1], camE),
          lerp(from[2], to[2], camE),
          lerp(from[3], to[3], camE),
        ]);
        if (t < 1) raf = requestAnimationFrame(tick);
        else setPhase("zoomOut");
      };
      raf = requestAnimationFrame(tick);
    } else if (phase === "zoomOut") {
      const from = viewBox;
      const to = endView;
      const tick = (now: number) => {
        const t = Math.min((now - start) / ZOOM_OUT_MS, 1);
        const e = easeInOutCubic(t);
        setViewBox([
          lerp(from[0], to[0], e),
          lerp(from[1], to[1], e),
          lerp(from[2], to[2], e),
          lerp(from[3], to[3], e),
        ]);
        if (t < 1) raf = requestAnimationFrame(tick);
        else setPhase("done");
      };
      raf = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startPx = projectedPerimeter[0];
  const tipPx =
    traveledPixels.length > 0 ? traveledPixels[traveledPixels.length - 1] : null;

  const perimeterPath =
    projectedPerimeter.length > 1
      ? "M" + projectedPerimeter.map((p) => `${p[0]},${p[1]}`).join("L") + "Z"
      : "";

  const traveledPath =
    traveledPixels.length > 1
      ? "M" + traveledPixels.map((p) => `${p[0]},${p[1]}`).join("L")
      : "";

  const vb = viewBox.join(" ");

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: `${WIDTH} / ${HEIGHT}`,
          borderRadius: 16,
          overflow: "hidden",
          background: "#f5ead0", // land
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <svg
          viewBox={vb}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block" }}
        >
          {/* Water fill */}
          {perimeterPath && (
            <path
              d={perimeterPath}
              fill="#c9e4ff"
              stroke="#2e2a24"
              strokeWidth={0.8}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {/* Perimeter ghost line (shows the full loop path) */}
          {perimeterPath && (
            <path
              d={perimeterPath}
              fill="none"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth={1.2}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {/* Traveled path */}
          {traveledPath && (
            <path
              d={traveledPath}
              fill="none"
              stroke={accentColor}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{
                strokeDasharray: traveledLen,
                strokeDashoffset:
                  phase === "drawing"
                    ? traveledLen * (1 - drawProgress)
                    : phase === "zoomOut" || phase === "done"
                    ? 0
                    : traveledLen,
              }}
            />
          )}
          {/* Start marker */}
          {startPx && (
            <circle
              cx={startPx[0]}
              cy={startPx[1]}
              r={4}
              fill={accentColor}
              stroke="#fff"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {/* Tip marker */}
          {tipPx && phase === "drawing" && (
            <circle cx={tipPx[0]} cy={tipPx[1]} r={3} fill={accentColor}>
              <animate
                attributeName="r"
                values="3;5;3"
                dur="1s"
                repeatCount="indefinite"
              />
            </circle>
          )}
        </svg>

        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(30,24,15,0.85)",
            fontWeight: 600,
            pointerEvents: "none",
          }}
        >
          San Francisco Bay
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            right: 16,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            color: "rgba(30,24,15,0.9)",
            pointerEvents: "none",
          }}
        >
          <div>
            <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: "0.08em" }}>
              LAPS COMPLETED
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
              {loops}
              <span style={{ fontSize: 14, fontWeight: 400, opacity: 0.7 }}>
                {" "}
                + {(loopProgress * 100).toFixed(0)}% of next
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: "0.08em" }}>
              DISTANCE
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: accentColor }}>
              {traveledMiles.toFixed(1)} mi
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
