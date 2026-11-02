import { detectInstitution, INSTITUTIONS, unsupportedMessage } from "./detect.js";
import { parseCityu } from "./parsers/cityu.js";
import { parseCuhk } from "./parsers/cuhk.js";
import { parseEduhk } from "./parsers/eduhk.js";
import { parseHku } from "./parsers/hku.js";
import { parseHkust } from "./parsers/hkust.js";
import { parseLu } from "./parsers/lu.js";
import { parsePolyu } from "./parsers/polyu.js";

const PARSERS = {
  hku: parseHku,
  cuhk: parseCuhk,
  hkust: parseHkust,
  polyu: parsePolyu,
  cityu: parseCityu,
  lu: parseLu,
  eduhk: parseEduhk,
};

export function parseScores(extracted, sourceName = "") {
  const institutionId = detectInstitution(extracted.text);
  if (!institutionId) return { error: unsupportedMessage() };
  const doc = PARSERS[institutionId](extracted);
  doc.institutionId = institutionId;
  doc.institution = INSTITUTIONS[institutionId];
  doc.sourceName = sourceName;
  const rowCount = doc.sections.reduce((sum, section) => sum + section.rows.length, 0);
  if (!rowCount) {
    return { error: `已辨認為${doc.institution}，但未能抽出課程分數。這份 PDF 的版面可能已更新。` };
  }
  return doc;
}

export function suggestedFilename(doc) {
  const year = (doc.title || "").match(/20\d{2}/)?.[0] || "jupas";
  return `${doc.institutionId}-${year}-jupas-scores.html`;
}
