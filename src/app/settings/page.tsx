"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/settings/api-key")
      .then((r) => (r.ok ? r.json() : { hasKey: false }))
      .then((d) => setHasKey(!!d.hasKey))
      .catch(() => setHasKey(false));
  }, []);

  async function save() {
    setError("");
    setSuccess("");
    if (!apiKey.trim()) {
      setError("Paste your API key first.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save key.");
        return;
      }
      setHasKey(true);
      setApiKey("");
      setSuccess("Key saved. You're ready to extract profiles and generate tailored CVs.");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await fetch("/api/settings/api-key", { method: "DELETE" });
      setHasKey(false);
      setSuccess("Key removed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h2>Your Anthropic API key</h2>
      <p className="notice" style={{ marginBottom: 12, fontSize: 12 }}>
        IROBO doesn&apos;t run on a shared platform key — every account brings its own, so profile
        extraction and CV tailoring are billed to your own Anthropic account, not the app owner&apos;s.
        Your key is encrypted before it&apos;s stored and is never shown again after saving.
      </p>

      {hasKey === null && <div className="notice">Checking…</div>}

      {hasKey === true && (
        <div>
          <div style={{ fontSize: 13, color: "#1a7d3c", fontWeight: 600, marginBottom: 10 }}>
            ✓ An API key is saved for your account.
          </div>
          <button className="btn secondary" onClick={remove} disabled={saving}>
            {saving ? "Removing…" : "Remove key"}
          </button>
        </div>
      )}

      {hasKey === false && (
        <div>
          <label>Anthropic API key</label>
          <input
            type="text"
            placeholder="sk-ant-api03-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <div className="notice">
            Don&apos;t have one?{" "}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
              Get a free key at console.anthropic.com
            </a>
            , then paste it here.
          </div>
          <button className="btn" onClick={save} disabled={saving}>
            {saving ? "Validating…" : "Save key"}
          </button>
        </div>
      )}

      {error && <div style={{ color: "#b3261e", fontSize: 12, marginTop: 10 }}>{error}</div>}
      {success && <div style={{ color: "#1a7d3c", fontSize: 12, marginTop: 10 }}>{success}</div>}
    </div>
  );
}
