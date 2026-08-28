const fs = require("fs");
const path = require("path");
const { buildResumePdf } = require("../pdf-generator.js");
const { buildResumeDocx } = require("../docx-generator.js");

// Extract a real photo from the original CV to test the photo+right-align layout together.
const zlib = require("zlib");
function extractLargestPhotoFromPdf(buffer) {
  const text = buffer.toString("latin1");
  const objRe = /(\d+)\s+0\s+obj([\s\S]*?)stream\r?\n/g;
  let match;
  let best = null;
  while ((match = objRe.exec(text))) {
    const dict = match[2];
    if (!/\/Subtype\s*\/Image/.test(dict)) continue;
    if (!/\/DCTDecode/.test(dict)) continue;
    const hasFlate = /\/Filter\s*(\/FlateDecode|\[[^\]]*\/FlateDecode[^\]]*\])/.test(dict);
    const streamByteStart = match.index + match[0].length;
    const lengthMatch = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
    let raw;
    if (lengthMatch) {
      const len = parseInt(lengthMatch[1], 10);
      raw = buffer.subarray(streamByteStart, streamByteStart + len);
    } else {
      const endIdx = text.indexOf("endstream", streamByteStart);
      if (endIdx === -1) continue;
      raw = buffer.subarray(streamByteStart, endIdx);
    }
    try { if (hasFlate) raw = zlib.inflateSync(raw); } catch { continue; }
    if (raw[0] === 0xff && raw[1] === 0xd8) { if (!best || raw.length > best.length) best = raw; }
  }
  return best;
}

const origCvPath = "/sessions/eager-zealous-johnson/mnt/uploads/Anamitra Halder CV'26_Data and BI Analyst.pdf";
const origBuf = fs.readFileSync(origCvPath);
const photoBuf = extractLargestPhotoFromPdf(origBuf);
const photoDataUrl = photoBuf ? `data:image/jpeg;base64,${photoBuf.toString("base64")}` : undefined;
console.log("photo extracted:", !!photoBuf, photoBuf ? photoBuf.length : 0);

const profileBase = {
  name: "Anamitra Halder",
  statusTag: "Immediate Joiner",
  headline: "SENIOR BUSINESS IMPROVEMENT & EFFICIENCY ANALYST | PROCESS OPTIMIZATION | QHSE & ISO COMPLIANCE | DATA-DRIVEN PERFORMANCE ENHANCEMENT",
  location: "Dubai, UAE",
  phone: "+971 54 426 5505",
  email: "gr8rups@gmail.com",
  education: ["MBA - Supply Chain Management | NMIMS, Mumbai | 2022-2024", "Bachelor of Accountancy - Financial Accounting | University of Calcutta | 2011-2013"],
  certifications: ["Google Professional Data Analytics", "IBM Data Science"],
  languages: ["English - Fluent", "Hindi - Fluent"],
  projects: [],
};

const job = {
  tailoredSummary: "Senior Business Improvement & Efficiency professional with 10+ years of cross-functional experience in business process optimization, data analysis, process automation, and continuous improvement.",
  skills: [{ category: "Business Process Management", skills: ["Process Mapping", "ISO Standards", "Lean Six Sigma"] }],
  keyAccomplishments: ["Led enterprise process optimization initiatives reducing operational costs by 20-30%."],
  experience: [{ title: "Data & System Analyst", company: "Mammoet FZE", location: "Dubai, UAE", dates: "May 2026 - Present", bullets: ["Transform structured and unstructured data into business insights."] }],
};

async function run() {
  const outDir = "/sessions/eager-zealous-johnson/mnt/outputs/zajel_check";

  // Case A: with photo (the fixed, intended flow)
  const pdfWithPhoto = await buildResumePdf({ ...profileBase, photoDataUrl }, job);
  fs.writeFileSync(path.join(outDir, "test_with_photo.pdf"), pdfWithPhoto);
  const docxWithPhoto = await buildResumeDocx({ ...profileBase, photoDataUrl }, job);
  fs.writeFileSync(path.join(outDir, "test_with_photo.docx"), docxWithPhoto);

  // Case B: no photo (matches the exact bug report scenario)
  const pdfNoPhoto = await buildResumePdf({ ...profileBase }, job);
  fs.writeFileSync(path.join(outDir, "test_no_photo.pdf"), pdfNoPhoto);
  const docxNoPhoto = await buildResumeDocx({ ...profileBase }, job);
  fs.writeFileSync(path.join(outDir, "test_no_photo.docx"), docxNoPhoto);

  console.log("done");
}
run().catch(e => { console.error(e); process.exit(1); });
