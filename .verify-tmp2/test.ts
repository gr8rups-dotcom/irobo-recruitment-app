import * as fs from "fs";
import { extractLargestPhotoFromPdf, photoBufferToDataUrl } from "../src/lib/pdf-image";

const buf = fs.readFileSync("/tmp/original-cv.pdf");
const img = extractLargestPhotoFromPdf(buf);
if (img) {
  fs.writeFileSync("/tmp/verify-photo-v2.jpg", img);
  console.log("OK bytes:", img.length);
  const url = photoBufferToDataUrl(img);
  console.log("data url length:", url.length, "prefix:", url.slice(0, 30));
} else {
  console.log("NO IMAGE FOUND");
}
