import { Metadata } from "next";
import { getNearbyFireCameras, SCOUT_CENTER } from "@/lib/cameras";
import BikingScoutingContent from "./BikingScoutingContent";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Biking Scouting Report — Weldon Yang",
  description:
    "Live fire-watch tower cameras within 75 miles of San Francisco — quick visibility check before a ride.",
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

  return <BikingScoutingContent cameras={cameras} center={SCOUT_CENTER} />;
}
