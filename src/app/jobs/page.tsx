"use client";
import { useRef, useState } from "react";

export default function AddJobPage() {
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [orgUrl, setOrgUrl] = useState("");
  const [description, setDescription] = useState("");
  const [fileNotice, setFileNotice] = useState(
    ".txt / .md files load directly into the box below. For PDF/DOCX, paste the text in — this app doesn't parse binary formats yet."
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<any>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPlainText = /\.(txt|md)$/i.test(file.name) || file.type === "text/plain";
    if (!isPlainText) {
      setFileNotice(`"${file.name}" is a binary format (PDF/DOC) this app can't parse yet. Paste the text directly instead.`);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setDescription(String(ev.target?.result || ""));
      setFileNotice(`Loaded ${file.name} into the box below.`);
    };
    reader.readAsText(file);
  }

  async function generate() {
    if (!description.trim()) {
      alert("Paste or upload a job description first.");
      return;
    }
    setBusy(true);
    setStatus("Tailoring CV and preparing interview notes…");
    setResult(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, title, orgUrl, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setResult(data);
      setStatus("Done — see it below, or check the dashboard.");
      setCompany(""); setTitle(""); setOrgUrl(""); setDescription("");
      if (fileInput.current) fileInput.current.value = "";
    } catch (err: any) {
      setStatus("Error: " + (err?.message || String(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card">
        <h2>Add a Job</h2>
        <label>Company</label>
        <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Acme Corp" />
        <label>Job title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior Product Manager" />
        <label>Company's official careers page / job posting link (optional)</label>
        <input type="text" value={orgUrl} onChange={(e) => setOrgUrl(e.target.value)} placeholder="https://company.com/careers/job-id" />
        <label style={{ marginTop: 14 }}>Job description — paste text, or upload a file</label>
        <textarea className="large" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Paste the full job description text here..." />
        <input ref={fileInput} type="file" accept=".txt,.md,.pdf,.doc,.docx" onChange={handleFile} style={{ marginTop: 6, fontSize: 12 }} />
        <div className="notice">{fileNotice}</div>
        <button className="btn" disabled={busy} onClick={generate}>
          {busy && <span className="spinner" />}Generate tailored CV + interview prep
        </button>
        <div className="notice">{status}</div>
      </div>

      {result && (
        <div className="card">
          <h2>Result — {result.title || "Job"} at {result.company || "?"}</h2>
          <p><strong>Match score:</strong> {result.matchScore != null ? result.matchScore + "%" : "n/a"}</p>
          <p><strong>Summary:</strong> {result.tailoredSummary}</p>
          <p><strong>Bullets:</strong></p>
          <ul>{(JSON.parse(result.tailoredBullets || "[]")).map((b: string, i: number) => <li key={i}>{b}</li>)}</ul>
          <p>Full detail, status tracking, and interview prep live on the <a href="/dashboard">dashboard</a>.</p>
        </div>
      )}
    </>
  );
}
