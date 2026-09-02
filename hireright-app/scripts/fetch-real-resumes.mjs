#!/usr/bin/env node
// ── Real-resume test corpus fetcher ───────────────────────────────────
// Downloads REAL, publicly-published resumes so folder ingestion can be
// exercised against actual documents (odd PDF layouts, tables, columns,
// scanned pages, weird encodings) instead of hand-written fixtures.
//
//   node scripts/fetch-real-resumes.mjs [--count=75] [--force]
//   node scripts/fetch-real-resumes.mjs --labeled        # +220 annotated
//   node scripts/fetch-real-resumes.mjs --bulk=2000      # +89 MB download
//   node scripts/fetch-real-resumes.mjs --all
//
// Output: test-data/real-resumes/  (gitignored — see PRIVACY below)
//   docs/    real PDF/DOCX/DOC files as published by their authors
//   text/    plain-text resumes materialized from a public CSV dataset
//   labeled/ resumes with human-annotated Name/Skills/etc. ground truth
//   bulk/    sample of a 29,783-resume labelled corpus, for scale runs
//   MANIFEST.json  provenance + sha256 for every file written
//
// PRIVACY: these are real people's resumes and contain real names, emails
// and phone numbers. They are already public at the URLs below, but this
// corpus is NOT committed — keep it out of git, don't redistribute it, and
// don't send it to third-party services. It is local test input only.

import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
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

// 220 resumes with human-annotated entities (Name, Email Address, Skills,
// Designation, College Name, ...). Ground truth — the only source here that
// can measure extraction ACCURACY rather than just "did it not throw".
const LABELED = {
  repo: "DataTurks-Engg/Entity-Recognition-In-Resumes-SpaCy",
  sha: "3a8b01ed8e60048485d4ae6a3bf577b9393f1d84",
  files: ["traindata.json", "testdata.json"],
  license: "public dataset — 220 resumes annotated via DataTurks"
};

// 29,783 real resumes scraped from Indeed, each with job-title labels.
// 89 MB zip, so opt-in: the corpus is for scale/regression runs, not CI.
const BULK = {
  repo: "florex/resume_corpus",
  sha: "24de39957d99caf2c89cf384ba2396bafe16050d",
  file: "resumes_corpus.zip",
  license: "research corpus (Ngoungoure Mfenjou et al.) — labelled resumes"
};

const args = process.argv.slice(2);
const flag = (n, d) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.split("=")[1] : d;
};
const has = (n) => args.some((x) => x === `--${n}` || x.startsWith(`--${n}=`));
const FORCE = args.includes("--force");
const ALL = args.includes("--all");
const COUNT = Number(flag("count", 75));
const LABELED_ON = ALL || has("labeled");
const BULK_ON = ALL || has("bulk");
const BULK_COUNT = Number(flag("bulk", 2000)) || 2000;

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

/**
 * Minimal ZIP support (store + deflate, no zip64) so the bulk corpus needs no
 * dependency and no `unzip` on PATH. The archive holds 59k members, so the
 * central directory is walked once and only selected entries are inflated.
 */
function* centralDirectory(buf) {
  // End of central directory: signature 0x06054b50, scan back over the comment.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 0xffff; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip file (no end-of-central-directory)");

  const total = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < total; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("corrupt central directory");
    const nameLen = buf.readUInt16LE(p + 28);
    const entry = {
      name: buf.toString("utf8", p + 46, p + 46 + nameLen),
      method: buf.readUInt16LE(p + 10),
      compressedSize: buf.readUInt32LE(p + 20),
      localOffset: buf.readUInt32LE(p + 42)
    };
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    yield entry;
  }
}

function zipNames(buf) {
  const names = [];
  for (const e of centralDirectory(buf)) names.push(e.name);
  return names;
}

function unzip(buf, want) {
  const out = new Map();
  for (const e of centralDirectory(buf)) {
    if (!want(e.name)) continue;
    // Local header lengths differ from the central ones — re-read them.
    const start =
      e.localOffset + 30 + buf.readUInt16LE(e.localOffset + 26) + buf.readUInt16LE(e.localOffset + 28);
    const raw = buf.subarray(start, start + e.compressedSize);
    out.set(e.name, e.method === 0 ? Buffer.from(raw) : inflateRawSync(raw));
  }
  return out;
}

