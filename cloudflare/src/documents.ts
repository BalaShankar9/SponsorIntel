import { contactFromText } from "../worker/career-quality.js";
import {
  download,
  type CareerProfile,
  type CareerApplication,
} from "./career-data";

export async function importCV(
  file: File,
): Promise<{ text: string; profile?: Partial<CareerProfile> }> {
  if (file.size > 5_000_000) throw Error("Choose a CV smaller than 5 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase();
  let text = "";
  if (ext === "pdf") {
    const pdf = await import("pdfjs-dist");
    pdf.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).href;
    const task = pdf.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    });
    try {
      const doc = await task.promise;
      if (doc.numPages > 15)
        throw Error("Please upload a CV of 15 pages or fewer.");
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        text +=
          content.items
            .map((x) =>
              "str" in x
                ? x.str + ("hasEOL" in x && x.hasEOL ? "\n" : " ")
                : "",
            )
            .join("") + "\n\n";
        if (text.length > 30000) break;
      }
    } finally {
      await task.destroy();
    }
  } else if (ext === "docx") {
    const { extractRawText } = await import("mammoth");
    text = (await extractRawText({ arrayBuffer: await file.arrayBuffer() }))
      .value;
  } else if (ext === "json") {
    const r = JSON.parse(await file.text());
    if (!r.basics || typeof r.basics !== "object")
      throw Error("Choose a JSON Resume file with a basics section.");
    const val = (v: unknown) => (typeof v === "string" ? v : "");
    const arr = (v: unknown) => (Array.isArray(v) ? v : []);
    const basics = r.basics,
      skills = arr(r.skills)
        .map((s) =>
          [
            val(s.name),
            ...arr(s.keywords).filter((x) => typeof x === "string"),
          ].join(", "),
        )
        .join("\n");
    text = [
      val(basics.name),
      val(basics.label),
      val(basics.summary),
      "EXPERIENCE",
      ...arr(r.work).map((w) =>
        [
          val(w.position),
          val(w.name),
          [val(w.startDate), val(w.endDate)].filter(Boolean).join(" — "),
          val(w.summary),
          ...arr(w.highlights).filter((x) => typeof x === "string"),
        ].join("\n"),
      ),
      "EDUCATION",
      ...arr(r.education).map((e) =>
        [
          val(e.institution),
          val(e.studyType),
          val(e.area),
          val(e.startDate),
          val(e.endDate),
        ]
          .filter(Boolean)
          .join(" · "),
      ),
      "SKILLS",
      skills,
      "PROJECTS",
      ...arr(r.projects).map((p) =>
        [
          val(p.name),
          val(p.description),
          ...arr(p.highlights).filter((x) => typeof x === "string"),
        ].join("\n"),
      ),
    ]
      .filter(Boolean)
      .join("\n\n");
    return {
      text: text.slice(0, 30000),
      profile: {
        name: val(basics.name).slice(0, 100),
        email: val(basics.email).slice(0, 200),
        phone: val(basics.phone).slice(0, 80),
        city: val(basics.location?.city).slice(0, 120),
        headline: val(basics.label).slice(0, 160),
        skills: skills.slice(0, 2000),
      },
    };
  } else if (ext === "txt") text = await file.text();
  else throw Error("Choose a PDF, DOCX, TXT or JSON Resume file.");
  if (text.trim().length < 50)
    throw Error(
      "There is not enough selectable text in this file. Paste your CV text below instead.",
    );
  return { text: text.trim().slice(0, 30000), profile: contactFromText(text) };
}
export function exportJSONResume(p: CareerProfile) {
  download(
    JSON.stringify(
      {
        $schema:
          "https://raw.githubusercontent.com/jsonresume/jsonresume.org/master/packages/schema/schema.json",
        basics: {
          name: p.name,
          label: p.headline,
          email: p.email,
          phone: p.phone,
          location: { city: p.city },
          summary: p.cv,
        },
        skills: p.skills
          .split(/,|\n/)
          .map((x) => x.trim())
          .filter(Boolean)
          .map((name) => ({ name })),
        meta: {
          version: "v1.0.0",
          lastModified: new Date().toISOString(),
          note: "Master CV text is preserved in basics.summary; employment dates have not been inferred.",
        },
      },
      null,
      2,
    ),
    "my-cv.json",
    "application/json",
  );
}
export async function createDocument(
  text: string,
  type: "pdf" | "docx",
  name: string,
) {
  const filename =
    name.replace(/[^a-zA-Z0-9 -]/g, "").slice(0, 70) || "application";
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const heading = (line: string) =>
    line.trim().length > 2 &&
    line.trim().length < 65 &&
    /^[A-Z][A-Z &—–\-:0-9]+$/.test(line.trim());
  if (type === "docx") {
    const { Document, Packer, Paragraph, TextRun } = await import("docx");
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 1020, bottom: 1020, left: 1020, right: 1020 },
            },
          },
          children: lines.map(
            (line, index) =>
              new Paragraph({
                children: [
                  new TextRun({
                    text: line,
                    size: index === 0 && heading(line) ? 28 : 21,
                    bold: heading(line),
                    font: "Calibri",
                  }),
                ],
                keepNext: heading(line),
                keepLines: true,
                spacing: {
                  after: line.trim() ? 55 : 25,
                  line: line.trim() ? 255 : 110,
                },
              }),
          ),
        },
      ],
    });
    return { blob: await Packer.toBlob(doc), filename: filename + ".docx" };
  } else {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const response = await fetch("/fonts/NotoSans-Regular.ttf");
    if (!response.ok)
      throw Error("The document font could not load. Try Word or plain text.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    doc.addFileToVFS("NotoSans-Regular.ttf", btoa(binary));
    doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    doc.setFont("NotoSans", "normal");
    const font = doc.getFont().metadata;
    if (
      [...text].some(
        (char) =>
          !/\s/.test(char) && !font.characterToGlyph(char.codePointAt(0)),
      )
    ) {
      throw Error(
        "This PDF font does not cover every character in your draft. Choose Word or plain text to keep your name and wording intact.",
      );
    }
    // Measure complete paragraphs before drawing so a short experience bullet
    // or a section heading never gets stranded across a page boundary.
    const margin = 18,
      bottom = 279,
      lineHeight = 4.8,
      blockGap = 3;
    const blocks = text.split(/\n\s*\n/).filter((block) => block.trim());
    let y = margin,
      firstLine = true;
    for (const block of blocks) {
      const rows: { text: string; size: number; height: number }[] = [];
      for (const raw of block.split("\n")) {
        const line = raw.trimEnd().replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
        const size =
          firstLine && heading(line) ? 14 : heading(line) ? 11 : 10.5;
        firstLine = false;
        doc.setFontSize(size);
        for (const wrapped of doc.splitTextToSize(line || " ", 174))
          rows.push({
            text: wrapped,
            size,
            height: size === 14 ? 6.5 : lineHeight,
          });
      }
      const height =
        rows.reduce((sum, row) => sum + row.height, 0) +
        (rows.length === 1 && heading(rows[0].text) ? lineHeight * 2 : 0);
      if (y > margin && height < bottom - margin && y + height > bottom) {
        doc.addPage();
        y = margin;
      }
      for (const row of rows) {
        if (y + row.height > bottom) {
          doc.addPage();
          y = margin;
        }
        doc.setFontSize(row.size);
        doc.text(row.text, margin, y);
        y += row.height;
      }
      y += blockGap;
    }
    return { blob: doc.output("blob"), filename: filename + ".pdf" };
  }
}
export function exportCalendar(a: CareerApplication) {
  if (!a.followUp) return;
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, "\\$&");
  download(
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Sponsor Intel//Career workspace//EN",
      "BEGIN:VEVENT",
      "UID:" + a.id + "@sponsorintel.london",
      "DTSTAMP:" +
        new Date()
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d+Z/, "Z"),
      "DTSTART;VALUE=DATE:" + a.followUp.replaceAll("-", ""),
      "SUMMARY:" + esc("Follow up: " + a.title + " at " + a.company),
      "DESCRIPTION:" +
        esc("Review your application in Sponsor Intel. " + a.url),
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n"),
    "application-reminder.ics",
    "text/calendar",
  );
}
