import { buildResumePdf } from "./src/lib/pdf-generator";
import * as fs from "fs";

const profile = {
  name: "Anamitra Halder",
  statusTag: "Immediate Joiner",
  headline: "SENIOR DATA & BI ANALYST | BUSINESS ANALYTICS | DATA QUALITY | AUTOMATION",
  location: "Dubai, UAE",
  phone: "+971 54 426 5505",
  email: "gr8rups@gmail.com",
  photoDataUrl: null,
  education: ["MBA - Supply Chain Management | NMIMS, Mumbai | 2022-2024"],
  certifications: ["Google Professional Data Analytics"],
  languages: [],
  projects: [],
};

const job = {
  tailoredHeadline: "SENIOR DATA & BI ANALYST | SAP DATA MIGRATION & GOVERNANCE SPECIALIST",
  tailoredSummary: "Test summary line.",
  skills: [{ category: "Data & BI", skills: ["Power BI", "SQL"] }],
  keyAccomplishments: ["Did a thing"],
  experience: [{ title: "Data Analyst", company: "X", location: "Y", dates: "2020-2024", bullets: ["Did stuff"] }],
};

buildResumePdf(profile as any, job as any).then((buf) => {
  fs.writeFileSync("/tmp/test-out.pdf", buf);
  console.log("wrote", buf.length, "bytes");
});
