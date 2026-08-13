import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IROBO — Recruitment Ecosystem",
  description: "One profile, AI-tailored CVs per job, and a dashboard to track it all.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="wrap">
          <h1>IROBO — Recruitment Ecosystem</h1>
          <div className="sub">One-time profile → paste/upload a job → AI-tailored CV & interview prep → dashboard.</div>
          <nav>
            <a href="/">1. Profile</a>
            <a href="/jobs">2. Add a Job</a>
            <a href="/dashboard">3. Dashboard</a>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
