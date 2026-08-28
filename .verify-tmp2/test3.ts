import * as fs from "fs";
import { extractLargestPhotoFromPdf } from "../src/lib/pdf-image";
const buf = fs.readFileSync("/sessions/eager-zealous-johnson/mnt/uploads/Tailored_CV__GG_Selection (1).pdf");
const img = extractLargestPhotoFromPdf(buf);
if (img) fs.writeFileSync("/tmp/verify-gg-photo.jpg", img);
