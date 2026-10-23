import React, { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { createDocument } from "./documents";

type Format = "docx" | "pdf" | "txt";
const labels = { docx: "Word", pdf: "PDF", txt: "plain text" };
type ReadyFile = { url: string; filename: string; format: Format; text: string; name: string };

export function DocumentDownloads({ text, name, disabled = false }: {
  text: string; name: string; disabled?: boolean;
}) {
  const [file, setFile] = useState<ReadyFile | null>(null);
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setFile(null);
    setBusy(null);
    setError("");
    return () => { generation.current++; };
  }, [text, name]);
  useEffect(() => () => { if (file) URL.revokeObjectURL(file.url); }, [file]);

  async function prepare(format: Format) {
    const current = ++generation.current;
    setBusy(format);
    setError("");
    setFile(null);
    try {
      const result = format === "txt"
        ? { blob: new Blob([text], { type: "text/plain;charset=utf-8" }), filename: (name.replace(/[^a-zA-Z0-9 -]/g, "").slice(0, 70) || "application") + ".txt" }
        : await createDocument(text, format, name);
      // A document finishing after an edit or navigation must not replace the current draft's file.
      if (current !== generation.current) return;
      setFile({ ...result, url: URL.createObjectURL(result.blob), format, text, name });
    } catch (e) {
      if (current === generation.current) setError(e instanceof Error ? e.message : "The file could not be prepared. Try plain text.");
    } finally {
      if (current === generation.current) setBusy(null);
    }
  }

  const ready = file && file.text === text && file.name === name && !disabled ? file : null;
  return <section className="document-downloads" aria-label="Download this document">
    <div className="document-actions">
      {(["docx", "pdf", "txt"] as const).map(format => <button key={format}
        className={format === "txt" ? "text-button" : "secondary-button"}
        disabled={!text.trim() || disabled || !!busy}
        onClick={() => void prepare(format)}>
        {busy === format ? <Loader2 size={15} aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}
        {format === "txt" ? "Plain text" : labels[format]}
      </button>)}
    </div>
    <div role="status" aria-live="polite">
      {busy && <p className="fine-print">Preparing your {labels[busy]} file…</p>}
      {error && <p className="career-notice">{error}</p>}
      {ready && <div className="document-ready">
        <p><strong>{ready.format === "txt" ? "Plain text" : labels[ready.format]} file ready.</strong> Save this version using the link below.</p>
        <a className="secondary-button" href={ready.url} download={ready.filename}>
          <Download size={15} aria-hidden="true" /> Download {labels[ready.format]}
        </a>
        <p className="fine-print">{ready.filename} · Editing your draft clears this link so you can prepare the updated version.</p>
      </div>}
    </div>
  </section>;
}
