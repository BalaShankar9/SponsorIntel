import dataset from "./advisers-data.json" with { type: "json" };
import { reply } from "./auth.js";
import { boundedText } from "./data.js";
export function searchAdvisers(params) {
  const q = (params.get("q") || "").trim().toLowerCase().slice(0, 150);
  const level = ["Level 1", "Level 2", "Level 3"].includes(params.get("level"))
    ? params.get("level")
    : "";
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 6);
  const found = dataset.items.filter(
    (a) =>
      (!level || a.level === level) &&
      terms.every((t) => (a.name + " " + a.id).toLowerCase().includes(t)),
  );
  const pages = Math.ceil(found.length / 12),
    page = Math.max(
      1,
      Math.min(pages || 1, parseInt(params.get("page") || "1") || 1),
    );
  return {
    items: found.slice((page - 1) * 12, page * 12),
    total: found.length,
    page,
    pages,
    catalog_total: dataset.items.length,
    as_of: dataset.as_of,
    published: dataset.published,
    source: dataset.source,
    licence: dataset.licence,
  };
}
export async function advisersAPI(url, env) {
  const row = await env.DB.prepare(
    "SELECT value FROM metadata WHERE key='adviser_dataset'",
  ).first();
  return reply({
    ...searchAdvisers(url.searchParams),
    monitor: row ? JSON.parse(row.value) : null,
  });
}
export async function checkAdviserDataset(env) {
  const checked_at = new Date().toISOString();
  let result;
  try {
    const response = await fetch(
      "https://www.gov.uk/api/content/government/publications/register-of-currently-registered-immigration-advice-organisations",
      {
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
        headers: { Accept: "application/json" },
      },
    );
    if (!response.ok) throw Error("Publication unavailable");
    const data = JSON.parse(await boundedText(response, 1500000));
    const attachments = data.details?.attachments || [];
    const links = attachments
      .map((a) => a.url)
      .filter(
        (u) =>
          typeof u === "string" &&
          u.startsWith("https://assets.publishing.service.gov.uk/"),
      );
    if (!links.length) throw Error("No dataset attachment found");
    const withdrawn = Boolean(
      data.withdrawn_notice && Object.keys(data.withdrawn_notice).length,
    );
    result = {
      checked_at,
      as_of: dataset.as_of,
      new_attachment: !links.includes(dataset.attachment),
      withdrawn,
      source_updated_at: data.public_updated_at || null,
      error: null,
    };
  } catch {
    result = {
      checked_at,
      as_of: dataset.as_of,
      error:
        "The publication check failed. Registration must be checked with the regulator.",
      new_attachment: null,
    };
  }
  await env.DB.prepare(
    "INSERT INTO metadata(key,value) VALUES('adviser_dataset',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  )
    .bind(JSON.stringify(result))
    .run();
  return result;
}
