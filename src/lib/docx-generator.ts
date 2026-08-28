import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle,
  Footer, AlignmentType, TabStopType,
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

  // Page is 12240 twips wide (US Letter) minus the 680-twip margins on each
  // side used below (34pt * 20 twips/pt) = 10880 twips of usable width when
  // there's no photo. With a photo, the header is a table whose two cells
  // are given exact DXA (twip) widths below -- PHOTO_CELL_TWIPS and
  // TEXT_CELL_TWIPS -- specifically so this tab-stop math is exact instead
  // of guessed from a percentage-based layout (percentage table columns
  // don't reliably resolve to a predictable twip width across renderers,
  // which was verified empirically to overflow the cell and hide the status
  // tag entirely). Subtract ~216 twips for the text cell's left+right
  // internal margins (108 twips each, this library's default) so the tab
  // stop lands on the cell's actual right edge rather than past it.
  const PAGE_USABLE_TWIPS = 10880;
  const PHOTO_CELL_TWIPS = 2000;
  const TEXT_CELL_TWIPS = PAGE_USABLE_TWIPS - PHOTO_CELL_TWIPS;
  const nameLineTabTwips = (hasPhoto: boolean) =>
    hasPhoto ? TEXT_CELL_TWIPS - 216 : PAGE_USABLE_TWIPS;

  function buildNameLineRuns(hasPhoto: boolean): TextRun[] {
    const runs: TextRun[] = [new TextRun({ text: profile.name || "Candidate", bold: true, size: HEAD_SIZE })];
    if (statusTag) {
      // Right-aligned via a right tab stop (matches the original CV's layout,
      // where the status tag sits flush right on the name line rather than a
      // few spaces after the name) and only the inner words are underlined --
      // the parentheses stay plain, same as the source document.
      runs.push(new TextRun({ text: "\t(", bold: true, size: HEAD_SIZE }));
      runs.push(new TextRun({ text: statusTag, bold: true, underline: {}, size: HEAD_SIZE }));
      runs.push(new TextRun({ text: ")", bold: true, size: HEAD_SIZE }));
    }
    return runs;
  }

  function buildNameBlock(hasPhoto: boolean): Paragraph[] {
    return [
      new Paragraph({
        tabStops: statusTag ? [{ type: TabStopType.RIGHT, position: nameLineTabTwips(hasPhoto) }] : undefined,
        children: buildNameLineRuns(hasPhoto),
      }),
      ...(headline
        ? [new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: headline.toUpperCase(), bold: true, size: HEAD_SIZE })] })]
        : []),
    ];
  }

  if (photo) {
    children.push(
      new Table({
        width: { size: PAGE_USABLE_TWIPS, type: WidthType.DXA },
        // The per-cell `width` above only sets each cell's own tcW; Word
        // actually lays the table out using the table's tblGrid, which docx
        // only populates from this columnWidths array. Without it, the grid
        // defaults to a trivial width and the tab stop below (measured
        // against the real 8880-twip cell) lands outside what Word thinks
        // the cell is, so the status tag silently disappears -- verified by
        // inspecting the raw document.xml after a render came out blank.
        columnWidths: [PHOTO_CELL_TWIPS, TEXT_CELL_TWIPS],
        borders: { top: noBorder(), bottom: noBorder(), left: noBorder(), right: noBorder(), insideHorizontal: noBorder(), insideVertical: noBorder() },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: PHOTO_CELL_TWIPS, type: WidthType.DXA },
                children: [new Paragraph({ children: [new ImageRun({ data: photo.buffer, type: photo.type, transformation: { width: 85, height: 85 } })] })],
              }),
              new TableCell({ width: { size: TEXT_CELL_TWIPS, type: WidthType.DXA }, children: buildNameBlock(true) }),
            ],
          }),
        ],
      })
    );
  } else {
    children.push(...buildNameBlock(false));
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
