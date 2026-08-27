import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle,
  Footer, AlignmentType,
} from "docx";

// This layout intentionally mirrors the structure of the candidate's original
// uploaded CV (photo + name header block, centered contact line, a horizontal
// rule under the header and under every section heading, all-caps section
// titles, a name|title footer on every page) rather than a generic template —
// per explicit instruction to lock the original CV's structure and reuse it.

export type ProfileData = {
  name?: string;
  statusTag?: string;
  headline?: string;
  location?: string;
  phone?: string;
  email?: string;
  photoDataUrl?: string;
  education?: string[];
  certifications?: string[];
  languages?: string[];
  projects?: { title: string; link: string; description: string }[];
};

export type JobData = {
  tailoredHeadline?: string;
  tailoredSummary?: string;
  skills?: { category: string; skills: string[] }[];
  keyAccomplishments?: string[];
  experience?: { title: string; company: string; location: string; dates: string; bullets: string[] }[];
};

function parseDataUrl(dataUrl?: string) {
  if (!dataUrl) return null;
  const match = /^data:image\/(png|jpe?g|gif|bmp);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const ext = match[1].toLowerCase();
  const type = (ext === "jpeg" ? "jpg" : ext) as "jpg" | "png" | "gif" | "bmp";
  const buffer = Buffer.from(match[2], "base64");
  return { buffer, type };
}

