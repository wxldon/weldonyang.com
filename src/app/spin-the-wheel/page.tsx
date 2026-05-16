import { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import { getWheelPartitions } from "@/lib/wheel";
import { getMediaEntries } from "@/lib/media";
import SpinTheWheelContent from "./SpinTheWheelContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Spin the Wheel — Weldon Yang",
  description: "Spin a virtual wheel + personal movie/show rankings.",
};

export default async function SpinTheWheelPage() {
  const [partitions, entries, admin] = await Promise.all([
    getWheelPartitions().catch(() => []),
    getMediaEntries().catch(() => []),
    isAdmin(),
  ]);

  return (
    <SpinTheWheelContent
      initialPartitions={partitions}
      initialMedia={entries}
      isAdmin={admin}
    />
  );
}
