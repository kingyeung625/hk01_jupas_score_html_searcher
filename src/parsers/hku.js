import { flattenPages } from "../pdf/extract.js";
import { absorbNotes, cleanSpace, columnText, groupByAnchors, joinColumn, readingOrder, sectionMap } from "./util.js";

const CODE = [0, 72];
const PROGRAMME = [72, 248];
const PRINCIPLE = [248, 400];
const UPPER = [400, 452];
const MEDIAN = [452, 508];
const LOWER = [508, 590];

export function parseHku(extracted) {
  const lines = flattenPages(extracted);
  const weightingStart = lines.find((line) => /Subject Weightings for Specific Programmes/i.test(line.text));
  const body = lines.filter((line) => !weightingStart || readingOrder(line, weightingStart) < 0);
  const header = body.find((line) => columnText(line, 0, 80) === "Code" && /Programme/.test(line.text));
  const noteLines = header ? body.filter((line) => line.page === 1 && line.y > header.y && !isChrome(line)) : [];

  const sections = sectionMap();
  const blockers = body.filter(isSectionLine);
  const anchors = body.filter((line) => /^\d{4}$/.test(columnText(line, ...CODE)));
  const groups = groupByAnchors(
    body.filter((line) => !isChrome(line) && !isSectionLine(line)),
    anchors,
    blockers,
    48,
  );

  const events = [...blockers.map((line) => ({ line, kind: "section" })), ...anchors.map((line) => ({ line, kind: "row" }))].sort(
    (a, b) => readingOrder(a.line, b.line),
  );
  let current = sections.add("Programmes");
  for (const event of events) {
    if (event.kind === "section") {
      current = sections.add(event.line.text);
      continue;
    }
    const band = groups.get(event.line) || [];
    const scoreBlob = joinColumn(band, 400, 590, " ");
    const insufficient = /Insufficient Reference Data/i.test(scoreBlob);
    current.columns = scoreColumns();
    current.rows.push({
      code: columnText(event.line, ...CODE),
      programme: joinColumn(band, ...PROGRAMME, " "),
      principle: joinColumn(band, ...PRINCIPLE, "\n"),
      upper: insufficient ? "Insufficient Reference Data" : joinColumn(band, ...UPPER, " "),
      median: insufficient ? "" : joinColumn(band, ...MEDIAN, " "),
      lower: insufficient ? "" : joinColumn(band, ...LOWER, " "),
    });
  }

  const list = sections.list().filter((section) => section.rows.length);
  if (weightingStart) {
    const weighting = parseWeightings(lines.filter((line) => readingOrder(line, weightingStart) >= 0));
    if (weighting.rows.length) list.push(weighting);
  }

  return {
    title: "2026 JUPAS Admissions Scores",
    notes: absorbNotes(noteLines, (text) => /2026 JUPAS Admissions Scores/.test(text)),
    sections: list,
  };
}

function scoreColumns() {
  return [
    { key: "code", label: "Code" },
    { key: "programme", label: "Programme" },
    { key: "principle", label: "Main Selection Principle" },
    { key: "upper", label: "Upper Quartile" },
    { key: "median", label: "Median" },
    { key: "lower", label: "Lower Quartile" },
  ];
}

function isSectionLine(line) {
  const left = columnText(line, 0, 80);
  if (/^\d{4}$/.test(left)) return false;
  return /^(Faculty of |School of |HKU Business School|Li Ka Shing)/.test(cleanSpace(line.text));
}

function isChrome(line) {
  const text = line.text;
  return (
    /Admissions Score Based on|Main Selection Principle|^Code Programme|^Upper Lower$|^Median$|^Quartile Quartile$/i.test(text) ||
    text === "Code Programme 2026 Main Selection Principle"
  );
}

function parseWeightings(lines) {
  const anchors = lines.filter((line) => /^[1-6]$/.test(columnText(line, 40, 100)));
  const groups = groupByAnchors(
    lines.filter((line) => !/Subject Weightings|Weighting Code Weight Subject/.test(line.text)),
    anchors,
    [],
    36,
  );
  const rows = [...anchors].sort(readingOrder).map((anchor) => {
    const band = groups.get(anchor) || [];
    return {
      weighting: columnText(anchor, 40, 100),
      code: joinColumn(band, 100, 180, " "),
      weight: joinColumn(band, 180, 225, "\n"),
      subject: joinColumn(band, 225, 590, "\n"),
    };
  });
  return {
    heading: "Subject Weightings for Specific Programmes",
    notes: [],
    columns: [
      { key: "weighting", label: "Weighting" },
      { key: "code", label: "Code" },
      { key: "weight", label: "Weight" },
      { key: "subject", label: "Subject" },
    ],
    rows,
  };
}
