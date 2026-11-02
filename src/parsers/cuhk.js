import { flattenPages } from "../pdf/extract.js";
import { absorbNotes, columnText, groupByAnchors, joinColumn, readingOrder, sectionMap } from "./util.js";

const CODE = [0, 52];
const NAME = [52, 140];
const PERCENTILE = [140, 166];
const GRADES = [
  ["chi", 166, 190],
  ["eng", 190, 212],
  ["math", 212, 236],
  ["csd", 236, 276],
  ["m1", 276, 300],
  ["e1", 300, 324],
  ["e2", 324, 347],
  ["e3", 347, 370],
  ["e4", 370, 394],
  ["total", 394, 422],
];
const PRINCIPLE = [422, 452];
const WEIGHT = [452, 590];

export function parseCuhk(extracted) {
  const lines = flattenPages(extracted);
  const blockers = lines.filter(isFaculty);
  const anchors = lines.filter((line) => /^JS\d{4}$/.test(columnText(line, ...CODE)));
  const groups = groupByAnchors(
    lines.filter((line) => !isChrome(line) && !isFaculty(line) && !isNoteLine(line)),
    anchors,
    blockers,
    40,
  );
  const sections = sectionMap();
  const events = [
    ...blockers.map((line) => ({ line, kind: "section" })),
    ...anchors.map((line) => ({ line, kind: "row" })),
  ].sort((a, b) => readingOrder(a.line, b.line));

  let current = null;
  for (const event of events) {
    if (event.kind === "section") {
      current = sections.add(event.line.text);
      current.columns = columns();
      continue;
    }
    if (!current) {
      current = sections.add("Programmes");
      current.columns = columns();
    }
    const band = groups.get(event.line) || [];
    const shared = {
      code: columnText(event.line, ...CODE),
      programme: joinColumn(band, ...NAME, " "),
      principle: joinColumn(band, ...PRINCIPLE, " "),
      weighting: joinColumn(band, ...WEIGHT, "\n"),
    };
    const percentiles = band
      .map((line) => ({ line, label: columnText(line, ...PERCENTILE) }))
      .filter((item) => /^(UQ|M|LQ)$/.test(item.label))
      .sort((a, b) => b.line.y - a.line.y);
    for (const item of percentiles) {
      const row = { ...shared, percentile: item.label };
      for (const [key, minX, maxX] of GRADES) row[key] = columnText(item.line, minX, maxX);
      current.rows.push(row);
    }
  }

  const noteLines = lines.filter(isNoteLine);
  return {
    title: "Admission Grades of JUPAS Applicants (2026 Entry)",
    notes: absorbNotes(noteLines),
    sections: sections.list().filter((section) => section.rows.length),
  };
}

function isFaculty(line) {
  return /^Faculty of /.test(line.text.trim()) && !/^JS\d{4}/.test(columnText(line, ...CODE));
}

function isChrome(line) {
  return /JUPAS Catalogue|Programme\/ Stream|Target Percentile|Programme Weighted|Selection Principle|Subject Weighting|^CHI |^ENG /.test(line.text);
}

function isNoteLine(line) {
  const text = line.text.trim();
  const startsLeft = (line.items[0]?.x || 0) < 120;
  if (/^• /.test(text) && startsLeft) return true;
  return /^(UQ - |M - |LQ - |The Programme Weighted Total|Please refer to Note|Note \d|Note:|Remarks:|Category A subjects|Category C:|Applicants to JS|In the admission process|To protect the data privacy|Please note that as admission|https:\/\/)/.test(text)
    || /grade point conversion/.test(text);
}

function columns() {
  return [
    { key: "code", label: "JUPAS Catalogue No." },
    { key: "programme", label: "Programme / Stream" },
    { key: "percentile", label: "Target Percentile" },
    { key: "chi", label: "CHI" },
    { key: "eng", label: "ENG" },
    { key: "math", label: "MATH" },
    { key: "csd", label: "CSD" },
    { key: "m1", label: "M1/M2" },
    { key: "e1", label: "1st Elective" },
    { key: "e2", label: "2nd Elective" },
    { key: "e3", label: "3rd Elective" },
    { key: "e4", label: "4th Elective" },
    { key: "total", label: "Programme Weighted Total" },
    { key: "principle", label: "Selection Principle" },
    { key: "weighting", label: "Subject Weighting" },
  ];
}
