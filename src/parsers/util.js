import { joinLineItems } from "../pdf/extract.js";

export function columnItems(line, minX, maxX) {
  return line.items
    .filter((item) => item.x >= minX && item.x < maxX)
    .sort((a, b) => a.x - b.x);
}

export function columnText(line, minX, maxX, { numeric = false } = {}) {
  const items = columnItems(line, minX, maxX);
  if (!items.length) return "";
  if (!numeric) return joinLineItems(items);
  let text = "";
  let previous = null;
  for (const item of items) {
    if (!previous) {
      text = item.text;
    } else {
      const gap = item.x - (previous.x + (previous.width || 0));
      if (/[\d.,]$/.test(text) && /^[.\d]/.test(item.text) && gap < 18) text += item.text;
      else if (gap > 1.4) text += ` ${item.text}`;
      else text += item.text;
    }
    previous = item;
  }
  return text.replace(/\s+/g, " ").trim();
}

export function readingOrder(a, b) {
  return a.page - b.page || b.y - a.y;
}

export function bandLimits(anchor, anchors, blockers, pad) {
  const sorted = anchors.filter((item) => item.page === anchor.page).sort((a, b) => b.y - a.y);
  const index = sorted.indexOf(anchor);
  const previous = sorted[index - 1];
  const next = sorted[index + 1];
  let hi = previous ? (previous.y + anchor.y) / 2 : anchor.y + pad;
  let lo = next ? (anchor.y + next.y) / 2 : anchor.y - pad;
  const above = blockers
    .filter((item) => item.page === anchor.page && item.y > anchor.y)
    .sort((a, b) => a.y - b.y)[0];
  const below = blockers
    .filter((item) => item.page === anchor.page && item.y < anchor.y)
    .sort((a, b) => b.y - a.y)[0];
  if (above && above.y < hi) hi = above.y - 0.4;
  if (below && below.y > lo) lo = below.y + 0.4;
  return { hi, lo };
}

export function groupByAnchors(lines, anchors, blockers, pad = 56) {
  const groups = new Map(anchors.map((anchor) => [anchor, []]));
  for (const line of lines) {
    const samePage = anchors.filter((anchor) => anchor.page === line.page);
    let chosen = null;
    for (const anchor of samePage) {
      const { hi, lo } = bandLimits(anchor, anchors, blockers, pad);
      if (line.y <= hi + 0.2 && line.y >= lo - 0.2) {
        chosen = anchor;
        break;
      }
    }
    if (chosen) groups.get(chosen).push(line);
  }
  for (const group of groups.values()) group.sort((a, b) => b.y - a.y);
  return groups;
}

export function joinColumn(lines, minX, maxX, separator = "\n") {
  const parts = [];
  for (const line of lines) {
    const text = columnText(line, minX, maxX);
    if (text) parts.push(text);
  }
  return parts.join(separator).replace(/[ ]+\n/g, "\n").trim();
}

export function firstNumber(lines, minX, maxX) {
  for (const line of lines) {
    const text = columnText(line, minX, maxX, { numeric: true });
    const match = text.match(/\d[\d.,]*/);
    if (match && /\d/.test(match[0])) return match[0];
  }
  return "";
}

export function cleanSpace(value) {
  return String(value || "").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
}

export function sectionMap(headings) {
  const sections = [];
  const index = new Map();
  return {
    add(heading) {
      const title = cleanSpace(heading) || "Programmes";
      if (!index.has(title)) {
        const section = { heading: title, notes: [], columns: [], rows: [] };
        index.set(title, section);
        sections.push(section);
      }
      return index.get(title);
    },
    list() {
      return sections;
    },
  };
}

export function splitSides(lines, cutX) {
  const left = [];
  const right = [];
  for (const line of lines) {
    const leftItems = line.items.filter((item) => item.x < cutX);
    const rightItems = line.items.filter((item) => item.x >= cutX);
    if (leftItems.length) left.push(remake(line, leftItems));
    if (rightItems.length) right.push(remake(line, rightItems));
  }
  return { left, right };
}

function remake(line, items) {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  return {
    ...line,
    items: sorted,
    text: joinLineItems(sorted),
    x0: sorted[0].x,
    x1: sorted[sorted.length - 1].x + (sorted[sorted.length - 1].width || 0),
  };
}

export function absorbNotes(lines, reject = () => false) {
  const notes = [];
  let current = "";
  const flush = () => {
    const text = cleanSpace(current);
    if (text && !notes.includes(text)) notes.push(text);
    current = "";
  };
  for (const line of lines) {
    const text = cleanSpace(line.text || line);
    if (!text || reject(text)) continue;
    const fresh = /^(•|❖|\d+\.\s|[A-Z]\.\s)/.test(text);
    if (!current) current = text;
    else if (fresh) {
      flush();
      current = text;
    } else current += ` ${text}`;
  }
  flush();
  return notes;
}

export function findLink(lines, minX, maxX) {
  for (const line of lines) {
    for (const link of line.links || []) {
      const centerY = (link.y + link.y2) / 2;
      const centerX = (link.x + link.x2) / 2;
      if (Math.abs(centerY - line.y) <= 10 && centerX >= minX && centerX < maxX) return link.url;
    }
  }
  return "";
}
