"use client";
import { useRef, useState } from "react";
import { ingestFolder } from "@/app/actions";

export default function FolderUpload() {
  const ref = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  return (
    <form
      action={async (fd) => {
        setBusy(true);
        await ingestFolder(fd);
        setBusy(false);
        setNames([]);
        if (ref.current) ref.current.value = "";
      }}
    >
      <input
        ref={ref}
        type="file"
        name="files"
        multiple
        accept=".pdf,.docx,.txt,.md"
        onChange={(e) => setNames(Array.from(e.target.files || []).map((f) => f.name))}
        style={{ marginBottom: ".75rem" }}
      />
      <p className="muted small" style={{ marginBottom: ".75rem" }}>
        Select a folder of resumes or multiple files (PDF, DOCX, TXT, MD). Tip: in the file picker you can select an entire folder&rsquo;s contents.
      </p>
      {names.length > 0 && (
        <p className="small" style={{ marginBottom: ".75rem" }}>{names.length} file(s) selected: {names.slice(0, 5).join(", ")}{names.length > 5 ? "…" : ""}</p>
      )}
      <button className="btn" disabled={busy || names.length === 0}>
        {busy ? "Parsing…" : "Ingest resumes"}
      </button>
    </form>
  );
}
