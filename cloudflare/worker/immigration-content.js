import { plainText } from "./jobs.js";

export const WATCHED_SOURCES = [
  {
    id: "graduate",
    topic: "graduate",
    path: "/graduate-visa",
    part: "overview",
    kind: "guidance",
  },
  {
    id: "student",
    topic: "student",
    path: "/student-visa",
    part: "overview",
    kind: "guidance",
  },
  {
    id: "skilled-job",
    topic: "skilled-worker",
    path: "/skilled-worker-visa/your-job",
    part: "your-job",
    kind: "guidance",
  },
  {
    id: "skilled-salary",
    topic: "skilled-worker",
    path: "/skilled-worker-visa/when-you-can-be-paid-less",
    part: "when-you-can-be-paid-less",
    kind: "guidance",
  },
  {
    id: "healthcare-job",
    topic: "health-care",
    path: "/health-care-worker-visa/your-job",
    part: "your-job",
    kind: "guidance",
  },
  {
    id: "rules",
    topic: "general",
    path: "/government/collections/immigration-rules-statement-of-changes",
    kind: "collection",
  },
];

export function statementPath(path) {
  return (
    typeof path === "string" &&
    /^\/government\/publications\/statement-of-changes-to-the-immigration-rules-[a-z0-9-]+$/.test(
      path,
    )
  );
}

export function isWithdrawn(data) {
  // Live GOV.UK responses include withdrawn_notice: {} for active documents.
  const notice = data.withdrawn_notice || data.withdrawal_notice;
  return (
    data.withdrawn === true ||
    Boolean(notice && typeof notice === "object" && Object.keys(notice).length)
  );
}

export function extractContent(data, source) {
  const expectedBase =
    source.part && source.part !== "overview"
      ? source.path.slice(0, source.path.lastIndexOf("/"))
      : source.path;
  if (data.base_path !== expectedBase || !data.title || !data.details)
    throw new Error("Unexpected official document");
  let title = data.title,
    body = "",
    discovered = [];
  if (source.part) {
    const part = data.details.parts?.find((p) => p.slug === source.part);
    if (!part?.body) throw new Error("Official guide section unavailable");
    body = plainText(part.body);
    if (source.part !== "overview") title += ": " + part.title;
  } else if (source.kind === "collection") {
    discovered = (data.links?.documents || [])
      .filter((d) => statementPath(d.base_path))
      .sort((a, b) =>
        String(b.public_updated_at || "").localeCompare(
          String(a.public_updated_at || ""),
        ),
      )
      .slice(0, 4)
      .map((d) => ({
        path: d.base_path,
        title: d.title,
        updated: d.public_updated_at || "",
        withdrawn: Boolean(d.withdrawn),
      }));
    if (!discovered.length)
      throw new Error(
        "Official collection contains no recognised publications",
      );
    // Some GOV.UK collections have an empty body. Track their document list.
    body = JSON.stringify(discovered);
  } else {
    const attachments = (data.details.attachments || []).map((a) => ({
      title: a.title || "",
      url: a.url || "",
    }));
    body = [
      plainText(data.description),
      plainText(data.details.body),
      JSON.stringify(attachments),
    ].join("\n\n");
    if (!plainText(data.details.body) && !attachments.length)
      throw new Error("Official publication unavailable");
  }
  if (body.length < 30 || body.length > 150000)
    throw new Error("Unexpected official content size");
  return {
    title: plainText(title).slice(0, 240),
    body,
    withdrawn: isWithdrawn(data),
    updated:
      typeof data.public_updated_at === "string"
        ? data.public_updated_at.slice(0, 40)
        : "",
    discovered,
  };
}

export async function contentHash(content) {
  // Timestamps alone miss changes in multipart guides. Include the actual text.
  const value = JSON.stringify([
    content.title,
    content.body.replace(/\s+/g, " ").trim(),
    content.withdrawn,
  ]);
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}

export function summaryState(source, summary, now = Date.now()) {
  if (source.withdrawn) return { status: "withdrawn", summary: null };
  if (!source.last_success) return { status: "unavailable", summary: null };
  if (
    source.error ||
    now - Date.parse(source.last_success) > 60 * 60 * 1000 ||
    !Number.isFinite(Date.parse(source.last_success))
  )
    return { status: "delayed", summary: null };
  if (!summary)
    return {
      status:
        source.kind === "guidance"
          ? "awaiting_summary"
          : "official_publication",
      summary: null,
    };
  if (summary.content_hash !== source.content_hash)
    return { status: "source_changed", summary: null };
  return { status: "explained", summary };
}

export function versionKind(previous, contentHash, newPublication = false) {
  if (!previous?.content_hash) return newPublication ? "published" : "baseline";
  return previous.content_hash === contentHash ? null : "changed";
}
