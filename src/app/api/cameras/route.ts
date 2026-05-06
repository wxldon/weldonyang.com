import { NextResponse } from "next/server";
import { getNearbyFireCameras } from "@/lib/cameras";

export const revalidate = 60;

export async function GET() {
  try {
    const cameras = await getNearbyFireCameras();
    return NextResponse.json(
      { cameras },
      { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
