"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminLoginContent({ alreadyAdmin }: { alreadyAdmin: boolean }) {
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookmarkUrl, setBookmarkUrl] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "invalid") {
      setError("invalid token — bookmark URL didn't match");
      const cleaned = window.location.pathname;
      window.history.replaceState({}, "", cleaned);
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        setError("invalid token");
        return;
      }
      const url = new URL("/api/admin/login", window.location.origin);
      url.searchParams.set("t", token);
      setBookmarkUrl(url.toString());
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: "3rem 1.5rem" }}>
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Admin</h1>

        {alreadyAdmin ? (
          <>
            <p style={{ opacity: 0.7, marginBottom: "1rem" }}>You&apos;re signed in.</p>
            <button onClick={logout} style={btnSecondary}>Sign out</button>
          </>
        ) : bookmarkUrl ? (
          <>
            <p style={{ opacity: 0.85, marginBottom: "0.75rem", lineHeight: 1.45 }}>
              Signed in. Bookmark this URL on every device you use — clicking it signs you in for a year, no typing required.
            </p>
            <input
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              value={bookmarkUrl}
              style={{
                ...inputStyle,
                fontSize: "0.78rem",
                wordBreak: "break-all",
              }}
            />
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(bookmarkUrl)}
                style={btnPrimary}
              >
                copy
              </button>
              <a href="/admin" style={{ ...btnSecondary, textAlign: "center" }}>continue →</a>
            </div>
          </>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <label htmlFor="admin-token" style={{ fontSize: "0.85rem", opacity: 0.65 }}>
              admin token
            </label>
            <input
              id="admin-token"
              name="admin-token"
              type="password"
              autoComplete="current-password"
              placeholder="paste your token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              style={inputStyle}
            />
            <button type="submit" disabled={pending || !token} style={btnPrimary}>
              {pending ? "checking…" : "sign in"}
            </button>
            {error && <p style={{ color: "#f87171", fontSize: "0.875rem" }}>{error}</p>}
            <p style={{ fontSize: "0.78rem", opacity: 0.5, lineHeight: 1.5, marginTop: "0.5rem" }}>
              Or skip the form: bookmark{" "}
              <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 4px", borderRadius: 3 }}>
                /api/admin/login?t=YOUR_TOKEN
              </code>
              {" "}and click it to sign in directly. Keychain / any password manager will autofill the token field above too.
            </p>
          </form>
        )}

        <div style={{ marginTop: "2rem" }}>
          <Link href="/my-coach" style={{ opacity: 0.5, fontSize: "0.875rem" }}>← my coach</Link>
        </div>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#fff",
  padding: "0.625rem 0.875rem",
  borderRadius: 6,
  fontSize: "0.9375rem",
  fontFamily: "monospace",
  width: "100%",
  boxSizing: "border-box",
};

const btnPrimary: React.CSSProperties = {
  background: "#8b5cf6",
  color: "#fff",
  border: "none",
  padding: "0.625rem 1.25rem",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: "0.9375rem",
};

const btnSecondary: React.CSSProperties = {
  background: "transparent",
  color: "#8b5cf6",
  border: "1px solid #8b5cf6",
  padding: "0.625rem 1.25rem",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: "0.9375rem",
  textDecoration: "none",
};