function noBorder() {
  return { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
}

// Saved status tags sometimes already include their own parentheses (e.g. if
// the original CV literally showed "(Immediate Joiner)" and extraction kept
// them verbatim). Strip any existing wrapping parens before we add ours, so
// we never end up with "((Immediate Joiner))".
function cleanStatusTag(tag?: string): string {
  return (tag || "").trim().replace(/^\(+/, "").replace(/\)+$/, "").trim();
}

const RULE_BORDER = { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 4 };
const HEADING_COLOR = "2E74B5";
// Sizes are in half-points (docx convention): 20 = 10pt, 18 = 9pt. HEAD_SIZE
// (10pt, the requested cap) is used only where explicitly set below — name,
// status tag, headline, section headings. Everything else inherits the
// document default of BODY_SIZE (9pt) so the CV fits 2 pages, matching the
// same split used in pdf-generator.ts.
const HEAD_SIZE = 20;
const BODY_SIZE = 18;

export async function buildResumeDocx(profile: ProfileData, job: JobData): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];
  const photo = parseDataUrl(profile.photoDataUrl);
  const headline = job.tailoredHeadline || profile.headline;

  const statusTag = cleanStatusTag(profile.statusTag);

  const nameLineRuns: TextRun[] = [
    new TextRun({ text: profile.name || "Candidate", bold: true, size: HEAD_SIZE }),
  ];
  if (statusTag) {
    nameLineRuns.push(new TextRun({ text: `   (${statusTag})`, bold: true, underline: {}, size: HEAD_SIZE }));
  }

  const nameBlock: Paragraph[] = [
    new Paragraph({ children: nameLineRuns }),
    ...(headline
      ? [new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: headline.toUpperCase(), bold: true, size: HEAD_SIZE })] })]
      : []),
  ];

  if (photo) {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: noBorder(), bottom: noBorder(), left: noBorder(), right: noBorder(), insideHorizontal: noBorder(), insideVertical: noBorder() },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 18, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: [new ImageRun({ data: photo.buffer, type: photo.type, transformation: { width: 85, height: 85 } })] })],
              }),
              new TableCell({ width: { size: 82, type: WidthType.PERCENTAGE }, children: nameBlock }),
            ],
          }),
        ],
      })
    );
  } else {
    children.push(...nameBlock);
  }

  const contactBits = [profile.location, profile.phone, profile.email].filter(Boolean);
  if (contactBits.length) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 60 },
        border: { bottom: RULE_BORDER },
        children: [new TextRun({ text: contactBits.join("  |  "), size: 16, color: "555555" })],
      })
    );
  } else {
    // Still separate the header from the body even without contact info.
    children.push(
      new Paragraph({ spacing: { before: 40, after: 60 }, border: { bottom: RULE_BORDER }, children: [] })
    );
  }

  function sectionHeading(text: string) {
    children.push(
      new Paragraph({
        spacing: { before: 140, after: 60 },
        border: { bottom: RULE_BORDER },
        children: [new TextRun({ text, bold: true, color: HEADING_COLOR, size: HEAD_SIZE })],
      })
    );
  }

  if (job.tailoredSummary) {
    sectionHeading("PROFESSIONAL SUMMARY");
    children.push(new Paragraph({ children: [new TextRun({ text: job.tailoredSummary })], spacing: { after: 60 } }));
  }

  if (job.skills && job.skills.length) {
    sectionHeading("CORE SKILLS");
    for (const cat of job.skills) {
      children.push(
        new Paragraph({
          spacing: { after: 20 },
          children: [new TextRun({ text: cat.category + ": ", bold: true }), new TextRun({ text: (cat.skills || []).join(", ") })],
        })
      );
    }
  }

  if (job.keyAccomplishments && job.keyAccomplishments.length) {
    sectionHeading("SELECTED KEY ACCOMPLISHMENTS");
    for (const item of job.keyAccomplishments) {
      children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: item })] }));
    }
  }

  if (job.experience && job.experience.length) {
    sectionHeading("PROFESSIONAL EXPERIENCE");
    for (const role of job.experience) {
      const headerLine = [role.title, role.company, role.location, role.dates].filter(Boolean).join(" | ");
      children.push(
        new Paragraph({
          spacing: { before: 70 },
          children: [new TextRun({ text: headerLine, bold: true })],
        })
      );
      for (const bullet of role.bullets || []) {
        children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: bullet })] }));
      }
    }
  }

  if (profile.education && profile.education.length) {
    sectionHeading("EDUCATION");
    for (const line of profile.education) {
      children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: line })] }));
    }
  }

  if (profile.certifications && profile.certifications.length) {
    sectionHeading("CERTIFICATIONS");
    for (const line of profile.certifications) {
      children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: line })] }));
    }
  }

  if (profile.languages && profile.languages.length) {
    sectionHeading("LANGUAGES");
    for (const line of profile.languages) {
      children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: line })] }));
    }
  }

  if (profile.projects && profile.projects.length) {
    sectionHeading("GitHub AI Projects:");
    for (const p of profile.projects) {
      const titleRuns: TextRun[] = [new TextRun({ text: p.title, bold: true })];
      if (p.link) {
        titleRuns.push(new TextRun({ text: "     Website Link: ", bold: false }));
        titleRuns.push(new TextRun({ text: p.link, color: HEADING_COLOR, underline: {} }));
      }
      children.push(new Paragraph({ spacing: { before: 50 }, children: titleRuns }));
      if (p.description) {
        children.push(new Paragraph({ children: [new TextRun({ text: p.description })], spacing: { after: 50 } }));
      }
    }
  }

  const footerText = [profile.name, headline].filter(Boolean).join(" | ");

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { size: BODY_SIZE },
          // Word's default Normal style adds ~10pt spacing after every
          // paragraph and 1.15x line spacing — across a dense multi-role CV
          // that alone can push the doc from 2 pages to 3. Tighten both.
          paragraph: { spacing: { after: 40, line: 240, lineRule: "auto" } },
        },
      },
    },
    sections: [
      {
        // Match the PDF generator's margin exactly (34pt = 680 twips) so
        // both formats land on the same page count for the same content.
        properties: { page: { margin: { top: 680, bottom: 680, left: 680, right: 680 } } },
        footers: footerText
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: footerText, size: 16, color: "777777" })],
                  }),
                ],
              }),
            }
          : undefined,
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
