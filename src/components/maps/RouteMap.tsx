"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import {
  partialRoute,
  routeDistance,
  type LngLat,
} from "@/lib/routes";

const WIDTH = 900;
const HEIGHT = 520;
const DRAW_MS = 5000;
const ZOOM_IN_MS = 600;
const ZOOM_OUT_MS = 1200;

interface Props {
  route: LngLat[];
  traveledMiles: number;
  startLabel: string;
  endLabel: string;
  accentColor?: string;
}

type Phase = "idle" | "zoomIn" | "drawing" | "zoomOut" | "done";

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default function RouteMap({
  route,
  traveledMiles,
  startLabel,
  endLabel,
  accentColor = "#ff3b3b",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [viewBox, setViewBox] = useState<[number, number, number, number]>([
    0,
    0,
    WIDTH,
    HEIGHT,
  ]);
  const [drawProgress, setDrawProgress] = useState(0);
  const [states, setStates] =
    useState<FeatureCollection<Geometry> | null>(null);
  const [nation, setNation] = useState<Feature<Geometry> | null>(null);

  // Projection + path generator
  const { projection, pathGen, projectedRoute, totalMiles } = useMemo(() => {
    const proj = geoAlbersUsa().scale(1200).translate([WIDTH / 2, HEIGHT / 2]);
    const gen = geoPath(proj);
    const projected = route
      .map((p) => proj(p))
      .filter((p): p is [number, number] => p !== null);
    return {
      projection: proj,
      pathGen: gen,
      projectedRoute: projected,
      totalMiles: routeDistance(route),
    };
  }, [route]);

  // Build the traveled-only route in pixel space
  const { progressMiles, traveledPixels, traveledTotalLen } = useMemo(() => {
    const mi = Math.min(traveledMiles, totalMiles);
    const partial = partialRoute(route, mi);
    const pixels = partial
      .map((p) => projection(p))
      .filter((p): p is [number, number] => p !== null);
    // Calculate path length in pixel space for stroke-dasharray
    let len = 0;
    for (let i = 1; i < pixels.length; i++) {
      len += Math.hypot(
        pixels[i][0] - pixels[i - 1][0],
        pixels[i][1] - pixels[i - 1][1]
      );
    }
    return { progressMiles: mi, traveledPixels: pixels, traveledTotalLen: len };
  }, [route, traveledMiles, projection, totalMiles]);

  // Zoom bounds: start = tight view of origin; end = full US
  const { startView, endView } = useMemo(() => {
    const start = projectedRoute[0];
    const end: [number, number, number, number] = [0, 0, WIDTH, HEIGHT];
    if (!start) return { startView: end, endView: end };
    const zoomW = WIDTH / 5;
    const zoomH = HEIGHT / 5;
    const startV: [number, number, number, number] = [
      Math.max(0, start[0] - zoomW / 2),
      Math.max(0, start[1] - zoomH / 2),
      zoomW,
      zoomH,
    ];
    return { startView: startV, endView: end };
  }, [projectedRoute]);

  // Load US topojson once
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [statesMod, nationMod] = await Promise.all([
          import("us-atlas/states-10m.json"),
          import("us-atlas/nation-10m.json"),
        ]);
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const statesTopo: any = statesMod.default ?? statesMod;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nationTopo: any = nationMod.default ?? nationMod;
        const statesFC = feature(
          statesTopo,
          statesTopo.objects.states
        ) as unknown as FeatureCollection<Geometry>;
        const nationF = feature(
          nationTopo,
          nationTopo.objects.nation
        ) as unknown as Feature<Geometry>;
        setStates(statesFC);
        setNation(nationF);
      } catch (err) {
        console.error("Failed to load US topology", err);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Trigger animation when visible
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
      setViewBox(endView); // start at full US
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
      // While drawing, slowly pan/zoom the viewBox to follow the tip
      const from = startView;
      const to = endView;
      const tick = (now: number) => {
        const t = Math.min((now - start) / DRAW_MS, 1);
        const e = easeInOutCubic(t);
        setDrawProgress(t);
        // Camera follows with slight lag
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
      // Ensure we finish at full US view
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

  const startPx = projectedRoute[0];
  const endPx = projectedRoute[projectedRoute.length - 1];
  const tipPx =
    traveledPixels.length > 0 ? traveledPixels[traveledPixels.length - 1] : null;

  // Build SVG path for traveled route
  const traveledPath =
    traveledPixels.length > 1
      ? "M" + traveledPixels.map((p) => `${p[0]},${p[1]}`).join("L")
      : "";
  // Full route path (shown as ghost line)
  const fullPath =
    projectedRoute.length > 1
      ? "M" + projectedRoute.map((p) => `${p[0]},${p[1]}`).join("L")
      : "";

  const vb = viewBox.join(" ");
  const pct = Math.min(100, (progressMiles / totalMiles) * 100);

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: `${WIDTH} / ${HEIGHT}`,
          borderRadius: 16,
          overflow: "hidden",
          background: "#c9e4ff", // ocean
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
          {/* Nation fill */}
          {nation && (
            <path
              d={pathGen(nation) ?? undefined}
              fill="#f5ead0"
              stroke="#2e2a24"
              strokeWidth={0.8}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {/* States */}
          {states?.features.map((f, i) => (
            <path
              key={i}
              d={pathGen(f) ?? undefined}
              fill="#f5ead0"
              stroke="#2e2a24"
              strokeWidth={0.4}
              vectorEffect="non-scaling-stroke"
              opacity={0.95}
            />
          ))}
          {/* Ghost (full) route - faint dashed line */}
          {fullPath && (
            <path
              d={fullPath}
              fill="none"
              stroke="rgba(0,0,0,0.25)"
              strokeWidth={1.2}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {/* Traveled route */}
          {traveledPath && (
            <path
              d={traveledPath}
              fill="none"
              stroke={accentColor}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{
                strokeDasharray: traveledTotalLen,
                strokeDashoffset:
                  phase === "drawing"
                    ? traveledTotalLen * (1 - drawProgress)
                    : phase === "zoomOut" || phase === "done"
                    ? 0
                    : traveledTotalLen,
              }}
            />
          )}
          {/* Start marker */}
          {startPx && (
            <g>
              <circle
                cx={startPx[0]}
                cy={startPx[1]}
                r={4}
                fill={accentColor}
                stroke="#fff"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )}
          {/* End marker (Boston) */}
          {endPx && (
            <g>
              <circle
                cx={endPx[0]}
                cy={endPx[1]}
                r={3.5}
                fill="#fff"
                stroke="#2e2a24"
                strokeWidth={1.2}
                vectorEffect="non-scaling-stroke"
                opacity={phase === "done" || phase === "zoomOut" ? 1 : 0.5}
              />
            </g>
          )}
          {/* Tip marker (current position during drawing) */}
          {tipPx && phase === "drawing" && (
            <circle
              cx={tipPx[0]}
              cy={tipPx[1]}
              r={3}
              fill={accentColor}
              vectorEffect="non-scaling-stroke"
            >
              <animate
                attributeName="r"
                values="3;5;3"
                dur="1s"
                repeatCount="indefinite"
              />
            </circle>
          )}
        </svg>

        {/* Overlay labels */}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            right: 16,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(30,24,15,0.85)",
            fontWeight: 600,
            pointerEvents: "none",
          }}
        >
          <span>{startLabel}</span>
          <span>{endLabel}</span>
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
              PROGRESS
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
              {progressMiles.toFixed(0)}{" "}
              <span style={{ fontSize: 14, fontWeight: 400, opacity: 0.7 }}>
                / {totalMiles.toFixed(0)} mi
              </span>
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: accentColor }}>
            {pct.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}
