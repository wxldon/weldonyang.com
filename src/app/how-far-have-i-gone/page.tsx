import { getStravaStats } from "@/lib/strava";
import { Metadata } from "next";
import HowFarContent from "./HowFarContent";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "How Far Have I Gone? — Weldon Yang",
  description:
    "Live Strava stats — running, cycling, and swimming distances, times, and elevation gains.",
};

export default async function HowFarHaveIGonePage() {
  let stats;

  try {
    stats = await getStravaStats();
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
          Failed to load Strava data. Try again later.
        </p>
      </main>
    );
  }

  return <HowFarContent stats={stats} />;
}
