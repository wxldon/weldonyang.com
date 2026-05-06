"use client";

import { useState } from "react";
import Link from "next/link";

export default function AdminLoginContent({ alreadyAdmin }: { alreadyAdmin: boolean }) {
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      window.location.href = "/my-coach";
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
      <div style={{ maxWidth: 360, margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Admin</h1>

        {alreadyAdmin ? (
          <>
            <p style={{ opacity: 0.7, marginBottom: "1rem" }}>You&apos;re signed in.</p>
            <button onClick={logout} style={btnSecondary}>Sign out</button>
          </>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <input
              type="password"
              autoComplete="off"
              placeholder="admin token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
                padding: "0.625rem 0.875rem",
                borderRadius: 6,
                fontSize: "0.9375rem",
                fontFamily: "monospace",
              }}
            />
            <button type="submit" disabled={pending || !token} style={btnPrimary}>
              {pending ? "checking…" : "sign in"}
            </button>
            {error && <p style={{ color: "#f87171", fontSize: "0.875rem" }}>{error}</p>}
          </form>
        )}

        <div style={{ marginTop: "2rem" }}>
          <Link href="/my-coach" style={{ opacity: 0.5, fontSize: "0.875rem" }}>← my coach</Link>
        </div>
      </div>
    </main>
  );
}

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
};
