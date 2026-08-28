"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

type SkillCat = { category: string; skills: string[] };
type ExpEntry = { title: string; company: string; location: string; dates: string; bullets: string[] };
type ProjEntry = { title: string; link: string; description: string };

function skillsToText(skills: SkillCat[]): string {
  return (skills || []).map((s) => `${s.category}: ${(s.skills || []).join(", ")}`).join("\n");
}
function textToSkills(text: string): SkillCat[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return { category: line, skills: [] };
    const category = line.slice(0, idx).trim();
    const skills = line.slice(idx + 1).split(",").map((s) => s.trim()).filter(Boolean);
    return { category, skills };
  });
}
function linesToArray(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}
function arrayToLines(arr: string[]): string {
  return (arr || []).join("\n");
}
function projectsToText(projects: ProjEntry[]): string {
  return (projects || []).map((p) => `${p.title} | ${p.link} | ${p.description}`).join("\n");
}
function textToProjects(text: string): ProjEntry[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const parts = line.split("|").map((s) => s.trim());
    return { title: parts[0] || "", link: parts[1] || "", description: parts[2] || "" };
  });
}
function experienceToText(exp: ExpEntry[]): string {
  return (exp || []).map((e) => {
    const header = `${e.title} | ${e.company} | ${e.location} | ${e.dates}`;
    const bullets = (e.bullets || []).map((b) => "- " + b).join("\n");
    return header + (bullets ? "\n" + bullets : "");
  }).join("\n\n");
}
function textToExperience(text: string): ExpEntry[] {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split("\n");
    const headerParts = lines[0].split("|").map((s) => s.trim());
    const bullets = lines.slice(1).map((l) => l.trim()).filter(Boolean).map((l) => l.replace(/^-\s*/, ""));
    return { title: headerParts[0] || "", company: headerParts[1] || "", location: headerParts[2] || "", dates: headerParts[3] || "", bullets };
  });
}

