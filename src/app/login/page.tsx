"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";

const linkedInEnabled = process.env.NEXT_PUBLIC_LINKEDIN_ENABLED === "true";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't create account");
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) throw new Error("Incorrect email or password");
      window.location.href = "/";
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", padding: 24 }}>
      <h1>Welcome to IROBO</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        {mode === "signin" ? "Sign in to build your tailored CV." : "Create an account to get started."}
      </p>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
        {mode === "signup" && (
          <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} style={{ padding: 10 }} />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: 10 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          style={{ padding: 10 }}
        />
        {error && <div style={{ color: "#c0392b", fontSize: 13 }}>{error}</div>}
        <button type="submit" disabled={busy} style={{ padding: 10, background: "#2E74B5", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
      <div style={{ textAlign: "center", marginTop: 12, fontSize: 13 }}>
        {mode === "signin" ? (
          <>Don't have an account? <button onClick={() => setMode("signup")} style={{ color: "#2E74B5", background: "none", border: "none", cursor: "pointer" }}>Create one</button></>
        ) : (
          <>Already have an account? <button onClick={() => setMode("signin")} style={{ color: "#2E74B5", background: "none", border: "none", cursor: "pointer" }}>Sign in</button></>
        )}
      </div>
      {linkedInEnabled && (
        <>
          <div style={{ textAlign: "center", margin: "16px 0", color: "#999" }}>or</div>
          <button onClick={() => signIn("linkedin", { callbackUrl: "/" })} style={{ width: "100%", padding: 10, background: "#0A66C2", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
            Sign in with LinkedIn
          </button>
        </>
      )}
    </div>
  );
}
