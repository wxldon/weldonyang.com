import { Metadata } from "next";
import { getNearbyFireCameras, SCOUT_CENTER } from "@/lib/cameras";
import { getNearbyWindStations, getSpotWinds, type WindStation, type WindSpot } from "@/lib/wind";
import { getNearbyBuoyCams, type BuoyCam } from "@/lib/buoy-cams";
import { DESTINATION_CAMS } from "@/lib/destination-cams";
import { getWeatherSummary, type WeatherSummary } from "@/lib/weather";
import BikingScoutingContent from "./BikingScoutingContent";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Biking Scouting Report — Weldon Yang",
  description:
    "Live fire-watch tower cameras and wind readings within 75 miles of San Francisco — quick conditions check before a ride.",
};

export default async function BikingScoutingPage() {
  let cameras;
  try {
    cameras = await getNearbyFireCameras();
  } catch {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          color: "#fff",
        }}
      >
        <p style={{ opacity: 0.5, fontSize: "1.125rem" }}>
          Couldn{"’"}t reach the ALERTCalifornia camera network. Try again in a bit.
        </p>
      </main>
    );
  }

  const [winds, spotWinds, buoys, weather]: [
    WindStation[],
    WindSpot[],
    BuoyCam[],
    WeatherSummary | null,
  ] = await Promise.all([
    getNearbyWindStations().catch(() => [] as WindStation[]),
    getSpotWinds().catch(() => [] as WindSpot[]),
    getNearbyBuoyCams().catch(() => [] as BuoyCam[]),
    getWeatherSummary().catch(() => null),
  ]);

  return (
    <BikingScoutingContent
      cameras={cameras}
      winds={winds}
      spotWinds={spotWinds}
      buoys={buoys}
      destinations={DESTINATION_CAMS}
      weather={weather}
      center={SCOUT_CENTER}
      serverNowMs={Date.now()}
    />
  );
}
