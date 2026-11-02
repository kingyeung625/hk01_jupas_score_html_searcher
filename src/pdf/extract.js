/**
 * Positioned text extraction shared by the browser app and Node tests.
 * Callers pass the pdfjs module so the worker can be configured per runtime.
 */

export async function extractDocument(pdfjs, data) {
  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
    verbosity: 0,
  });
  const doc = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const annotations = await page.getAnnotations();
    const items = textContent.items
      .filter((item) => item.str && item.str.trim())
      .map((item) => {
        const [a, b, c, d, x, y] = item.transform;
        const fontSize = Math.hypot(c, d) || Math.hypot(a, b) || item.height || 0;
        return {
          text: item.str,
          x,
          y,
          width: item.width || 0,
          height: item.height || fontSize,
          fontSize,
        };
      });

    const links = annotations
      .filter((annotation) => annotation.subtype === "Link" && annotation.url)
      .map((annotation) => ({
        url: annotation.url,
        x: annotation.rect[0],
        y: annotation.rect[1],
        x2: annotation.rect[2],
        y2: annotation.rect[3],
      }));

    pages.push({
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      items,
      links,
      lines: clusterLines(items),
    });
  }

  const text = pages
    .map((page) => page.lines.map((line) => line.text).join("\n"))
    .join("\n\n");

  return { pages, text };
}

export function clusterLines(items, yTolerance = 2.4) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];

  for (const item of sorted) {
    let line = null;
    for (const candidate of lines) {
      if (Math.abs(candidate.y - item.y) <= yTolerance) {
        line = candidate;
        break;
      }
    }
    if (!line) {
      lines.push({ y: item.y, items: [item] });
    } else {
      line.items.push(item);
    }
  }

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    line.text = joinLineItems(line.items);
    line.x0 = line.items[0].x;
    line.x1 = line.items[line.items.length - 1].x + line.items[line.items.length - 1].width;
  }

  lines.sort((a, b) => b.y - a.y);
  return lines;
}

export function joinLineItems(items) {
  let text = "";
  let previous = null;
  for (const item of items) {
    if (previous) {
      const gap = item.x - (previous.x + (previous.width || 0));
      const spaceThreshold = 1.05;
      if (gap > spaceThreshold || needsSoftSpace(previous.text, item.text)) text += " ";
    }
    text += item.text;
    previous = item;
  }
  return text.replace(/\s+/g, " ").trim();
}

function needsSoftSpace(previous, next) {
  if (!previous || !next) return false;
  if (/[A-Za-z0-9)]$/.test(previous) && /^\[/.test(next)) return true;
  if (/\]$/.test(previous) && /^\+/.test(next)) return true;
  return false;
}

export function itemsInXRange(items, minX, maxX) {
  return items.filter((item) => item.x >= minX && item.x < maxX);
}

export function textInXRange(items, minX, maxX) {
  return joinLineItems(itemsInXRange(items, minX, maxX));
}

export function isPageFurniture(text) {
  const value = text.trim();
  if (!value) return true;
  if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(value)) return true;
  if (/^page\s+\d+\s+of\s+\d+/i.test(value)) return true;
  if (/^\d+\s*\/\s*\d+$/.test(value)) return true;
  if (/^\d{1,2}$/.test(value)) return true;
  return false;
}

export function flattenPages(extracted) {
  const lines = [];
  for (const page of extracted.pages) {
    for (const line of page.lines) {
      if (isPageFurniture(line.text)) continue;
      lines.push({
        ...line,
        page: page.pageNumber,
        pageWidth: page.width,
        links: page.links,
      });
    }
  }
  return lines;
}
