import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function GET() {
  revalidatePath("/how-far-have-i-gone");
  return NextResponse.json({ revalidated: true, now: Date.now() });
}
