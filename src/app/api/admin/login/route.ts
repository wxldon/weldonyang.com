import { NextRequest, NextResponse } from "next/server";
import { setAdminCookie } from "@/lib/auth";

function check(token: string | undefined | null): string | null {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return null;
  if (!token || token !== expected) return null;
  return expected;
}

export async function POST(req: NextRequest) {
  const { token } = (await req.json()) as { token?: string };
  const expected = process.env.ADMIN_TOKEN;

  if (!expected) {
    return NextResponse.json({ error: "admin not configured" }, { status: 500 });
  }
  const ok = check(token);
  if (!ok) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  setAdminCookie(res, ok);
  return res;
}

// Bookmark-friendly sign-in:
//   https://<host>/api/admin/login?t=<token>[&to=<path>]
// Saves the cookie and 302s to `to` (default /admin). This is the easy
// path for a single-admin personal site — bookmark the URL once, click
// to sign in.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  const expected = process.env.ADMIN_TOKEN;

  if (!expected) {
    return NextResponse.json({ error: "admin not configured" }, { status: 500 });
  }
  const ok = check(token);
  if (!ok) {
    // Send back to /admin with an error flag rather than a 401 body, so
    // the URL is still usable from a bookmark.
    return NextResponse.redirect(new URL("/admin?error=invalid", url.origin));
  }

  // Whitelist the destination to relative paths only.
  const rawTo = url.searchParams.get("to");
  const to = rawTo && rawTo.startsWith("/") && !rawTo.startsWith("//") ? rawTo : "/admin";

  const res = NextResponse.redirect(new URL(to, url.origin));
  setAdminCookie(res, ok);
  return res;
}