export default function LandingPage() {
  const { data: session } = useSession();
  // Left pane — CV / profile
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [background, setBackground] = useState("");
  const [cvNotice, setCvNotice] = useState("Upload a PDF, DOCX, TXT, or MD file — or just paste text below.");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const cvFileInput = useRef<HTMLInputElement>(null);

  // Extracted/reviewable profile fields
  const [statusTag, setStatusTag] = useState("");
  const [headline, setHeadline] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [educationText, setEducationText] = useState("");
  const [certificationsText, setCertificationsText] = useState("");
  const [languagesText, setLanguagesText] = useState("");
  const [projectsText, setProjectsText] = useState("");
  const [experienceText, setExperienceText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const photoFileInput = useRef<HTMLInputElement>(null);

  // Right pane — job description
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [orgUrl, setOrgUrl] = useState("");
  const [description, setDescription] = useState("");
  const [jdNotice, setJdNotice] = useState("Upload a PDF, DOCX, TXT, or MD file — or just paste text below.");
  const jdFileInput = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<any>(null);
  const [needsApiKey, setNeedsApiKey] = useState(false);

  useEffect(() => {
    if (session?.user?.name && !name) setName(session.user.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((p) => {
        if (p) {
          setName(p.name || "");
          setTitle(p.title || "");
          setBackground(p.background || "");
          setStatusTag(p.statusTag || "");
          setHeadline(p.headline || "");
          setLocation(p.location || "");
          setPhone(p.phone || "");
          setEmail(p.email || "");
          setPhotoDataUrl(p.photoDataUrl || "");
          setSkillsText(skillsToText(p.skills || []));
          setEducationText(arrayToLines(p.education || []));
          setCertificationsText(arrayToLines(p.certifications || []));
          setLanguagesText(arrayToLines(p.languages || []));
          setProjectsText(projectsToText(p.projects || []));
          setExperienceText(experienceToText(p.experience || []));
          setProfileLoaded(true);
          if ((p.skills || []).length || (p.experience || []).length) setShowReview(true);
        }
      });
  }, []);

  async function parseFile(file: File): Promise<string> {
    const data = await parseFileFull(file);
    return data.text;
  }

  async function parseFileFull(file: File): Promise<{ text: string; photoDataUrl?: string }> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/parse-document", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Couldn't parse that file.");
    return data as { text: string; photoDataUrl?: string };
  }

  async function handleCvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCvNotice(`Reading ${file.name}…`);
    try {
      const { text, photoDataUrl: extractedPhoto } = await parseFileFull(file);
      setBackground(text);
      // If the CV itself has a photo embedded (most Word/PDF CVs with a
      // headshot do), pull it in automatically so the user doesn't have to
      // separately find and re-upload the same photo.
      if (extractedPhoto) setPhotoDataUrl(extractedPhoto);
      setCvNotice(`Loaded ${file.name} (${text.length.toLocaleString()} characters)${extractedPhoto ? " — photo detected and copied in" : ""}. Now click "Extract & review profile details" below.`);
    } catch (err: any) {
      setCvNotice("Error: " + (err?.message || String(err)));
      if (cvFileInput.current) cvFileInput.current.value = "";
    }
  }

  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleJdFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setJdNotice(`Reading ${file.name}…`);
    try {
      const text = await parseFile(file);
      setDescription(text);
      setJdNotice(`Loaded ${file.name} (${text.length.toLocaleString()} characters).`);
    } catch (err: any) {
      setJdNotice("Error: " + (err?.message || String(err)));
      if (jdFileInput.current) jdFileInput.current.value = "";
    }
  }

  async function extractDetails() {
    if (!background.trim()) {
      alert("Upload or paste your CV first.");
      return;
    }
    setExtracting(true);
    setStatus("Reading your CV and pulling out structured details…");
    try {
      const res = await fetch("/api/extract-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvText: background }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "NO_API_KEY") setNeedsApiKey(true);
        throw new Error(data.error || "Extraction failed.");
      }
      setNeedsApiKey(false);
      if (data.name && !name) setName(data.name);
      setStatusTag(data.status_tag || "");
      setHeadline(data.headline || "");
      setLocation(data.location || "");
      setPhone(data.phone || "");
      setEmail(data.email || "");
      setSkillsText(skillsToText(data.skills || []));
      setEducationText(arrayToLines(data.education || []));
      setCertificationsText(arrayToLines(data.certifications || []));
      setLanguagesText(arrayToLines(data.languages || []));
      setProjectsText(projectsToText(data.projects || []));
      setExperienceText(experienceToText(data.experience || []));
      setShowReview(true);
      setStatus("Extracted — review the details below, fix anything wrong, then click Save Profile Details.");
    } catch (err: any) {
      setStatus("Error: " + (err?.message || String(err)));
    } finally {
      setExtracting(false);
    }
  }

  async function saveProfileDetails() {
    setBusy(true);
    setStatus("Saving your profile details…");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, title, background, statusTag, headline, location, phone, email, photoDataUrl,
          skills: textToSkills(skillsText),
          education: linesToArray(educationText),
          certifications: linesToArray(certificationsText),
          languages: linesToArray(languagesText),
          projects: textToProjects(projectsText),
          experience: textToExperience(experienceText),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Couldn't save profile details.");
      }
      setProfileLoaded(true);
      setStatus("Profile details saved. Now paste a job description on the right and click Match & Generate.");
    } catch (err: any) {
      setStatus("Error: " + (err?.message || String(err)));
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!background.trim()) {
      alert("Add your CV/background first (upload a file or paste text) — left pane.");
      return;
    }
    if (!description.trim()) {
      alert("Add the job description first (upload a file or paste text) — right pane.");
      return;
    }
    setBusy(true);
    setStatus("Saving your profile…");
    setResult(null);
    try {
      const profileRes = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, title, background, statusTag, headline, location, phone, email, photoDataUrl,
          skills: textToSkills(skillsText),
          education: linesToArray(educationText),
          certifications: linesToArray(certificationsText),
          projects: textToProjects(projectsText),
          experience: textToExperience(experienceText),
          languages: linesToArray(languagesText),
        }),
      });
      if (!profileRes.ok) {
        const d = await profileRes.json();
        throw new Error(d.error || "Couldn't save your profile.");
      }
      setStatus("Matching against the job and tailoring your CV…");
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, title: jobTitle, orgUrl, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "NO_API_KEY") setNeedsApiKey(true);
        throw new Error(data.error || "Something went wrong");
      }
      setNeedsApiKey(false);
      setResult(data);
      setStatus("Done — see the tailored CV below, or check the dashboard for the full history.");
    } catch (err: any) {
      setStatus("Error: " + (err?.message || String(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {needsApiKey && (
        <div className="card" style={{ borderColor: "#e0b33a", background: "#fffaf0" }}>
          <strong>Add your Anthropic API key to use AI features.</strong>{" "}
          <a href="/settings">Go to Settings →</a>
          <div className="notice">IROBO bills AI usage to each user&apos;s own key — nothing is generated until yours is saved.</div>
        </div>
      )}
      <div className="two-pane">
        <div className="card">
          <h2>Your CV {profileLoaded && <span style={{ color: "#1a7d3c", fontWeight: 400, fontSize: 11 }}>· saved profile loaded</span>}</h2>
          <label>Full name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anamitra Roy" />
          <label>Target job title(s)</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Product Manager, Senior PM" />
          <label style={{ marginTop: 14 }}>Upload your CV (PDF / DOCX), or paste it below</label>
          <input ref={cvFileInput} type="file" accept=".pdf,.doc,.docx,.txt,.md" onChange={handleCvFile} style={{ fontSize: 12 }} />
          <div className="notice">{cvNotice}</div>
          <textarea
            className="large"
            style={{ marginTop: 8 }}
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            placeholder="Your CV text will appear here after upload — or paste/type it directly."
          />
          <button type="button" className="btn" disabled={extracting} onClick={extractDetails} style={{ marginTop: 10, width: "100%" }}>
            {extracting && <span className="spinner" />}Extract &amp; review profile details
          </button>

          {showReview && (
            <div style={{ marginTop: 18, borderTop: "1px solid #ddd", paddingTop: 14 }}>
              <h3 style={{ marginBottom: 8 }}>Review your details</h3>
              <div className="notice">Fix anything the extraction got wrong before saving — this becomes your permanent profile and is reused verbatim on every tailored CV.</div>

              <label style={{ marginTop: 10 }}>Photo (optional, embedded in every generated CV)</label>
              <input ref={photoFileInput} type="file" accept="image/*" onChange={handlePhotoFile} style={{ fontSize: 12 }} />
              {photoDataUrl && <img src={photoDataUrl} alt="Your photo" style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 4, marginTop: 6 }} />}

              <label style={{ marginTop: 10 }}>Status tag (optional, e.g. "Immediate Joiner")</label>
              <input type="text" value={statusTag} onChange={(e) => setStatusTag(e.target.value)} />

              <label>Headline (shown under your name)</label>
              <input type="text" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Senior Data & BI Analyst | Business Analytics | Data Quality | Automation" />

              <label>Location</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Dubai, UAE" />

              <label>Phone</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />

              <label>Email</label>
              <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} />

              <label style={{ marginTop: 10 }}>Core skills — one category per line, format "Category: skill1, skill2, skill3"</label>
              <textarea className="large" value={skillsText} onChange={(e) => setSkillsText(e.target.value)} />

              <label>Education — one entry per line</label>
              <textarea className="large" value={educationText} onChange={(e) => setEducationText(e.target.value)} />

              <label>Certifications — one per line</label>
              <textarea className="large" value={certificationsText} onChange={(e) => setCertificationsText(e.target.value)} />

              <label>Languages — one per line, e.g. "English - Fluent"</label>
              <textarea className="large" value={languagesText} onChange={(e) => setLanguagesText(e.target.value)} />

              <label>Projects — one per line, format "Title | Link | Description"</label>
              <textarea className="large" value={projectsText} onChange={(e) => setProjectsText(e.target.value)} />

              <label>Experience — for each role: "Title | Company | Location | Dates" then bullet lines starting with "- ", blank line between roles</label>
              <textarea className="large" style={{ minHeight: 220 }} value={experienceText} onChange={(e) => setExperienceText(e.target.value)} />

              <button type="button" className="btn" disabled={busy} onClick={saveProfileDetails} style={{ marginTop: 10, width: "100%" }}>
                {busy && <span className="spinner" />}Save profile details
              </button>
            </div>
          )}
        </div>
        <div className="card">
          <h2>Job Description</h2>
          <label>Company</label>
          <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Acme Corp" />
          <label>Job title</label>
          <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Senior Product Manager" />
          <label>Company's official careers page / job posting link (optional)</label>
          <input type="text" value={orgUrl} onChange={(e) => setOrgUrl(e.target.value)} placeholder="https://company.com/careers/job-id" />
          <label style={{ marginTop: 14 }}>Upload the JD (PDF / DOCX), or paste it below</label>
          <input ref={jdFileInput} type="file" accept=".pdf,.doc,.docx,.txt,.md" onChange={handleJdFile} style={{ fontSize: 12 }} />
          <div className="notice">{jdNotice}</div>
          <textarea
            className="large"
            style={{ marginTop: 8 }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Paste the job description here — or upload a file above."
          />
        </div>
      </div>
      <div className="card">
        <button className="btn" disabled={busy} onClick={generate} style={{ width: "100%", fontSize: 14, padding: "12px 16px" }}>
          {busy && <span className="spinner" />}Match & Generate Tailored CV
        </button>
        <div className="notice" style={{ textAlign: "center", marginTop: 8 }}>{status}</div>
      </div>
      {result && (
        <div className="card">
          <h2>Result — {result.title || "Job"} at {result.company || "?"}</h2>
          <p><strong>Match score:</strong> {result.matchScore != null ? result.matchScore + "%" : "n/a"}</p>
          {result.tailoredHeadline && (
            <p><strong>Tailored title:</strong> {result.tailoredHeadline}</p>
          )}
          <p><strong>Tailored summary:</strong> {result.tailoredSummary}</p>
          <p><strong>Tailored bullets:</strong></p>
          <ul>{(result.tailoredBullets || []).map((b: string, i: number) => <li key={i}>{b}</li>)}</ul>
          <p><strong>Missing keywords</strong> (add these yourself only if they're genuinely true for you):</p>
          <ul>{(result.missingKeywords || []).map((k: string, i: number) => <li key={i}>{k}</li>)}</ul>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <a href={`/api/jobs/${result.id}/download?format=docx`} className="btn">Download Word (.docx) — review this first</a>
            <a href={`/api/jobs/${result.id}/download?format=pdf`} className="btn">Download PDF</a>
            {result.orgUrl && (
              <a href={result.orgUrl} target="_blank" rel="noopener noreferrer" className="btn">Apply →</a>
            )}
          </div>
          <p style={{ marginTop: 12 }}>Full detail, status tracking, and interview prep live on the <a href="/dashboard">dashboard</a>.</p>
        </div>
      )}
    </>
  );
}