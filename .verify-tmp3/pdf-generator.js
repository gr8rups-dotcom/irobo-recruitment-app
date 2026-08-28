"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildResumePdf = buildResumePdf;
const pdfkit_1 = __importDefault(require("pdfkit"));
function photoBuffer(dataUrl) {
    if (!dataUrl)
        return null;
    const match = /^data:image\/(png|jpe?g|gif|bmp);base64,(.+)$/i.exec(dataUrl);
    if (!match)
        return null;
    return Buffer.from(match[2], "base64");
}
// Saved status tags sometimes already include their own parentheses (e.g. if
// the original CV literally showed "(Immediate Joiner)" and extraction kept
// them verbatim). Strip any existing wrapping parens before we add ours, so
// we never end up with "((Immediate Joiner))".
function cleanStatusTag(tag) {
    return (tag || "").trim().replace(/^\(+/, "").replace(/\)+$/, "").trim();
}
const HEADING_COLOR = "#2E74B5";
const RULE_COLOR = "#999999";
const M = 34; // page margin, in points — kept in one place so every x/width below stays consistent
const HEAD_SIZE = 10; // name, status tag, headline, section headings — the 10pt cap
const BODY_SIZE = 9; // everything else (summary, skills, bullets, experience, projects)
async function buildResumePdf(profile, job) {
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({ margin: M, bufferPages: true });
        const chunks = [];
        doc.on("data", (c) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
        const fullWidth = doc.page.width - 2 * M;
        const headline = job.tailoredHeadline || profile.headline;
        const photo = photoBuffer(profile.photoDataUrl);
        const startY = doc.y;
        const textX = photo ? M + 95 : M;
        const textWidth = photo ? doc.page.width - M - textX : fullWidth;
        if (photo) {
            try {
                doc.image(photo, M, startY, { width: 80, height: 80 });
            }
            catch {
                // ignore bad image data
            }
        }
        const statusTag = cleanStatusTag(profile.statusTag);
        // Name and status tag are kept at the SAME font size deliberately: pdfkit
        // tracks line height off whichever size was used last in a continued-text
        // chain, so mixing a big name size with a small status-tag size makes it
        // under-advance doc.y and the next line (headline) overlaps the name.
        doc.font("Helvetica-Bold").fontSize(HEAD_SIZE).fillColor("#000000")
            .text(profile.name || "Candidate", textX, startY, { width: textWidth });
        if (statusTag) {
            // Matches the original CV's layout: the status tag sits flush to the
            // right edge of the header block on the same line as the name (not
            // crammed a few spaces after it), and only the inner words are
            // underlined -- the parentheses themselves stay plain, same as the
            // source document. Positioned with explicit x/y (not chained via
            // `continued` off the name) so it's independent of the name's width.
            doc.font("Helvetica-Bold").fontSize(HEAD_SIZE);
            const openParen = "(";
            const closeParen = ")";
            const tagTotalWidth = doc.widthOfString(openParen) + doc.widthOfString(statusTag) + doc.widthOfString(closeParen);
            const tagX = textX + textWidth - tagTotalWidth;
            doc.text(openParen, tagX, startY, { continued: true });
            doc.text(statusTag, { continued: true, underline: true });
            doc.text(closeParen);
        }
        doc.moveDown(0.15);
        doc.x = textX;
        if (headline) {
            doc.font("Helvetica-Bold").fontSize(HEAD_SIZE).text(headline.toUpperCase(), textX, doc.y, { width: textWidth });
        }
        doc.y = Math.max(doc.y, startY + (photo ? 85 : 0));
        doc.x = M;
        const contactBits = [profile.location, profile.phone, profile.email].filter(Boolean);
        if (contactBits.length) {
            doc.moveDown(0.2);
            doc.font("Helvetica").fontSize(8).fillColor("#555555")
                .text(contactBits.join("   |   "), M, doc.y, { width: fullWidth, align: "center" });
            doc.fillColor("#000000");
        }
        doc.moveDown(0.25);
        doc.moveTo(M, doc.y).lineTo(doc.page.width - M, doc.y).lineWidth(1).strokeColor(RULE_COLOR).stroke();
        doc.moveDown(0.35);
        doc.x = M;
        function heading(text) {
            doc.moveDown(0.3);
            doc.x = M;
            doc.font("Helvetica-Bold").fontSize(HEAD_SIZE).fillColor(HEADING_COLOR).text(text, M, doc.y, { width: fullWidth });
            doc.moveTo(M, doc.y + 2).lineTo(doc.page.width - M, doc.y + 2).lineWidth(0.75).strokeColor(RULE_COLOR).stroke();
            doc.fillColor("#000000");
            doc.moveDown(0.15);
            doc.x = M;
            doc.font("Helvetica").fontSize(BODY_SIZE);
        }
        if (job.tailoredSummary) {
            heading("PROFESSIONAL SUMMARY");
            doc.text(job.tailoredSummary, M, doc.y, { width: fullWidth });
        }
        if (job.skills && job.skills.length) {
            heading("CORE SKILLS");
            for (const cat of job.skills) {
                doc.font("Helvetica-Bold").fontSize(BODY_SIZE).text(cat.category + ": ", M, doc.y, { continued: true, width: fullWidth });
                doc.font("Helvetica").fontSize(BODY_SIZE).text((cat.skills || []).join(", "));
            }
        }
        if (job.keyAccomplishments && job.keyAccomplishments.length) {
            heading("SELECTED KEY ACCOMPLISHMENTS");
            for (const item of job.keyAccomplishments) {
                doc.text("•  " + item, M, doc.y, { width: fullWidth });
            }
        }
        if (job.experience && job.experience.length) {
            heading("PROFESSIONAL EXPERIENCE");
            for (const role of job.experience) {
                const headerLine = [role.title, role.company, role.location, role.dates].filter(Boolean).join(" | ");
                doc.font("Helvetica-Bold").fontSize(BODY_SIZE).text(headerLine, M, doc.y, { width: fullWidth });
                doc.font("Helvetica").fontSize(BODY_SIZE);
                for (const bullet of role.bullets || []) {
                    doc.text("•  " + bullet, M, doc.y, { width: fullWidth });
                }
                doc.moveDown(0.15);
            }
        }
        if (profile.education && profile.education.length) {
            heading("EDUCATION");
            for (const line of profile.education)
                doc.text("•  " + line, M, doc.y, { width: fullWidth });
        }
        if (profile.certifications && profile.certifications.length) {
            heading("CERTIFICATIONS");
            for (const line of profile.certifications)
                doc.text("•  " + line, M, doc.y, { width: fullWidth });
        }
        if (profile.languages && profile.languages.length) {
            heading("LANGUAGES");
            for (const line of profile.languages)
                doc.text("•  " + line, M, doc.y, { width: fullWidth });
        }
        if (profile.projects && profile.projects.length) {
            heading("GitHub AI Projects:");
            for (const p of profile.projects) {
                doc.font("Helvetica-Bold").fontSize(BODY_SIZE).text(p.title, M, doc.y, { continued: !!p.link, width: fullWidth });
                if (p.link) {
                    doc.font("Helvetica").fontSize(8).fillColor(HEADING_COLOR).text("   Website Link: " + p.link, { link: p.link, underline: true });
                    doc.fillColor("#000000");
                }
                if (p.description) {
                    doc.font("Helvetica").fontSize(BODY_SIZE).text(p.description, M, doc.y, { width: fullWidth });
                }
                doc.moveDown(0.15);
            }
        }
        const footerText = [profile.name, headline].filter(Boolean).join(" | ");
        if (footerText) {
            const range = doc.bufferedPageRange();
            for (let i = range.start; i < range.start + range.count; i++) {
                doc.switchToPage(i);
                // Drawing this close to the bottom edge can otherwise make pdfkit
                // think the text doesn't fit and silently start a new (blank) page —
                // temporarily removing the bottom margin for this one write avoids that.
                const originalBottomMargin = doc.page.margins.bottom;
                doc.page.margins.bottom = 0;
                doc.font("Helvetica").fontSize(8).fillColor("#777777")
                    .text(footerText, M, doc.page.height - 26, { width: fullWidth, align: "center" });
                doc.fillColor("#000000");
                doc.page.margins.bottom = originalBottomMargin;
            }
        }
        doc.end();
    });
}
