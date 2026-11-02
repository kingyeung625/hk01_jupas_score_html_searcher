import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractDocument } from "../src/pdf/extract.js";
import { parseScores } from "../src/parse.js";
import { renderHtml } from "../src/renderHtml.js";

GlobalWorkerOptions.workerSrc = new URL("../node_modules/pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).href;

const ROOT = process.env.JUPAS_PDF_DIR || "/home/ubuntu/.cursor/projects/workspace/uploads";

async function load(name) {
  const data = new Uint8Array(readFileSync(`${ROOT}/${name}`));
  const extracted = await extractDocument({ getDocument }, data);
  return parseScores(extracted, name);
}

function findRow(doc, code, where = () => true) {
  for (const section of doc.sections) {
    const row = section.rows.find((item) => item.code === code && where(item, section));
    if (row) return { section, row };
  }
  return null;
}

test("香港大學 6004 與加權表", async () => {
  const doc = await load("HKU-JUPAS-Admissions-Scores-2026_029b.pdf");
  assert.equal(doc.institutionId, "hku");
  const row = findRow(doc, "6004").row;
  assert.equal(row.upper, "31");
  assert.equal(row.median, "29");
  assert.equal(row.lower, "27");
  assert.match(row.programme, /Architectural Studies/);
  const design = findRow(doc, "6236").row;
  assert.match(design.upper, /Insufficient Reference Data/);
  const weighting = doc.sections.find((section) => /Subject Weightings/.test(section.heading));
  assert.ok(weighting.rows.some((item) => item.weighting === "3" && /6107/.test(item.code) && /1\.3/.test(item.weight)));
  assert.ok(doc.notes.some((note) => note.includes("5**=8.5")));
  assert.ok(doc.sections.reduce((sum, section) => sum + section.rows.length, 0) > 40);
});

test("香港教育大學 JS8001", async () => {
  const doc = await load("2026_EdUHK_admission_scores_c139.pdf");
  assert.equal(doc.institutionId, "eduhk");
  const row = findRow(doc, "JS8001").row;
  assert.equal(row.lower, "20.0");
  assert.equal(row.median, "20.0");
  assert.match(row.programme, /Creative and Digital Arts/);
  assert.match(row.weighting2026, /Music/);
  const overall = doc.sections.find((section) => /Overall Mean/.test(section.heading));
  assert.ok(overall);
  assert.equal(overall.rows.find((item) => /Undergraduate/.test(item.level)).score, "21");
});

test("香港科技大學左右兩表", async () => {
  const doc = await load("2026_HKUST_JUPAS_ADMISSIONS_SCORES_c3ee.pdf");
  assert.equal(doc.institutionId, "hkust");
  const science = findRow(doc, "JS5101").row;
  assert.equal(science.median, "38.44");
  assert.equal(science.lower, "35.25");
  assert.match(science.preferred, /Science subjects/);
  const business = findRow(doc, "JS5311").row;
  assert.equal(business.median, "38.23");
  assert.equal(business.perSubject, "5.06");
  const engineering = findRow(doc, "JS5212").row;
  assert.match(engineering.preferred, /Phy/);
  assert.match(engineering.preferred, /Math/);
  assert.match(engineering.level, /Level 5/);
  const joint = findRow(doc, "JS5811");
  assert.match(joint.section.heading, /Joint Programs/);
  assert.match(joint.row.preferred, /Bio/);
  assert.ok(joint.section.columns.some((column) => column.key === "preferred"));
});

test("香港城市大學 JS1211 與共用入學要求", async () => {
  const doc = await load("CityU_2027_JUPAS_Requirements_AdmissionScores_20260929_3619.pdf");
  assert.equal(doc.institutionId, "cityu");
  const row = findRow(doc, "JS1211").row;
  assert.equal(row.median, "32.5");
  assert.equal(row.lower, "31.5");
  assert.match(row.weighting, /1\.5: English/);
  const shared = findRow(doc, "JS1805").row;
  assert.equal(shared.median, "33");
  assert.match(shared.included, /3 core \+ 2 elective/);
  const follow = findRow(doc, "JS1807").row;
  assert.equal(follow.median, "34.5");
  assert.match(follow.weighting, /1\.5: English/);
  const fresh = findRow(doc, "JS1120");
  assert.ok(fresh);
  assert.match(`${fresh.row.median} ${fresh.row.lower}`, /New Programme/);
  const finance = findRow(doc, "JS1000").row;
  assert.match(finance.included, /include English and/);
  assert.match(finance.included, /Mathematics/);
  assert.ok(doc.sections.some((section) => section.heading === "SCHOOL OF LAW"));
});

test("香港中文大學 JS4032 的 UQ／M／LQ", async () => {
  const doc = await load("CUHK_Admission-Grades-2026_73c5.pdf");
  assert.equal(doc.institutionId, "cuhk");
  const median = findRow(doc, "JS4032", (row) => row.percentile === "M").row;
  assert.equal(median.eng, "5*");
  assert.equal(median.total, "28");
  assert.match(median.weighting, /English \(x 1\.5\)/);
  assert.equal(median.programme, "English");
  const upper = findRow(doc, "JS4032", (row) => row.percentile === "UQ").row;
  assert.equal(upper.total, "28.75");
  const lower = findRow(doc, "JS4032", (row) => row.percentile === "LQ").row;
  assert.equal(lower.total, "27.75");
  const medicine = findRow(doc, "JS4501", (row) => row.percentile === "M").row;
  assert.equal(medicine.total, "37");
  assert.match(medicine.principle, /6 Graded Subjects/);
  assert.ok(doc.sections.reduce((sum, section) => sum + section.rows.length, 0) > 80);
});

test("嶺南大學 JS7101", async () => {
  const doc = await load("LU_2026_Admissions_Scores_a457.pdf");
  assert.equal(doc.institutionId, "lu");
  const median = findRow(doc, "JS7101", (row) => row.percentile === "Median").row;
  assert.equal(median.score, "28.77");
  assert.equal(median.chinese, "5.0");
  assert.equal(median.english, "3.0");
  const lower = findRow(doc, "JS7101", (row) => row.percentile === "Lower Quartile").row;
  assert.equal(lower.score, "26.28");
  assert.equal(lower.chinese, "4.0");
  const comma = findRow(doc, "JS7606", (row) => row.percentile === "Median").row;
  assert.equal(comma.english, "3,5");
  const business = findRow(doc, "JS7211", (row) => row.percentile === "Median");
  assert.match(business.section.heading, /BUSINESS/);
  assert.equal(business.row.score, "33.50");
});

test("香港理工大學 JS3060 分年", async () => {
  const doc = await load("polyu_admission_figures_777b.pdf");
  assert.equal(doc.institutionId, "polyu");
  const year2026 = doc.sections.find((section) => section.heading.startsWith("2026"));
  const year2025 = doc.sections.find((section) => section.heading.startsWith("2025"));
  const year2024 = doc.sections.find((section) => section.heading.startsWith("2024"));
  assert.ok(year2026 && year2025 && year2024);
  const row = year2026.rows.find((item) => item.code === "JS3060");
  assert.equal(row.average, "200.6");
  assert.equal(row.median, "200");
  assert.equal(row.lower, "195.5");
  assert.match(row.mechanism, /Any Best 5 Subjects/);
  assert.equal(row.weighting.href.includes("JS3060"), true);
  const older = year2025.rows.find((item) => item.code === "JS3060");
  assert.equal(older.average, "188.2");
  assert.notEqual(older.median, row.median);
  const missing = year2026.rows.find((item) => item.code === "JS3000");
  assert.match(missing.median, /not available/i);
  assert.ok(doc.sections.some((section) => /Explanatory Notes/.test(section.heading)));
});

test("產出的 HTML 內嵌標誌並可在窄螢幕改成卡片", async () => {
  const doc = await load("HKU-JUPAS-Admissions-Scores-2026_029b.pdf");
  const html = renderHtml(doc);
  assert.match(html, /alt="01 教育"/);
  assert.match(html, /data:image\/png;base64,/);
  assert.match(html, /max-width:760px/);
  assert.match(html, /data-label="Upper Quartile"/);
  assert.match(html, />31</);
  const hostile = renderHtml({
    title: "<script>",
    institution: "測試",
    notes: [],
    sections: [{
      heading: "A",
      columns: [{ key: "name", label: "Name" }],
      rows: [{ name: "<b>x</b>" }],
    }],
  });
  assert.doesNotMatch(hostile, /<script>/);
  assert.match(hostile, /&lt;b&gt;x&lt;\/b&gt;/);
});
