import * as fs from "fs";
import { extractLargestPhotoFromPdf } from "../src/lib/pdf-image";

const files = [
  "/sessions/eager-zealous-johnson/mnt/uploads/Tailored_CV_Delta_System_Software_Inc_.pdf",
  "/sessions/eager-zealous-johnson/mnt/uploads/Tailored_CV__GG_Selection (1).pdf",
];
for (const f of files) {
  const buf = fs.readFileSync(f);
  const img = extractLargestPhotoFromPdf(buf);
  console.log(f.split("/").pop(), "->", img ? img.length + " bytes found" : "none (expected)");
}
