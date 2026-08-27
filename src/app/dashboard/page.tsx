"use client";
import { useEffect, useState } from "react";

type Job = {
  id: number;
  company: string | null;
  title: string | null;
  orgUrl: string | null;
  status: string;
  matchScore: number | null;
  tailoredSummary: string | null;
  tailoredBullets: string[];
  missingKeywords: string[];
  interviewQuestions: string[];
  talkingPoints: string[];
  createdAt: string;
};

const STATUSES = ["tailored", "applied", "interviewing", "offer", "closed"];

function scoreClass(score: number) {
  if (score >= 75) return "high";
  if (score >= 50) return "mid";
  return "low";
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [active, setActive] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/jobs").then((r) => r.json()).then((data) => { setJobs(data); setLoading(false); });
  }
  useEffect(load, []);

  async function updateStatus(id: number, status: string) {
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  if (loading) return <div className="card">Loading…</div>;

  const total = jobs.length;
  const applied = jobs.filter((j) => j.status !== "tailored").length;
  const companies = new Set(jobs.map((j) => j.company)).size;
  const avgScore = total ? Math.round(jobs.reduce((s, j) => s + (j.matchScore || 0), 0) / total) : 0;

  return (
    <>
      <div className="stats">
        <div className="stat"><div className="num">{total}</div><div className="lbl">Jobs processed</div></div>
        <div className="stat"><div className="num">{applied}</div><div className="lbl">Applied</div></div>
        <div className="stat"><div className="num">{companies}</div><div className="lbl">Companies</div></div>
        <div className="stat"><div className="num">{total ? avgScore + "%" : "—"}</div><div className="lbl">Avg match score</div></div>
      </div>

      <div className="card">
        <h2>Dashboard</h2>
        {!jobs.length ? (
          <div className="empty">No jobs processed yet — go to "Upload & Match" to get started.</div>
        ) : (
          <table>
            <thead><tr><th>Job title</th><th>Company</th><th>Date</th><th>Match</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>{j.title}</td>
                  <td>{j.company}</td>
                  <td>{new Date(j.createdAt).toISOString().slice(0, 10)}</td>
                  <td>{j.matchScore != null ? <span className={`score ${scoreClass(j.matchScore)}`}>{j.matchScore}%</span> : "—"}</td>
                  <td>
                    <select value={j.status} onChange={(e) => updateStatus(j.id, e.target.value)}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </td>
                  <td><button className="link-btn" onClick={() => setActive(j)}>View CV & prep</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {active && (
        <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) setActive(null); }}>
          <div className="modal">
            <button className="close-x" onClick={() => setActive(null)}>✕</button>
            <h3>{active.title} — {active.company}</h3>
            <div className="meta">
              Processed {new Date(active.createdAt).toISOString().slice(0, 10)} · Match score: {active.matchScore != null ? active.matchScore + "%" : "n/a"}
              {active.orgUrl && <> · <a href={active.orgUrl} target="_blank" rel="noopener noreferrer">Open on company site ↗</a></>}
            </div>
            <h4>Tailored professional summary</h4>
            <p>{active.tailoredSummary || "—"}</p>
            <h4>Tailored resume bullets</h4>
            <ul>{active.tailoredBullets?.length ? active.tailoredBullets.map((b, i) => <li key={i}>{b}</li>) : <li>—</li>}</ul>
            <h4>Keywords missing from your profile</h4>
            <ul>{active.missingKeywords?.length ? active.missingKeywords.map((k, i) => <li key={i}>{k}</li>) : <li>None flagged</li>}</ul>
            <h4>Likely interview questions</h4>
            <ul>{active.interviewQuestions?.length ? active.interviewQuestions.map((q, i) => <li key={i}>{q}</li>) : <li>—</li>}</ul>
            <h4>Suggested talking points</h4>
            <ul>{active.talkingPoints?.length ? active.talkingPoints.map((t, i) => <li key={i}>{t}</li>) : <li>—</li>}</ul>
          </div>
        </div>
      )}
    </>
  );
}
