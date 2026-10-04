export const REGISTER_URL =
  "https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers";
export const clean = (s) =>
  String(s || "")
    .trim()
    .replace(/\s+/g, " ");
export const keyFor = (name, city, county) =>
  [name, city, county].map((s) => clean(s).toLowerCase()).join("|");
export async function idFor(key) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}
export function parseCSVLine(line) {
  const cells = [];
  let cell = "",
    quote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quote && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else quote = !quote;
    } else if (c === "," && !quote) {
      cells.push(cell);
      cell = "";
    } else cell += c;
  }
  cells.push(cell.replace(/\r$/, ""));
  return cells;
}
export async function* csvRows(stream, maxBytes = 25000000) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let row = "",
    quote = false,
    bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error("Register exceeds permitted size");
      const text = decoder.decode(value, { stream: true });
      for (const c of text) {
        if (c === '"') quote = !quote;
        if (c === "\n" && !quote) {
          yield parseCSVLine(row);
          row = "";
        } else row += c;
        if (row.length > 20000) throw new Error("Oversized CSV row");
      }
    }
    row += decoder.decode();
    if (quote) throw new Error("Malformed CSV quotes");
    if (row.trim()) yield parseCSVLine(row);
  } finally {
    reader.releaseLock();
  }
}
export function toRecord(cells) {
  if (cells.length !== 5) throw new Error("Unexpected register columns");
  const [name, city, county, rating, route] = cells.map(clean);
  if (!name || !rating || !route) throw new Error("Incomplete register row");
  return { name, city, county, rating, route };
}
export async function boundedText(response, max) {
  if (!response.ok) throw new Error("Source unavailable");
  const reader = response.body.getReader();
  let n = 0,
    result = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const x = await reader.read();
      if (x.done) break;
      n += x.value.byteLength;
      if (n > max) throw new Error("Source exceeds permitted size");
      result += decoder.decode(x.value, { stream: true });
    }
    return result + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
export function csvSource(html) {
  const match = html.match(
    /href="(https:\/\/assets\.publishing\.service\.gov\.uk\/[^"\s]+\.csv)"/i,
  );
  if (!match) throw new Error("Official CSV not found");
  const url = new URL(match[1]);
  if (url.hostname !== "assets.publishing.service.gov.uk")
    throw new Error("Unexpected source host");
  const date = url.pathname.match(/(20\d{2}-\d{2}-\d{2})/);
  if (!date) throw new Error("Source date not available");
  return { url: url.href, date: date[1] };
}
export function querySpec(params) {
  const q = clean(params.get("q")).slice(0, 100),
    city = clean(params.get("city")).slice(0, 100),
    route = clean(params.get("route")).slice(0, 100),
    a = params.get("rating") === "A";
  const page = Math.min(
    30000,
    Math.max(1, parseInt(params.get("page") || "1") || 1),
  );
  let where = "snapshot = ?";
  const values = [];
  const escape = (s) => s.replace(/[\\%_]/g, "\\$&");
  if (q) {
    where += " AND (name LIKE ? ESCAPE '\\' OR city LIKE ? ESCAPE '\\')";
    values.push("%" + escape(q) + "%", "%" + escape(q) + "%");
  }
  if (city) {
    where += " AND city = ? COLLATE NOCASE";
    values.push(city);
  }
  if (route === "Skilled Worker") {
    where += " AND skilled = 1";
  } else if (route) {
    where +=
      " AND EXISTS (SELECT 1 FROM json_each(sponsors.routes) WHERE value = ?)";
    values.push(route);
  }
  if (a) {
    where += ` AND NOT EXISTS (SELECT 1 FROM json_each(sponsors.ratings) WHERE value NOT LIKE '%(A rating)%' AND value NOT LIKE '%(A (Premium))%' AND value NOT LIKE '%(A (SME+))%')`;
  }
  return { q, city, route, page, where, values };
}
