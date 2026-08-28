import zlib from "zlib";

// Pulls the largest embedded photo out of an uploaded CV PDF, so the user
// doesn't have to separately re-upload a photo that's already sitting inside
// their original CV file.
//
// This deliberately does NOT use a full PDF parser (pdfjs, pdf-lib, etc).
// Per the PDF spec, a stream object's raw bytes can never be stored inside a
// compressed object stream (ObjStm) -- only non-stream objects can be. That
// means every image XObject's actual pixel data always appears as a normal
// "N 0 obj << ... >> stream ... endstream endobj" block directly in the file
// body, regardless of whether the document's cross-reference table or other
// object dictionaries are compressed. So a direct scan for Image XObjects is
// reliable for this one narrow purpose, without needing to understand the
// rest of the document structure.
//
// Scope: JPEG (DCTDecode) images only, optionally Flate-wrapped -- this
// covers the overwhelming majority of real-world CV photo embeds (Word,
// LibreOffice, Canva, Google Docs all embed photos as JPEG). Anything else
// (raw Flate bitmaps, JPX, CCITT) is skipped rather than guessed at; the
// caller just won't get a photo back, which is a no-op, not a regression.
export function extractLargestPhotoFromPdf(buffer: Buffer): Buffer | null {
  const text = buffer.toString("latin1"); // 1:1 byte-preserving, safe for offset math
  const objRe = /(\d+)\s+0\s+obj([\s\S]*?)stream\r?\n/g;
  let match: RegExpExecArray | null;
  let best: Buffer | null = null;

  while ((match = objRe.exec(text))) {
    const dict = match[2];
    if (!/\/Subtype\s*\/Image/.test(dict)) continue;

    const hasDCT = /\/DCTDecode/.test(dict);
    if (!hasDCT) continue; // only handle JPEG XObjects, see note above

    const hasFlate = /\/Filter\s*(\/FlateDecode|\[[^\]]*\/FlateDecode[^\]]*\])/.test(dict);

    const streamByteStart = match.index + match[0].length;
    const lengthMatch = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);

    let raw: Buffer;
    if (lengthMatch) {
      // Trust the PDF's own declared length when it's a plain number (not an
      // indirect reference) -- exact byte slicing avoids any chance of a
      // stray "endstream"-looking byte sequence inside binary image data
      // truncating the match early.
      const len = parseInt(lengthMatch[1], 10);
      raw = buffer.subarray(streamByteStart, streamByteStart + len);
    } else {
      const endIdx = text.indexOf("endstream", streamByteStart);
      if (endIdx === -1) continue;
      raw = buffer.subarray(streamByteStart, endIdx);
    }

    try {
      if (hasFlate) raw = zlib.inflateSync(raw);
    } catch {
      continue; // not actually flate-compressed, or corrupt -- skip
    }

    if (raw[0] === 0xff && raw[1] === 0xd8) {
      // valid JPEG magic bytes
      if (!best || raw.length > best.length) best = raw;
    }
  }

  return best;
}

export function photoBufferToDataUrl(buf: Buffer): string {
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}
