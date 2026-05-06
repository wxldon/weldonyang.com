import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActivityById, getStreamsForActivity } from "@/lib/db";
import { toLocalDateStr } from "@/lib/dates";
import ActivityDetailContent from "./ActivityDetailContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Activity — My Coach",
  robots: { index: false, follow: false },
};

const MAX_POINTS = 400;

interface DecimatedStreams {
  time?: number[];
  heartrate?: number[];
  watts?: number[];
  cadence?: number[];
  velocity_smooth?: number[];
  altitude?: number[];
  distance?: number[];
}

function decimate(arr: number[] | undefined, target: number): number[] | undefined {
  if (!arr || arr.length === 0) return undefined;
  if (arr.length <= target) return arr;
  const step = arr.length / target;
  const out: number[] = [];
  for (let i = 0; i < target; i++) {
    out.push(arr[Math.floor(i * step)]);
  }
  return out;
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) notFound();

  const activity = await getActivityById(numId);
  if (!activity) notFound();

  const rawStreams = await getStreamsForActivity(numId);

  const streams: DecimatedStreams = {};
  if (rawStreams) {
    const get = (k: string): number[] | undefined => {
      const s = rawStreams[k];
      if (!s || !Array.isArray(s.data)) return undefined;
      return s.data as number[];
    };
    streams.time = decimate(get("time"), MAX_POINTS);
    streams.heartrate = decimate(get("heartrate"), MAX_POINTS);
    streams.watts = decimate(get("watts"), MAX_POINTS);
    streams.cadence = decimate(get("cadence"), MAX_POINTS);
    streams.velocity_smooth = decimate(get("velocity_smooth"), MAX_POINTS);
    streams.altitude = decimate(get("altitude"), MAX_POINTS);
    streams.distance = decimate(get("distance"), MAX_POINTS);
  }

  const localDate = toLocalDateStr(activity.start_date);

  return (
    <ActivityDetailContent
      activity={activity}
      streams={streams}
      localDate={localDate}
    />
  );
}
