"use client";
import { useState } from "react";
import { createJob } from "@/app/actions";

export default function NewJobForm({ sampleJd }: { sampleJd: string }) {
  const [title, setTitle] = useState("Senior Backend Engineer");
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form action={async (fd) => { setBusy(true); await createJob(fd); }}>
      <div className="field">
        <label>Role title</label>
        <input type="text" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="field">
        <label>
          Job description{" "}
          <button type="button" className="btn ghost small" style={{ marginLeft: ".5rem", padding: ".2rem .6rem" }}
            onClick={() => setJd(sampleJd)}>
            Load sample JD
          </button>
        </label>
        <textarea name="jdText" value={jd} onChange={(e) => setJd(e.target.value)}
          placeholder="Paste the job description here…" required />
      </div>
      <button className="btn" disabled={busy}>
        {busy ? "Generating plan…" : "Upload JD → generate hiring plan"}
      </button>
    </form>
  );
}
