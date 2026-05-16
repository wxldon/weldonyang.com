import { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import { getWheelPartitions } from "@/lib/wheel";
import SpinTheWheelContent from "./SpinTheWheelContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Spin the Wheel — Weldon Yang",
  description: "Spin a virtual wheel.",
};

export default async function SpinTheWheelPage() {
  const [partitions, admin] = await Promise.all([
    getWheelPartitions().catch(() => []),
    isAdmin(),
  ]);

  return <SpinTheWheelContent initialPartitions={partitions} isAdmin={admin} />;
}
