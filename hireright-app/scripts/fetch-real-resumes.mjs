#!/usr/bin/env node
// ── Real-resume test corpus fetcher ───────────────────────────────────
// Downloads REAL, publicly-published resumes so folder ingestion can be
// exercised against actual documents (odd PDF layouts, tables, columns,
// scanned pages, weird encodings) instead of hand-written fixtures.
//
//   node scripts/fetch-real-resumes.mjs [--count=75] [--force]
//
// Output: test-data/real-resumes/  (gitignored — see PRIVACY below)
//   docs/   real PDF/DOCX/DOC files as published by their authors
//   text/   plain-text resumes materialized from a public CSV dataset
//   MANIFEST.json  provenance + sha256 for every file written
//
// PRIVACY: these are real people's resumes and contain real names, emails
// and phone numbers. They are already public at the URLs below, but this
// corpus is NOT committed — keep it out of git, don't redistribute it, and
// don't send it to third-party services. It is local test input only.

import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "test-data", "real-resumes");
const RAW = "https://raw.githubusercontent.com";

// Commits are pinned so the corpus is reproducible even if upstream moves.
const REPOS = {
  screening: {
    repo: "JAIJANYANI/Automated-Resume-Screening-System",
    sha: "af4535d6454374fa7ab79a36b83a34bef722e1bd",
    license: "unlicensed public repo — real recruiter-collected CVs",
    files: [
      "Original_Resumes/180517_Vasanthi Kasinathan.docx",
      "Original_Resumes/CV-Gloria Cheng2018.doc",
      "Original_Resumes/LT CV 201608.docx",
      "Original_Resumes/Resume --Rohini Prakash.pdf",
      "Original_Resumes/eFinancialCareers_TT - CV.DOCX",
      "Original_Resumes/Compliance/L Catterton SG - Compliance (PE)/Lion Global_Ivy Choo_Investment Compliance Assistant Manager.docx",
      "Original_Resumes/Compliance/L Catterton SG - Compliance (PE)/Luminance Fund_Saleem Lalani_Research Associate.pdf",
      "Original_Resumes/Compliance/L Catterton SG - Compliance (PE)/PWC_Olivia Peter_Regulatory Manager.pdf",
      "Original_Resumes/Compliance/L Catterton SG - Compliance (PE)/PWC_Penny Lim_Risk AM.pdf",
      "Original_Resumes/Compliance/L Catterton SG - Compliance (PE)/PWC_Wong Zhong Ming_Senior Audit Associate.pdf",
      "Original_Resumes/Compliance/L Catterton SG - Compliance (PE)/Phillip Capital_Loh Pei Shang_Compliance Manager.docx",
      "Original_Resumes/Compliance/L Catterton SG - Compliance (PE)/Reliance AM_TasneemNasrulla_Compliance Officer.docx",
      "Original_Resumes/Compliance/L Catterton SG - Compliance (PE)/UOB AM_Felyna Lee_Product AVP.pdf",
      "Original_Resumes/Compliance/L Catterton SG - Compliance (PE)/Unity Group_Radhika Singh_Due Diligence Associate.docx",
      "Original_Resumes/Compliance/L Catterton SG - Compliance (PE)/Vertex Venture_Ocvia Freriana_Compliance Lead.pdf",
      "Original_Resumes/Compliance/L Catterton SG - Compliance (PE)/Vickers Financial_Ryan Tang_Compliance Officer.pdf",
      "Original_Resumes/Compliance/L Catterton SG - Compliance (PE)/Xander_Erwina Lau_Finance Compliance Executive.pdf",
      "Original_Resumes/Compliance/L Catterton SG - Compliance (PE)/Xander_Rohit Khandelwal_VP.pdf",
      "Original_Resumes/Compliance/L Catterton SG - Compliance (PE)/Zhongtai International_Jonathan Man_Compliance Manager.docx"
    ]
  },
  pyresparser: {
    repo: "OmkarPathak/pyresparser",
    sha: "a66f25b583f2dd8dbd18f419321eed57b04a006e",
    license: "GPL-3.0 — author's own resume, shipped as parser test input",
    files: ["OmkarResume.pdf"]
  },
  resumeParser: {
    repo: "DhavalThkkar/Resume_Parser",
    sha: "a356c906fec9a8fbd111290b97d7f422fb2e7871",
    license: "MIT — sample resumes shipped with the parser",
    files: ["sample/Dhaval_Thakkar_Resume.pdf", "sample/Santhosh_Narayanan.pdf"]
  }
};

// 962 real resumes (25 job categories) scraped from LiveCareer — the Kaggle
// "Resume Dataset", mirrored on GitHub so it needs no Kaggle credentials.
const CSV = {
  repo: "Priyanshu-1729/Resume-Screening-using-Python",
  sha: "ea8ad5e877a2258154fdc65660875869305aaa4b",
  file: "UpdatedResumeDataSet.csv",
  license: "CC0 (Kaggle: gauravduttakiit/resume-dataset)"
};

