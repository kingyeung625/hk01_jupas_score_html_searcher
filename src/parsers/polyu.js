import { flattenPages } from "../pdf/extract.js";
import { absorbNotes, columnText, findLink, groupByAnchors, joinColumn, readingOrder } from "./util.js";

const NAME = [0, 168];
const CODE = [168, 210];
const AVERAGE = [210, 305];
const MECHANISM = [305, 400];
const PERCENTILE = [400, 470];
const SCORE = [470, 575];

export function parsePolyu(extracted) {
  const lines = flattenPages(extracted);
  const yearLines = lines.filter((line) => /^20\d{2} JUPAS \(HKDSE\) Admissions Figures$/.test(line.text.trim()));
  const anchors = lines.filter((line) => /^JS\d{4}$/.test(columnText(line, ...CODE)));
  const groups = groupByAnchors(
    lines.filter((line) => !isChrome(line) && !yearLines.includes(line)),
    anchors,
    [],
    36,
  );

  const events = [
    ...yearLines.map((line) => ({ line, kind: "year" })),
    ...anchors.map((line) => ({ line, kind: "row" })),
  ].sort((a, b) => readingOrder(a.line, b.line));

  const sections = [];
  let current = null;
  for (const event of events) {
    if (event.kind === "year") {
      current = {
        heading: event.line.text.trim(),
        notes: [],
        columns: columns(),
        rows: [],
      };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { heading: "JUPAS Admissions Figures", notes: [], columns: columns(), rows: [] };
      sections.push(current);
    }
    const band = groups.get(event.line) || [];
    const href = findLink(band, 200, 320);
    const average = numberIn(band, AVERAGE);
    const median = labeledScore(band, /Median/);
    const lower = labeledScore(band, /Lower/);
    const unavailable = joinColumn(band, 400, 575, " ").replace(/\s+/g, " ").match(/Scores of admittees.*?reference\.?/i)?.[0] || "";
    current.rows.push({
      programme: joinColumn(band, ...NAME, " ").replace(/\s+/g, " ").trim(),
      code: columnText(event.line, ...CODE),
      average,
      weighting: href ? { text: "subject weighting in details", href } : joinWeighting(band),
      mechanism: mechanismText(band),
      median: median || unavailable,
      lower: lower || (unavailable ? unavailable : ""),
    });
  }

  const explanatory = lines.filter((line) => /Explanatory Notes/.test(line.text) || line.page >= 14);
  if (explanatory.length) {
    sections.push({
      heading: "Explanatory Notes on the Calculation of Average HKDSE Scores",
      notes: absorbNotes(explanatory, (text) => /^Explanatory Notes/.test(text) || /^\d+$/.test(text)),
      columns: [],
      rows: [],
    });
  }

  const firstAnchor = anchors.find((line) => yearLines[0] && line.page === yearLines[0].page);
  const intro = lines.filter((line) => yearLines[0]
    && line.page === yearLines[0].page
    && line.y < yearLines[0].y
    && (!firstAnchor || line.y > firstAnchor.y + 28)
    && !isChrome(line));
  return {
    title: "PolyU JUPAS (HKDSE) Admissions Figures",
    notes: absorbNotes(intro, (text) => /JUPAS Admissions Figures|Scheme \/ Programme/.test(text)),
    sections: sections.filter((section) => section.rows.length || section.notes.length),
  };
}

function numberIn(band, range) {
  for (const line of band) {
    const text = columnText(line, ...range);
    const match = text.match(/\b\d+(?:\.\d+)?\b/);
    if (match && !/subject weighting|in details/i.test(text)) return match[0];
  }
  return "";
}

function labeledScore(band, pattern) {
  for (const line of band) {
    if (!pattern.test(columnText(line, ...PERCENTILE))) continue;
    const score = columnText(line, ...SCORE, { numeric: true }).match(/\d+(?:\.\d+)?/);
    if (score) return score[0];
  }
  return "";
}

function mechanismText(band) {
  const parts = [];
  for (const line of band) {
    const text = columnText(line, ...MECHANISM);
    if (!text || /Median|Lower|Quartile|subject weighting|in details/i.test(text)) continue;
    parts.push(text);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function joinWeighting(band) {
  const parts = [];
  for (const line of band) {
    const text = columnText(line, ...AVERAGE);
    if (/subject weighting|in details/i.test(text)) parts.push(text);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function isChrome(line) {
  return /Scheme \/ Programme|Average HKDSE|Admission Score|JUPAS Code|Calculation Mechanism|Percentile|with Subject Weighting|^JUPAS Admissions Figures$/.test(line.text);
}

function columns() {
  return [
    { key: "programme", label: "Scheme / Programme" },
    { key: "code", label: "JUPAS Code" },
    { key: "average", label: "Average HKDSE Score with Subject Weighting" },
    { key: "weighting", label: "Subject Weighting" },
    { key: "mechanism", label: "Admission Score Calculation Mechanism" },
    { key: "median", label: "Median" },
    { key: "lower", label: "Lower Quartile" },
  ];
}
