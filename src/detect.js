export const INSTITUTIONS = {
  hku: "香港大學",
  cuhk: "香港中文大學",
  hkust: "香港科技大學",
  polyu: "香港理工大學",
  cityu: "香港城市大學",
  lu: "嶺南大學",
  eduhk: "香港教育大學",
};

const UNSUPPORTED =
  "未能辨認這份 PDF。目前支援香港大學、香港中文大學、香港科技大學、香港理工大學、香港城市大學、嶺南大學及香港教育大學的 JUPAS 收生分數表。";

export function detectInstitution(text) {
  const source = text || "";
  if (/EdUHK/i.test(source)) return "eduhk";
  if (/HKUST JUPAS ADMISSIONS SCORES/i.test(source)) return "hkust";
  if (/CityUHK|cityu\.edu\.hk/i.test(source)) return "cityu";
  if (/Admission Grades of JUPAS Applicants|cuhk\.edu\.hk/i.test(source)) return "cuhk";
  if (/JUPAS Admission Scores \(Main Round\)/i.test(source) && /FACULTY OF ARTS/i.test(source)) return "lu";
  if (/JUPAS \(HKDSE\) Admissions Figures/i.test(source) || /Explanatory Notes on the Calculation of Average HKDSE Scores/i.test(source)) {
    return "polyu";
  }
  if (/hku\.hk\/dse/i.test(source) || /2026 JUPAS Admissions Scores/i.test(source)) return "hku";
  return null;
}

export function unsupportedMessage() {
  return UNSUPPORTED;
}