// The bulk corpus was scraped from rendered search results, so hit terms are
// wrapped in <span class="hl">. Strip the markup an ingester would never see.
function stripScraperMarkup(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

/** Deterministic shuffle so `--bulk=N` picks the same N on every machine. */
function sampleStable(items, n, seed = 1337) {
  const a = [...items];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
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

  // ── annotated corpus (ground truth for accuracy measurement) ────────
  let labeledCount = 0;
  if (LABELED_ON) {
    const dir = path.join(OUT, "labeled");
    await mkdir(dir, { recursive: true });
    manifest.sources.push({ repo: LABELED.repo, sha: LABELED.sha, license: LABELED.license });
    for (const file of LABELED.files) {
      const cache = path.join(OUT, `.cache-${file}`);
      let raw;
      if (!FORCE && (await exists(cache))) raw = await readFile(cache);
      else {
        raw = await download(rawUrl(LABELED.repo, LABELED.sha, file));
        await writeFile(cache, raw);
      }
      // JSON Lines: one annotated resume per line.
      for (const line of raw.toString("utf8").split("\n")) {
        if (!line.trim()) continue;
        const rec = JSON.parse(line);
        const content = rec.content ?? "";
        if (content.length < 200) continue;
        const entities = {};
        for (const a of rec.annotation ?? []) {
          for (const label of a.label ?? []) {
            for (const pt of a.points ?? []) {
              const t = (pt.text ?? "").trim();
              if (t) (entities[label] ??= new Set()).add(t);
            }
          }
        }
        labeledCount++;
        const base = `resume-${String(labeledCount).padStart(3, "0")}`;
        const body = Buffer.from(content, "utf8");
        await writeFile(path.join(dir, `${base}.txt`), body);
        await writeFile(
          path.join(dir, `${base}.entities.json`),
          JSON.stringify(Object.fromEntries(Object.entries(entities).map(([k, v]) => [k, [...v].sort()])), null, 1) + "\n"
        );
        manifest.files.push({ path: `labeled/${base}.txt`, repo: LABELED.repo, bytes: body.length, sha256: sha256(body) });
      }
    }
    console.log(`  ✓ labeled/ ${labeledCount} resumes with annotated ground truth`);
  }

  // ── bulk corpus (scale + regression runs) ───────────────────────────
  let bulkCount = 0;
  if (BULK_ON) {
    const dir = path.join(OUT, "bulk");
    await mkdir(dir, { recursive: true });
    manifest.sources.push({ repo: BULK.repo, sha: BULK.sha, license: BULK.license });
    const cache = path.join(OUT, `.cache-${BULK.file}`);
    let zip;
    if (!FORCE && (await exists(cache))) zip = await readFile(cache);
    else {
      console.log(`  … downloading ${BULK.file} (~89 MB, one time)`);
      zip = await download(rawUrl(BULK.repo, BULK.sha, BULK.file));
      await writeFile(cache, zip);
    }

    // Two passes: list the members from the central directory cheaply, then
    // inflate only the sampled slice rather than all 29,783.
    const allTxt = zipNames(zip).filter((n) => n.endsWith(".txt")).sort();
    const picked = new Set(sampleStable(allTxt, Math.min(BULK_COUNT, allTxt.length)));
    const wanted = new Set([...picked, ...[...picked].map((n) => n.replace(/\.txt$/, ".lab"))]);
    const entries = unzip(zip, (n) => wanted.has(n));

    const labels = {};
    for (const name of [...picked].sort()) {
      const body = stripScraperMarkup(entries.get(name)?.toString("utf8") ?? "");
      if (body.length < 200) continue; // the corpus contains a few empty rows
      const base = path.basename(name, ".txt");
      const buf = Buffer.from(body, "utf8");
      await writeFile(path.join(dir, `${base}.txt`), buf);
      labels[base] = (entries.get(name.replace(/\.txt$/, ".lab"))?.toString("utf8") ?? "")
        .split("\n").map((l) => l.trim()).filter(Boolean);
      bulkCount++;
    }
    await writeFile(path.join(dir, "_labels.json"), JSON.stringify(labels, null, 0) + "\n");
    manifest.files.push({ path: `bulk/ (${bulkCount} files)`, repo: BULK.repo, sampledFrom: allTxt.length });
    console.log(`  ✓ bulk/ ${bulkCount} resumes sampled from ${allTxt.length}`);
  }

  await writeFile(path.join(OUT, "MANIFEST.json"), JSON.stringify(manifest, null, 2) + "\n");

  console.log(
    `\nreal-resume corpus → ${path.relative(ROOT, OUT)}\n` +
      `  documents (pdf/docx/doc): ${manifest.files.filter((f) => f.path.startsWith("docs/")).length}\n` +
      `  text resumes:             ${picked.length} across ${perCat.size} job categories\n` +
      (LABELED_ON ? `  annotated (ground truth): ${labeledCount}\n` : `  annotated:                — (pass --labeled)\n`) +
      (BULK_ON ? `  bulk corpus:              ${bulkCount}\n` : `  bulk corpus:              — (pass --bulk)\n`) +
      `  fetched ${fetched}, cached ${cached}, failed ${failed}\n` +
      `\nReal PII inside — gitignored, local test input only. Do not redistribute.\n`
  );
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
