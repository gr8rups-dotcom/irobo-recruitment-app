import "./globals.css";
import type { Metadata } from "next";
import Providers, { AuthNav } from "./providers";

export const metadata: Metadata = {
  title: "IROBO — Recruitment Ecosystem",
  description: "Upload your CV, paste a job, get an AI-tailored CV and interview prep back.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="wrap">
            <h1>IROBO — Recruitment Ecosystem</h1>
            <div className="sub">Upload your CV, paste or upload a job description, get a tailored CV & interview prep back.</div>
            <AuthNav />
            <nav>
              <a href="/">1. Upload & Match</a>
              <a href="/dashboard">2. Dashboard</a>
              <a href="/settings">Settings</a>
            </nav>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
