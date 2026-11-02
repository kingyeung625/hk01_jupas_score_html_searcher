import { flattenPages } from "../pdf/extract.js";
import { absorbNotes, columnText, groupByAnchors, joinColumn, readingOrder, sectionMap, splitSides } from "./util.js";

const LEFT = {
  cut: 620,
  code: [0, 76],
  programme: [76, 240],
  highest: [240, 292],
  median: [292, 348],
  lower: [348, 400],
  preferred: [400, 512],
  level: [512, 620],
  sectionX: 120,
};

const RIGHT = {
  code: [620, 672],
  programme: [672, 835],
  highest: [835, 890],
  median: [890, 948],
  lower: [948, 1045],
  perSubject: [1045, 1195],
};

export function parseHkust(extracted) {
  const lines = flattenPages(extracted);
  const { left, right } = splitSides(lines, LEFT.cut);
  const sections = sectionMap();
  parseLeft(left, sections);
  parseRight(right, sections);
  const noteLines = lines.filter((line) => line.page === 1 && line.y > 730 && columnText(line, 0, 620));
  return {
    title: "2026 HKUST JUPAS Admissions Scores",
    notes: absorbNotes(noteLines.map((line) => ({ text: columnText(line, 0, 620) || line.text })), isNoteNoise),
    sections: sections.list().filter((section) => section.rows.length),
  };
}

function parseLeft(lines, sections) {
  const blockers = lines.filter((line) => isSection(line, LEFT.code, LEFT.sectionX));
  const anchors = lines.filter((line) => /^JS\d{4}$/.test(columnText(line, ...LEFT.code)));
  const groups = groupByAnchors(
    lines.filter((line) => !isLeftChrome(line)),
    anchors,
    blockers,
    36,
  );
  addRows(sections, blockers, anchors, groups, (band, anchor) => ({
    code: columnText(anchor, ...LEFT.code),
    programme: joinColumn(band, ...LEFT.programme, " "),
    highest: joinColumn(band, ...LEFT.highest, " "),
    median: joinColumn(band, ...LEFT.median, " "),
    lower: joinColumn(band, ...LEFT.lower, " "),
    preferred: joinColumn(band, ...LEFT.preferred, "\n"),
    level: joinColumn(band, ...LEFT.level, "\n"),
  }), leftColumns());
}

function parseRight(lines, sections) {
  const blockers = lines.filter((line) => isSection(line, RIGHT.code, 80));
  const anchors = lines.filter((line) => /^JS\d{4}$/.test(columnText(line, ...RIGHT.code)));
  const groups = groupByAnchors(
    lines.filter((line) => !isRightChrome(line)),
    anchors,
    blockers,
    30,
  );
  addRows(sections, blockers, anchors, groups, (band, anchor) => ({
    code: columnText(anchor, ...RIGHT.code),
    programme: joinColumn(band, ...RIGHT.programme, " "),
    highest: joinColumn(band, ...RIGHT.highest, " "),
    median: joinColumn(band, ...RIGHT.median, " "),
    lower: joinColumn(band, ...RIGHT.lower, " "),
    perSubject: joinColumn(band, ...RIGHT.perSubject, " "),
  }), rightColumns());
}

function addRows(sections, blockers, anchors, groups, build, columns) {
  const events = [
    ...blockers.map((line) => ({ line, kind: "section" })),
    ...anchors.map((line) => ({ line, kind: "row" })),
  ].sort((a, b) => readingOrder(a.line, b.line));
  let current = null;
  for (const event of events) {
    if (event.kind === "section") {
      const heading = columns.some((column) => column.key === "perSubject") && /Joint Programs/.test(event.line.text)
        ? "Joint Programs (School of Business and Management)"
        : event.line.text;
      current = sections.add(heading);
      current.columns = columns;
      continue;
    }
    if (!current) {
      current = sections.add("Programmes");
      current.columns = columns;
    }
    current.columns = columns;
    current.rows.push(build(groups.get(event.line) || [], event.line));
  }
}

function isSection(line, codeRange, maxWidth) {
  const code = columnText(line, ...codeRange);
  if (/^JS\d{4}$/.test(code)) return false;
  const text = line.text.trim();
  if (line.x1 - line.x0 > 420) return false;
  return /School of |Academy of |Joint Programs/.test(text) && line.items[0].x < codeRange[1] + maxWidth;
}

function isLeftChrome(line) {
  return /PROGRAM|WEIGHTED SCORE|HIGHEST|ATTAINABLE|MEDIAN|QUARTILE|PREFERRED HKDSE|AVERAGE LEVEL|POINTS TO NOTE|HKUST calculates|admissions scores are applicable|public examination|HKDSE score|conversion scale/i.test(line.text);
}

function isRightChrome(line) {
  return /WEIGHTED SCORE|HIGHEST|ATTAINABLE|MEDIAN|LOWER|PER-SUBJECT|AVERAGE SCORE|PROGRAM/.test(line.text) && !/^JS\d{4}/.test(line.text);
}

function isNoteNoise(text) {
  return /WEIGHTED SCORE|HIGHEST|School of Business|AVERAGE LEVEL|PROGRAM/.test(text);
}

function leftColumns() {
  return [
    { key: "code", label: "Programme" },
    { key: "programme", label: "Programme Name" },
    { key: "highest", label: "Highest Attainable" },
    { key: "median", label: "Median" },
    { key: "lower", label: "Lower Quartile" },
    { key: "preferred", label: "Preferred HKDSE Subjects" },
    { key: "level", label: "Average Level" },
  ];
}

function rightColumns() {
  return [
    { key: "code", label: "Programme" },
    { key: "programme", label: "Programme Name" },
    { key: "highest", label: "Highest Attainable" },
    { key: "median", label: "Median" },
    { key: "lower", label: "Lower Quartile" },
    { key: "perSubject", label: "Lower Quartile Per-Subject Average" },
  ];
}
