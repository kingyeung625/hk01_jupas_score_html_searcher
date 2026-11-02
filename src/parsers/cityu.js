import { flattenPages } from "../pdf/extract.js";
import { absorbNotes, columnText, joinColumn, readingOrder, sectionMap } from "./util.js";

const CODE = [0, 140];
const TITLE = [0, 145];
const ENGLISH = [145, 185];
const CHINESE = [185, 222];
const MATH = [222, 268];
const CSD = [268, 318];
const ELECTIVE1 = [318, 428];
const ELECTIVE2 = [428, 530];
const INCLUDED = [530, 612];
const WEIGHT = [612, 730];
const MEDIAN = [730, 776];
const LOWER = [776, 860];
const REQUIREMENT_KEYS = ["english", "chinese", "mathematics", "csd", "elective1", "elective2", "included", "weighting"];

export function parseCityu(extracted) {
  const lines = flattenPages(extracted);
  const blockers = lines.filter(isSection);
  const anchors = lines.filter((line) => /^JS\d{4}$/.test(columnText(line, ...CODE)));
  const groups = assignToCodeAbove(
    lines.filter((line) => !isChrome(line) && !isSection(line)),
    anchors,
  );
  const sections = sectionMap();
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
    current.rows.push({
      code: columnText(event.line, ...CODE).match(/JS\d{4}/)?.[0] || "",
      programme: joinColumn(band, ...TITLE, " ").replace(/\bJS\d{4}\b/g, "").replace(/\s+/g, " ").trim(),
      english: joinColumn(band, ...ENGLISH, "\n"),
      chinese: joinColumn(band, ...CHINESE, "\n"),
      mathematics: joinColumn(band, ...MATH, "\n"),
      csd: joinColumn(band, ...CSD, "\n"),
      elective1: joinColumn(band, ...ELECTIVE1, "\n"),
      elective2: joinColumn(band, ...ELECTIVE2, "\n"),
      included: joinColumn(band, ...INCLUDED, "\n"),
      weighting: joinColumn(band, ...WEIGHT, "\n"),
      median: scoreText(band, MEDIAN),
      lower: scoreText(band, LOWER),
    });
  }

  for (const section of sections.list()) {
    mergeSplitRequirements(section.rows);
    fillSharedRequirements(section.rows);
  }

  const first = blockers[0];
  const noteLines = lines.filter((line) => !first || readingOrder(line, first) < 0);
  const tail = lines.filter((line) => /^Remarks:?$/i.test(line.text) || (line.page >= 10 && !anchors.some((anchor) => anchor.page === line.page)));

  return {
    title: "CityUHK JUPAS Admissions (2027 Entry)",
    notes: absorbNotes([...noteLines, ...tail], (text) => /JUPAS Admissions \(2027 Entry\)|Minimum Level Required|Programme Title|Main Admission Score/.test(text)),
    sections: sections.list().filter((section) => section.rows.length),
  };
}

function assignToCodeAbove(lines, anchors) {
  const groups = new Map(anchors.map((anchor) => [anchor, []]));
  for (const line of lines) {
    const owner = anchors
      .filter((anchor) => anchor.page === line.page && anchor.y >= line.y - 2)
      .sort((a, b) => a.y - b.y)[0];
    if (owner) groups.get(owner).push(line);
  }
  for (const group of groups.values()) group.sort((a, b) => b.y - a.y);
  return groups;
}

function mergeSplitRequirements(rows) {
  let start = 0;
  while (start < rows.length) {
    let end = start;
    while (end + 1 < rows.length && requirementContinues(rows[end], rows[end + 1])) end += 1;
    if (end > start) {
      for (const key of REQUIREMENT_KEYS) {
        const parts = [];
        for (let index = start; index <= end; index += 1) {
          const value = rows[index][key];
          if (value && !parts.includes(value)) parts.push(value);
        }
        const merged = parts.join("\n").trim();
        for (let index = start; index <= end; index += 1) rows[index][key] = merged;
      }
    }
    start = end + 1;
  }
}

function requirementContinues(previous, next) {
  const weightingContinues = previous.weighting && next.weighting
    && !/other elective subjects/.test(previous.weighting)
    && !/^\d+(?:\.\d+)?:/.test(next.weighting.trim());
  const includedContinues = previous.included && next.included
    && !/subjects\s*$/.test(previous.included)
    && !/^(Best|3 core|Any)\b/.test(next.included.trim());
  return weightingContinues || includedContinues;
}

function scoreText(band, range) {
  const parts = [];
  for (const line of band) {
    const text = columnText(line, ...range).replace(/^(Quartile|Median|Lower|Language)$/g, "").trim();
    if (text) parts.push(text);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function fillSharedRequirements(rows) {
  const hasRequirement = (row) => REQUIREMENT_KEYS.some((key) => row[key]);
  for (let index = rows.length - 2; index >= 0; index -= 1) {
    const row = rows[index];
    const next = rows[index + 1];
    if (!hasRequirement(row) && hasRequirement(next) && (row.median || row.lower)) {
      for (const key of REQUIREMENT_KEYS) row[key] = next[key];
    }
  }
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const previous = rows[index - 1];
    for (const key of REQUIREMENT_KEYS) {
      if (!row[key] && previous[key]) row[key] = previous[key];
    }
  }
}

function isSection(line) {
  const text = line.text.replace(/\s+/g, " ").trim();
  return /^(COLLEGE OF|SCHOOL OF|DOUBLE DEGREE|JOCKEY CLUB COLLEGE)/.test(text);
}

function isChrome(line) {
  return /JUPAS Catalogue|Programme Title|Minimum Level Required|Main Admission Score|Admissions Scores|for 2027 JUPAS|Subject Weightings|HKDSE Subjects|Elective Subjects|Citizenship and Social|English Language|Chinese Language/.test(line.text)
    && !/^JS\d{4}/.test(line.text);
}

function columns() {
  return [
    { key: "code", label: "JUPAS Catalogue No." },
    { key: "programme", label: "Programme Title" },
    { key: "english", label: "English Language" },
    { key: "chinese", label: "Chinese Language" },
    { key: "mathematics", label: "Mathematics" },
    { key: "csd", label: "Citizenship and Social Development" },
    { key: "elective1", label: "Elective 1" },
    { key: "elective2", label: "Elective 2" },
    { key: "included", label: "HKDSE Subjects Included" },
    { key: "weighting", label: "Subject Weightings" },
    { key: "median", label: "Median" },
    { key: "lower", label: "Lower Quartile" },
  ];
}
