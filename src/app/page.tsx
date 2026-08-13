"use client";
import { useEffect, useState } from "react";

export default function ProfilePage() {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [background, setBackground] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((p) => {
        if (p) {
          setName(p.name || "");
          setTitle(p.title || "");
          setBackground(p.background || "");
          setSaved(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!background.trim()) {
      alert("Add at least a short background summary before saving.");
      return;
    }
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, title, background }),
    });
    if (res.ok) setSaved(true);
  }

  if (loading) return <div className="card">Loading…</div>;

  return (
    <div className="card">
      <h2>Your Profile {saved && <span style={{ color: "#1a7d3c", fontWeight: 400, fontSize: 11 }}>✓ saved</span>}</h2>
      <label>Full name</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anamitra Roy" />
      <label>Target job title(s)</label>
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Product Manager, Senior PM" />
      <label>Background (paste resume text, or summarize experience, skills, education)</label>
      <textarea
        className="large"
        value={background}
        onChange={(e) => setBackground(e.target.value)}
        placeholder="Paste your resume text here, or write: 5 years in product management at X, led Y, skills in Z, MBA from..."
      />
      <button className="btn" onClick={save}>Save profile</button>
      <div className="notice">This is stored in your own database (SQLite locally, Postgres in production) — not shared anywhere else.</div>
    </div>
  );
}
