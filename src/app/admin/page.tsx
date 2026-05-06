import { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import AdminLoginContent from "./AdminLoginContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin — Weldon Yang",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const admin = await isAdmin();
  return <AdminLoginContent alreadyAdmin={admin} />;
}
