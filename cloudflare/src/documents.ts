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
  return { text: text.trim().slice(0, 30000) };
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
export async function exportDocument(
  text: string,
  type: "pdf" | "docx",
  name: string,
) {
  const filename =
    name.replace(/[^a-zA-Z0-9 -]/g, "").slice(0, 70) || "application";
  if (type === "docx") {
    const { Document, Packer, Paragraph, TextRun } = await import("docx");
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: text.split("\n").map(
            (line) =>
              new Paragraph({
                children: [
                  new TextRun({ text: line, size: 22, font: "Calibri" }),
                ],
                spacing: { after: 100 },
              }),
          ),
        },
      ],
    });
    download(await Packer.toBlob(doc), filename + ".docx");
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
    doc.setFontSize(11);
    let y = 20;
    for (const line of text
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, "-")
      .split("\n"))
      for (const wrapped of doc.splitTextToSize(line || " ", 170)) {
        if (y > 277) {
          doc.addPage();
          y = 20;
        }
        doc.text(wrapped, 20, y);
        y += 5.5;
      }
    doc.save(filename + ".pdf");
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