const args = process.argv.slice(2);
const flag = (n, d) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.split("=")[1] : d;
};
const FORCE = args.includes("--force");
const COUNT = Number(flag("count", 75));

function rawUrl(repo, sha, file) {
  return `${RAW}/${repo}/${sha}/${file.split("/").map(encodeURIComponent).join("/")}`;
}

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function download(url) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      lastErr = e;
      if (attempt < 4) await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    }
  }
  throw new Error(`${url}: ${lastErr?.message ?? "download failed"}`);
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 16);

// Filenames are used verbatim by the ingester (it derives a candidate name
// from them), so keep the author's original name — only strip path separators.
const safeName = (file) => path.basename(file).replace(/[/\\]/g, "_");

/** Minimal RFC-4180 CSV reader — the resume column contains commas and quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function main() {
  const docsDir = path.join(OUT, "docs");
  const textDir = path.join(OUT, "text");
  await mkdir(docsDir, { recursive: true });
  await mkdir(textDir, { recursive: true });

  const manifest = { generatedAt: new Date().toISOString(), sources: [], files: [] };
  let fetched = 0, cached = 0, failed = 0;

  for (const src of Object.values(REPOS)) {
    manifest.sources.push({ repo: src.repo, sha: src.sha, license: src.license });
    for (const file of src.files) {
      const dest = path.join(docsDir, safeName(file));
      if (!FORCE && (await exists(dest))) {
        manifest.files.push({ path: `docs/${safeName(file)}`, repo: src.repo, file, sha256: sha256(await readFile(dest)) });
        cached++;
        continue;
      }
      try {
        const buf = await download(rawUrl(src.repo, src.sha, file));
        await writeFile(dest, buf);
        manifest.files.push({ path: `docs/${safeName(file)}`, repo: src.repo, file, bytes: buf.length, sha256: sha256(buf) });
        fetched++;
        process.stdout.write(`  ✓ docs/${safeName(file)} (${(buf.length / 1024).toFixed(0)} KB)\n`);
      } catch (e) {
        failed++;
        process.stderr.write(`  ✗ ${file}: ${e.message}\n`);
      }
    }
  }

  // ── text corpus from the CSV dataset ────────────────────────────────
  manifest.sources.push({ repo: CSV.repo, sha: CSV.sha, license: CSV.license });
  const csvPath = path.join(OUT, ".cache-UpdatedResumeDataSet.csv");
  let csvBuf;
  if (!FORCE && (await exists(csvPath))) csvBuf = await readFile(csvPath);
  else {
    csvBuf = await download(rawUrl(CSV.repo, CSV.sha, CSV.file));
    await writeFile(csvPath, csvBuf);
  }

  const rows = parseCsv(csvBuf.toString("utf8"));
  const header = rows.shift();
  const ci = header.indexOf("Category"), ri = header.indexOf("Resume");

  // Round-robin across categories so a small --count still spans all 25 job
  // families, and drop exact duplicates (the dataset repeats many resumes).
  const byCategory = new Map();
  const seen = new Set();
  for (const r of rows) {
    const category = (r[ci] || "").trim();
    const body = (r[ri] || "").trim();
    if (!category || body.length < 200) continue;
    const key = sha256(Buffer.from(body));
    if (seen.has(key)) continue;
    seen.add(key);
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(body);
  }

  const picked = [];
  const queues = [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (let round = 0; picked.length < COUNT; round++) {
    let any = false;
    for (const [category, list] of queues) {
      if (round >= list.length) continue;
      any = true;
      picked.push({ category, body: list[round] });
      if (picked.length >= COUNT) break;
    }
    if (!any) break;
  }

  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const perCat = new Map();
  for (const { category, body } of picked) {
    const n = (perCat.get(category) ?? 0) + 1;
    perCat.set(category, n);
    const name = `${slug(category)}-${String(n).padStart(2, "0")}.txt`;
    const buf = Buffer.from(body, "utf8");
    await writeFile(path.join(textDir, name), buf);
    manifest.files.push({ path: `text/${name}`, repo: CSV.repo, category, bytes: buf.length, sha256: sha256(buf) });
    fetched++;
  }

  await writeFile(path.join(OUT, "MANIFEST.json"), JSON.stringify(manifest, null, 2) + "\n");

  console.log(
    `\nreal-resume corpus → ${path.relative(ROOT, OUT)}\n` +
      `  documents (pdf/docx/doc): ${manifest.files.filter((f) => f.path.startsWith("docs/")).length}\n` +
      `  text resumes:             ${picked.length} across ${perCat.size} job categories\n` +
      `  fetched ${fetched}, cached ${cached}, failed ${failed}\n` +
      `\nReal PII inside — gitignored, local test input only. Do not redistribute.\n`
  );
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
