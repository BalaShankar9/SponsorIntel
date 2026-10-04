import { boundedText, idFor } from "./data.js";
import {
  WATCHED_SOURCES,
  extractContent,
  contentHash,
  summaryState,
  versionKind,
} from "./immigration-content.js";
import { EXPLAINERS } from "./immigration-explainers.js";

async function readOfficial(source) {
  // Sources are fixed here or discovered from the allowlisted GOV.UK collection.
  const apiPath =
    source.part && source.part !== "overview"
      ? source.path.slice(0, source.path.lastIndexOf("/"))
      : source.path;
  const response = await fetch("https://www.gov.uk/api/content" + apiPath, {
    headers: {
      Accept: "application/json",
      "User-Agent": "SponsorIntel/2.1 (+https://sponsorintel.london)",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("GOV.UK response " + response.status);
  return extractContent(
    JSON.parse(await boundedText(response, 2_000_000)),
    source,
  );
}

async function refreshSource(env, source, newPublication = false) {
  const now = new Date().toISOString(),
    url = "https://www.gov.uk" + source.path;
  try {
    const content = await readOfficial(source),
      hash = await contentHash(content);
    const previous = await env.DB.prepare(
      "SELECT content_hash FROM immigration_sources WHERE id=?",
    )
      .bind(source.id)
      .first();
    const kind = versionKind(previous, hash, newPublication);
    const statements = [
      env.DB.prepare(
        `INSERT INTO immigration_sources(id,topic,title,url,kind,content_hash,content,source_updated_at,checked_at,last_success,error,withdrawn)
      VALUES(?,?,?,?,?,?,?,?,?,?,NULL,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,content_hash=excluded.content_hash,content=excluded.content,source_updated_at=excluded.source_updated_at,checked_at=excluded.checked_at,last_success=excluded.last_success,error=NULL,withdrawn=excluded.withdrawn`,
      ).bind(
        source.id,
        source.topic,
        content.title,
        url,
        source.kind,
        hash,
        content.body,
        content.updated,
        now,
        now,
        content.withdrawn ? 1 : 0,
      ),
    ];
    if (kind)
      statements.push(
        env.DB.prepare(
          "INSERT INTO immigration_versions(id,source_id,content_hash,content,detected_at,source_updated_at,kind) VALUES(?,?,?,?,?,?,?)",
        ).bind(
          crypto.randomUUID(),
          source.id,
          hash,
          content.body,
          now,
          content.updated,
          kind,
        ),
      );
    await env.DB.batch(statements);
    // Retain the most recent 20 snapshots per source, including rollback events.
    await env.DB.prepare(
      "DELETE FROM immigration_versions WHERE source_id=? AND id NOT IN (SELECT id FROM immigration_versions WHERE source_id=? ORDER BY detected_at DESC,id DESC LIMIT 20)",
    )
      .bind(source.id, source.id)
      .run();
    return {
      id: source.id,
      state: kind || "unchanged",
      discovered: content.discovered,
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "immigration_source_failed",
        source: source.id,
        message: error instanceof Error ? error.message : "Source failed",
      }),
    );
    await env.DB.prepare(
      `INSERT INTO immigration_sources(id,topic,title,url,kind,checked_at,error) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,error=excluded.error`,
    )
      .bind(
        source.id,
        source.topic,
        source.title || source.id,
        url,
        source.kind,
        now,
        "The latest official source could not be checked.",
      )
      .run();
    return { id: source.id, state: "unavailable", discovered: [] };
  }
}

export async function refreshImmigration(env) {
  const owner = crypto.randomUUID();
  const lock = await env.DB.prepare(
    "INSERT INTO feed_locks(name,owner,expires) VALUES('immigration',?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE expires<? RETURNING owner",
  )
    .bind(owner, Date.now() + 12 * 60 * 1000, Date.now())
    .first();
  if (!lock) return { skipped: "A refresh is already running." };
  try {
    const hadCollection = await env.DB.prepare(
      "SELECT content_hash FROM immigration_sources WHERE id='rules'",
    ).first();
    const results = [];
    // Serial requests respect the GOV.UK Content API's 10 requests/second limit.
    for (const source of WATCHED_SOURCES)
      results.push(await refreshSource(env, source));
    const discovered = results.find((r) => r.id === "rules")?.discovered || [];
    for (const doc of discovered)
      results.push(
        await refreshSource(
          env,
          {
            id: "statement-" + (await idFor(doc.path)),
            path: doc.path,
            title: doc.title,
            topic: "general",
            kind: "publication",
          },
          Boolean(hadCollection?.content_hash),
        ),
      );
    return {
      sources: results.map(({ discovered, ...r }) => r),
      checked_at: new Date().toISOString(),
    };
  } finally {
    await env.DB.prepare(
      "DELETE FROM feed_locks WHERE name='immigration' AND owner=?",
    )
      .bind(owner)
      .run();
  }
}

export async function immigrationAPI(env) {
  const collection = await env.DB.prepare(
    "SELECT content FROM immigration_sources WHERE id='rules'",
  ).first();
  const watchedPublicationURLs = new Set(
    collection?.content
      ? JSON.parse(collection.content).map((d) => "https://www.gov.uk" + d.path)
      : [],
  );
  const rows = (
    await env.DB.prepare(
      "SELECT id,topic,title,url,kind,content_hash,source_updated_at,checked_at,last_success,error,withdrawn FROM immigration_sources ORDER BY CASE kind WHEN 'guidance' THEN 0 WHEN 'publication' THEN 1 ELSE 2 END,source_updated_at DESC",
    ).all()
  ).results;
  const sources = rows
    .filter(
      (row) =>
        row.kind !== "publication" || watchedPublicationURLs.has(row.url),
    )
    .map((row) => ({
      ...row,
      ...summaryState(row, EXPLAINERS[row.id]),
    }));
  const events = (
    await env.DB.prepare(
      `SELECT v.id,v.source_id,s.topic,s.title,s.url,v.detected_at,v.source_updated_at,v.kind
    FROM immigration_versions v JOIN immigration_sources s ON s.id=v.source_id WHERE v.kind<>'baseline' ORDER BY v.detected_at DESC LIMIT 40`,
    ).all()
  ).results;
  return Response.json(
    {
      sources,
      events,
      interval_minutes: 15,
      generated_at: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
