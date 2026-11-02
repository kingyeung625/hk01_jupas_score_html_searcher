import { flattenPages } from "../pdf/extract.js";
import { absorbNotes, columnText, groupByAnchors, joinColumn, readingOrder, sectionMap, splitSides } from "./util.js";

const LEFT = {
  code: [0, 160],
  name: [0, 165],
  percentile: [165, 212],
  score: [212, 256],
  chinese: [256, 292],
  english: [292, 326],
  math: [326, 360],
  elective1: [360, 392],
  elective2: [392, 420],
};

const RIGHT = {
  code: [420, 560],
  name: [420, 565],
  percentile: [560, 612],
  score: [612, 652],
  chinese: [652, 688],
  english: [688, 722],
  math: [722, 756],
  elective1: [756, 788],
  elective2: [788, 840],
};

export function parseLu(extracted) {
  const lines = flattenPages(extracted);
  const { left, right } = splitSides(lines, 420);
  const sections = sectionMap();
  collect(left, LEFT, sections);
  collect(right, RIGHT, sections);
  const firstSection = [...left, ...right].filter(isSection).sort(readingOrder)[0];
  const noteLines = lines.filter((line) => firstSection && readingOrder(line, firstSection) < 0);
  return {
    title: "2026 JUPAS Admission Scores (Main Round)",
    notes: absorbNotes(noteLines, (text) => /2026 JUPAS Admission Scores|JUPAS CODE|PROGRAMME NAME|Weighted Admission/.test(text)),
    sections: sections.list().filter((section) => section.rows.length),
  };
}

function collect(lines, cols, sections) {
  const blockers = lines.filter(isSection);
  const anchors = lines.filter((line) => /^JS\d{4}$/.test(columnText(line, ...cols.code)));
  const groups = groupByAnchors(
    lines.filter((line) => !isChrome(line) && !isSection(line)),
    anchors,
    blockers,
    34,
  );
  const events = [
    ...blockers.map((line) => ({ line, kind: "section" })),
    ...anchors.map((line) => ({ line, kind: "row" })),
  ].sort((a, b) => readingOrder(a.line, b.line));
  let current = null;
  for (const event of events) {
    if (event.kind === "section") {
      current = sections.add(event.line.text.replace(/\s+/g, " "));
      current.columns = columns();
      continue;
    }
    if (!current) {
      current = sections.add("Programmes");
      current.columns = columns();
    }
    const band = groups.get(event.line) || [];
    const programme = joinColumn(band, ...cols.name, " ").replace(/\bJS\d{4}\b/g, "").replace(/\s+/g, " ").replace(/\s+-\s*$/, "").trim();
    const code = columnText(event.line, ...cols.code);
    for (const percentile of ["Median", "Lower Quartile"]) {
      current.rows.push({
        code,
        programme,
        percentile,
        score: percentileValue(band, cols, percentile, "score"),
        chinese: percentileValue(band, cols, percentile, "chinese"),
        english: percentileValue(band, cols, percentile, "english"),
        math: percentileValue(band, cols, percentile, "math"),
        elective1: percentileValue(band, cols, percentile, "elective1"),
        elective2: percentileValue(band, cols, percentile, "elective2"),
      });
    }
  }
}

function percentileValue(band, cols, percentile, key) {
  const labels = band.filter((line) => {
    const text = columnText(line, ...cols.percentile);
    if (percentile === "Median") return /Median/.test(text);
    return /Lower|Quartile/.test(text);
  });
  const target = labels.sort((a, b) => b.y - a.y)[0];
  if (!target) return "";
  const sameLine = columnText(target, ...cols[key], { numeric: true });
  if (sameLine) return sameLine;
  const nearest = [...band].sort((a, b) => Math.abs(a.y - target.y) - Math.abs(b.y - target.y));
  for (const line of nearest) {
    if (Math.abs(line.y - target.y) > 8) break;
    const text = columnText(line, ...cols[key], { numeric: true });
    if (text) return text;
  }
  return "";
}

function isSection(line) {
  return /^(FACULTY OF |SCHOOL OF )/.test(line.text.trim());
}

function isChrome(line) {
  return /JUPAS CODE|PROGRAMME NAME|Weighted Admission|Elective|Percentile|^Chinese English Math$|NOTES:/.test(line.text);
}

function columns() {
  return [
    { key: "code", label: "JUPAS Code" },
    { key: "programme", label: "Programme Name" },
    { key: "percentile", label: "Percentile" },
    { key: "score", label: "Weighted Admission Score" },
    { key: "chinese", label: "Chinese" },
    { key: "english", label: "English" },
    { key: "math", label: "Math" },
    { key: "elective1", label: "Elective 1" },
    { key: "elective2", label: "Elective 2" },
  ];
}
