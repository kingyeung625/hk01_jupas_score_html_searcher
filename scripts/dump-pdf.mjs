import { readFileSync } from "node:fs";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractDocument } from "../src/pdf/extract.js";

GlobalWorkerOptions.workerSrc = new URL(
  "../node_modules/pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).href;

const file = process.argv[2];
const pageLimit = Number(process.argv[3] || 1);
const data = new Uint8Array(readFileSync(file));
const doc = await extractDocument({ getDocument }, data);

for (const page of doc.pages.slice(0, pageLimit)) {
  console.log(`\n===== PAGE ${page.pageNumber} ${page.width.toFixed(1)}x${page.height.toFixed(1)} links=${page.links.length} =====`);
  for (const link of page.links) {
    console.log(`LINK ${link.url} @ ${link.x.toFixed(0)},${link.y.toFixed(0)}`);
  }
  for (const line of page.lines) {
    const parts = line.items
      .map((item) => `${item.x.toFixed(0)}:${item.text.replace(/\s+/g, " ")}`)
      .join(" | ");
    console.log(`y=${line.y.toFixed(1)} ${parts}`);
  }
}
