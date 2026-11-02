import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { LOGO_DATA_URI } from "./logoData.js";
import { extractDocument } from "./pdf/extract.js";
import { parseScores, suggestedFilename } from "./parse.js";
import { renderHtml } from "./renderHtml.js";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const fileInput = document.querySelector("#file");
const drop = document.querySelector("#drop");
const status = document.querySelector("#status");
const actions = document.querySelector("#actions");
const download = document.querySelector("#download");
const reset = document.querySelector("#reset");
const preview = document.querySelector("#preview");
document.querySelector("#logo").src = LOGO_DATA_URI;

let current = null;

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) readFile(file);
});

drop.addEventListener("dragover", (event) => {
  event.preventDefault();
  drop.classList.add("over");
});
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (event) => {
  event.preventDefault();
  drop.classList.remove("over");
  const file = event.dataTransfer?.files?.[0];
  if (file) readFile(file);
});

download.addEventListener("click", () => {
  if (!current) return;
  const blob = new Blob([current.html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = current.filename;
  link.click();
  URL.revokeObjectURL(url);
});

reset.addEventListener("click", () => {
  current = null;
  fileInput.value = "";
  status.textContent = "";
  status.classList.remove("error");
  actions.hidden = true;
  preview.hidden = true;
  preview.removeAttribute("srcdoc");
});

async function readFile(file) {
  status.classList.remove("error");
  status.textContent = `正在讀取 ${file.name}…`;
  actions.hidden = true;
  preview.hidden = true;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extracted = await extractDocument(pdfjs, bytes);
    const doc = parseScores(extracted, file.name);
    if (doc.error) {
      status.textContent = doc.error;
      status.classList.add("error");
      return;
    }
    const html = renderHtml(doc);
    const rowCount = doc.sections.reduce((sum, section) => sum + section.rows.length, 0);
    current = { html, filename: suggestedFilename(doc) };
    status.textContent = `已辨認為${doc.institution}，抽出 ${rowCount} 列。可預覽並下載 ${current.filename}。`;
    preview.srcdoc = html;
    preview.hidden = false;
    actions.hidden = false;
  } catch (error) {
    status.textContent = "這份 PDF 無法解析。請確認檔案沒有加密，然後再試一次。";
    status.classList.add("error");
    console.error(error);
  }
}
