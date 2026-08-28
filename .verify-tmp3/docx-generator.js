"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildResumeDocx = buildResumeDocx;
const docx_1 = require("docx");
function parseDataUrl(dataUrl) {
    if (!dataUrl)
        return null;
    const match = /^data:image\/(png|jpe?g|gif|bmp);base64,(.+)$/i.exec(dataUrl);
    if (!match)
        return null;
    const ext = match[1].toLowerCase();
    const type = (ext === "jpeg" ? "jpg" : ext);
    const buffer = Buffer.from(match[2], "base64");
    return { buffer, type };
}
function noBorder() {
    return { style: docx_1.BorderStyle.NONE, size: 0, color: "FFFFFF" };
}
// Saved status tags sometimes already include their own parentheses (e.g. if
// the original CV literally showed "(Immediate Joiner)" and extraction kept
// them verbatim). Strip any existing wrapping parens before we add ours, so
// we never end up with "((Immediate Joiner))".
function cleanStatusTag(tag) {
    return (tag || "").trim().replace(/^\(+/, "").replace(/\)+$/, "").trim();
}
const RULE_BORDER = { style: docx_1.BorderStyle.SINGLE, size: 6, color: "999999", space: 4 };
const HEADING_COLOR = "2E74B5";
// Sizes are in half-points (docx convention): 20 = 10pt, 18 = 9pt. HEAD_SIZE
// (10pt, the requested cap) is used only where explicitly set below — name,
// status tag, headline, section headings. Everything else inherits the
// document default of BODY_SIZE (9pt) so the CV fits 2 pages, matching the
// same split used in pdf-generator.ts.
const HEAD_SIZE = 20;
const BODY_SIZE = 18;
async function buildResumeDocx(profile, job) {
    const children = [];
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
    const nameLineTabTwips = (hasPhoto) => hasPhoto ? TEXT_CELL_TWIPS - 216 : PAGE_USABLE_TWIPS;
    function buildNameLineRuns(hasPhoto) {
        const runs = [new docx_1.TextRun({ text: profile.name || "Candidate", bold: true, size: HEAD_SIZE })];
        if (statusTag) {
            // Right-aligned via a right tab stop (matches the original CV's layout,
            // where the status tag sits flush right on the name line rather than a
            // few spaces after the name) and only the inner words are underlined --
            // the parentheses stay plain, same as the source document.
            runs.push(new docx_1.TextRun({ text: "\t(", bold: true, size: HEAD_SIZE }));
            runs.push(new docx_1.TextRun({ text: statusTag, bold: true, underline: {}, size: HEAD_SIZE }));
            runs.push(new docx_1.TextRun({ text: ")", bold: true, size: HEAD_SIZE }));
        }
        return runs;
    }
    function buildNameBlock(hasPhoto) {
        return [
            new docx_1.Paragraph({
                tabStops: statusTag ? [{ type: docx_1.TabStopType.RIGHT, position: nameLineTabTwips(hasPhoto) }] : undefined,
                children: buildNameLineRuns(hasPhoto),
            }),
            ...(headline
                ? [new docx_1.Paragraph({ spacing: { before: 60 }, children: [new docx_1.TextRun({ text: headline.toUpperCase(), bold: true, size: HEAD_SIZE })] })]
                : []),
        ];
    }
    if (photo) {
        children.push(new docx_1.Table({
            width: { size: PAGE_USABLE_TWIPS, type: docx_1.WidthType.DXA },
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
                new docx_1.TableRow({
                    children: [
                        new docx_1.TableCell({
                            width: { size: PHOTO_CELL_TWIPS, type: docx_1.WidthType.DXA },
                            children: [new docx_1.Paragraph({ children: [new docx_1.ImageRun({ data: photo.buffer, type: photo.type, transformation: { width: 85, height: 85 } })] })],
                        }),
                        new docx_1.TableCell({ width: { size: TEXT_CELL_TWIPS, type: docx_1.WidthType.DXA }, children: buildNameBlock(true) }),
                    ],
                }),
            ],
        }));
    }
    else {
        children.push(...buildNameBlock(false));
    }
    const contactBits = [profile.location, profile.phone, profile.email].filter(Boolean);
    if (contactBits.length) {
        children.push(new docx_1.Paragraph({
            alignment: docx_1.AlignmentType.CENTER,
            spacing: { before: 80, after: 60 },
            border: { bottom: RULE_BORDER },
            children: [new docx_1.TextRun({ text: contactBits.join("  |  "), size: 16, color: "555555" })],
        }));
    }
    else {
        // Still separate the header from the body even without contact info.
        children.push(new docx_1.Paragraph({ spacing: { before: 40, after: 60 }, border: { bottom: RULE_BORDER }, children: [] }));
    }
    function sectionHeading(text) {
        children.push(new docx_1.Paragraph({
            spacing: { before: 140, after: 60 },
            border: { bottom: RULE_BORDER },
            children: [new docx_1.TextRun({ text, bold: true, color: HEADING_COLOR, size: HEAD_SIZE })],
        }));
    }
    if (job.tailoredSummary) {
        sectionHeading("PROFESSIONAL SUMMARY");
        children.push(new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: job.tailoredSummary })], spacing: { after: 60 } }));
    }
    if (job.skills && job.skills.length) {
        sectionHeading("CORE SKILLS");
        for (const cat of job.skills) {
            children.push(new docx_1.Paragraph({
                spacing: { after: 20 },
                children: [new docx_1.TextRun({ text: cat.category + ": ", bold: true }), new docx_1.TextRun({ text: (cat.skills || []).join(", ") })],
            }));
        }
    }
    if (job.keyAccomplishments && job.keyAccomplishments.length) {
        sectionHeading("SELECTED KEY ACCOMPLISHMENTS");
        for (const item of job.keyAccomplishments) {
            children.push(new docx_1.Paragraph({ bullet: { level: 0 }, children: [new docx_1.TextRun({ text: item })] }));
        }
    }
    if (job.experience && job.experience.length) {
        sectionHeading("PROFESSIONAL EXPERIENCE");
        for (const role of job.experience) {
            const headerLine = [role.title, role.company, role.location, role.dates].filter(Boolean).join(" | ");
            children.push(new docx_1.Paragraph({
                spacing: { before: 70 },
                children: [new docx_1.TextRun({ text: headerLine, bold: true })],
            }));
            for (const bullet of role.bullets || []) {
                children.push(new docx_1.Paragraph({ bullet: { level: 0 }, children: [new docx_1.TextRun({ text: bullet })] }));
            }
        }
    }
    if (profile.education && profile.education.length) {
        sectionHeading("EDUCATION");
        for (const line of profile.education) {
            children.push(new docx_1.Paragraph({ bullet: { level: 0 }, children: [new docx_1.TextRun({ text: line })] }));
        }
    }
    if (profile.certifications && profile.certifications.length) {
        sectionHeading("CERTIFICATIONS");
        for (const line of profile.certifications) {
            children.push(new docx_1.Paragraph({ bullet: { level: 0 }, children: [new docx_1.TextRun({ text: line })] }));
        }
    }
    if (profile.languages && profile.languages.length) {
        sectionHeading("LANGUAGES");
        for (const line of profile.languages) {
            children.push(new docx_1.Paragraph({ bullet: { level: 0 }, children: [new docx_1.TextRun({ text: line })] }));
        }
    }
    if (profile.projects && profile.projects.length) {
        sectionHeading("GitHub AI Projects:");
        for (const p of profile.projects) {
            const titleRuns = [new docx_1.TextRun({ text: p.title, bold: true })];
            if (p.link) {
                titleRuns.push(new docx_1.TextRun({ text: "     Website Link: ", bold: false }));
                titleRuns.push(new docx_1.TextRun({ text: p.link, color: HEADING_COLOR, underline: {} }));
            }
            children.push(new docx_1.Paragraph({ spacing: { before: 50 }, children: titleRuns }));
            if (p.description) {
                children.push(new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: p.description })], spacing: { after: 50 } }));
            }
        }
    }
    const footerText = [profile.name, headline].filter(Boolean).join(" | ");
    const doc = new docx_1.Document({
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
                        default: new docx_1.Footer({
                            children: [
                                new docx_1.Paragraph({
                                    alignment: docx_1.AlignmentType.CENTER,
                                    children: [new docx_1.TextRun({ text: footerText, size: 16, color: "777777" })],
                                }),
                            ],
                        }),
                    }
                    : undefined,
                children,
            },
        ],
    });
    return docx_1.Packer.toBuffer(doc);
}
