import { flattenPages } from "../pdf/extract.js";
import { absorbNotes, columnText, groupByAnchors, joinColumn } from "./util.js";

const CODE = [0, 85];
const TITLE = [85, 215];
const WEIGHT_2026 = [215, 355];
const LOWER = [355, 395];
const MEDIAN = [395, 440];
const MEAN = [440, 490];
const WEIGHT_2027 = [490, 632];
const REMARKS = [632, 860];

export function parseEduhk(extracted) {
  const lines = flattenPages(extracted);
  const anchors = lines.filter((line) => /^JS\d{4}$/.test(columnText(line, ...CODE)));
  const usable = lines.filter((line) => !isChrome(line));
  const groups = groupByAnchors(usable, anchors, [], 22);
  const rows = [...anchors]
    .sort((a, b) => a.page - b.page || b.y - a.y)
    .map((anchor) => {
      const band = groups.get(anchor) || [];
      return {
        code: columnText(anchor, ...CODE),
        programme: joinColumn(band, ...TITLE, " "),
        weighting2026: joinColumn(band, ...WEIGHT_2026, "\n"),
        lower: scoreCell(band, LOWER),
        median: scoreCell(band, MEDIAN),
        mean: scoreCell(band, MEAN),
        weighting2027: joinColumn(band, ...WEIGHT_2027, "\n"),
        remarks: joinColumn(band, ...REMARKS, "\n"),
      };
    });

  const columns = [
    { key: "code", label: "JUPAS Programme Code" },
    { key: "programme", label: "Programme Title" },
    { key: "weighting2026", label: "Heavier Subject Weighting (2026 Entry)" },
    { key: "lower", label: "Lower Quartile" },
    { key: "median", label: "Median" },
    { key: "mean", label: "Mean Score of Specific HKDSE Subject" },
    { key: "weighting2027", label: "Heavier Subject Weighting (2027 Entry)" },
    { key: "remarks", label: "Remarks" },
  ];

  const sections = [{ heading: "Programme Admission Scores", notes: [], columns, rows }];
  const overall = overallMean(lines);
  if (overall) sections.push(overall);

  const firstAnchor = anchors[0];
  const noteLines = lines.filter((line) => line.page === 1 && firstAnchor && line.y > firstAnchor.y + 80 && !isChrome(line));

  return {
    title: "EdUHK 2026 Admission Scores Reference for JUPAS Entrants",
    notes: absorbNotes(noteLines, (text) => /EdUHK 2026 Admission Scores/.test(text)),
    sections,
  };
}

function scoreCell(band, range) {
  return joinColumn(band, ...range, " ").replace(/\b(Quartile|Median|Lower)\b/g, "").replace(/\s+/g, " ").trim();
}

function isChrome(line) {
  return /JUPAS Programme Code|Programme Title|For 2026 Entry|Admission Score|Subject Weighting|Score Calculation|Mean score of|Remarks|Lower Quartile Median/.test(line.text);
}

function overallMean(lines) {
  const start = lines.find((line) => /Overall Mean Score/i.test(line.text));
  if (!start) return null;
  const rows = [];
  for (const line of lines.filter((line) => line.page === start.page && line.y < start.y)) {
    const match = line.text.match(/^(Undergraduate programmes|Higher Diploma programme)\s+(\d+(?:\.\d+)?)/i);
    if (match) rows.push({ level: match[1], score: match[2] });
  }
  if (!rows.length) return null;
  return {
    heading: "Overall Mean Score (without Subject Weighting)",
    notes: ["Best 5 HKDSE subjects，未計科目加權。"],
    columns: [
      { key: "level", label: "Programme Level" },
      { key: "score", label: "Overall Mean Score" },
    ],
    rows,
  };
}
