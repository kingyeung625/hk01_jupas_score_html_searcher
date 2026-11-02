import { LOGO_DATA_URI } from "./logoData.js";

export function renderHtml(doc) {
  const notes = (doc.notes || []).map((note) => `<li>${inline(note)}</li>`).join("");
  const sections = (doc.sections || []).map(renderSection).join("\n");
  const source = doc.sourceName ? `<p class="meta">來源檔案：${escapeHtml(doc.sourceName)}</p>` : "";
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(doc.title || "JUPAS 收生分數")}</title>
<style>
:root { color-scheme: light; --ink:#1c1917; --muted:#57534e; --line:#e7e5e4; --head:#fff7ed; --accent:#ea580c; --card:#ffffff; }
* { box-sizing: border-box; }
body { margin:0; color:var(--ink); background:#fafaf9; font:16px/1.5 "Segoe UI","PingFang HK","Noto Sans TC","Microsoft JhengHei",sans-serif; }
.wrap { max-width:1200px; margin:0 auto; padding:28px 20px 64px; }
.banner { display:flex; flex-wrap:wrap; align-items:center; gap:16px 20px; margin-bottom:28px; }
.banner img { height:56px; width:auto; flex:0 0 auto; display:block; }
.banner h1 { margin:0; font-size:1.7rem; line-height:1.25; }
.banner .who { margin:4px 0 0; color:var(--muted); }
.meta { margin:8px 0 0; color:var(--muted); font-size:.92rem; }
.notes { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:8px 18px 8px 36px; }
.notes li { margin:8px 0; }
.notes a, td a { color:var(--accent); }
section { margin-top:32px; }
h2 { margin:0 0 12px; font-size:1.25rem; }
.section-notes { color:var(--muted); margin:0 0 12px; }
.table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:12px; background:var(--card); }
table { border-collapse:collapse; width:max-content; min-width:100%; }
th, td { padding:10px 12px; text-align:left; vertical-align:top; border-bottom:1px solid var(--line); white-space:normal; }
th { background:var(--head); font-size:.86rem; position:sticky; top:0; z-index:2; }
td:first-child, th:first-child { position:sticky; left:0; z-index:1; background:#fff; }
th:first-child { z-index:3; background:var(--head); }
tr:last-child td { border-bottom:0; }
@media (max-width:760px) {
  .banner img { height:56px; }
  .table-wrap { border:0; background:transparent; overflow:visible; }
  table, thead, tbody, tr, td { display:block; width:auto; }
  thead { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
  tr { background:var(--card); border:1px solid var(--line); border-radius:12px; margin:0 0 12px; padding:8px 0; }
  td, th { position:static; border-bottom:0; }
  td { display:flex; gap:12px; justify-content:space-between; padding:6px 12px; }
  td.is-empty { display:none; }
  td::before { content:attr(data-label); flex:0 0 42%; font-weight:650; color:var(--muted); }
}
</style>
</head>
<body>
<div class="wrap">
<header class="banner">
<img src="${LOGO_DATA_URI}" alt="01 教育">
<div>
<h1>${escapeHtml(doc.title || "")}</h1>
<p class="who">${escapeHtml(doc.institution || "")}</p>
${source}
</div>
</header>
${notes ? `<ul class="notes">${notes}</ul>` : ""}
${sections}
</div>
</body>
</html>`;
}

function renderSection(section) {
  const notes = (section.notes || []).map((note) => `<p class="section-notes">${inline(note)}</p>`).join("");
  if (!section.columns?.length || !section.rows?.length) {
    return `<section><h2>${escapeHtml(section.heading || "")}</h2>${notes}</section>`;
  }
  const head = section.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
  const body = section.rows.map((row) => {
    const cells = section.columns.map((column) => {
      const value = row[column.key];
      const empty = value == null || value === "" || (typeof value === "object" && !value.text);
      return `<td data-label="${escapeHtml(column.label)}"${empty ? ' class="is-empty"' : ""}>${inline(value)}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("");
  return `<section><h2>${escapeHtml(section.heading || "")}</h2>${notes}<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></section>`;
}

function inline(value) {
  if (value && typeof value === "object") {
    const text = escapeHtml(value.text || "").replace(/\n/g, "<br>");
    if (value.href) return `<a href="${escapeHtml(value.href)}">${text}</a>`;
    return text;
  }
  return escapeHtml(value ?? "").replace(/\n/g, "<br>");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
