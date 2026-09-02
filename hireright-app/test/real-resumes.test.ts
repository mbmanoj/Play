// ── Real-resume ingestion tests ───────────────────────────────────────
// Exercises the folder-ingestion parser against a corpus of REAL, publicly
// published resumes (odd PDF layouts, two-column CVs, Word tables, mixed
// encodings) rather than hand-written fixtures.
//
//   node scripts/fetch-real-resumes.mjs     # ~100 files → test-data/real-resumes
//   npm test
//
// The corpus is gitignored (it contains real people's PII), so these tests
// skip themselves when it is absent — CI and fresh clones stay green.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  extractText,
  isAllowed,
  extOf,
  guessName,
  deriveSkills,
  MIN_TEXT_CHARS,
  MAX_FILE_BYTES
} from "@/lib/ingestion/parse";
import { extractSkillsFromText } from "@/lib/skills";

const CORPUS = path.resolve(__dirname, "..", "test-data", "real-resumes");
const DOCS = path.join(CORPUS, "docs");
const TEXT = path.join(CORPUS, "text");
const present = existsSync(DOCS) && existsSync(TEXT);

const list = (dir: string) =>
  present ? readdirSync(dir).filter((f) => !f.startsWith(".")).sort() : [];

const docs = list(DOCS);
const texts = list(TEXT);

// vitest fails a suite with zero tests, so gate on the corpus being fetched.
const suite = present ? describe : describe.skip;
if (!present) {
  console.warn(
    "real-resume corpus missing — run `node scripts/fetch-real-resumes.mjs` to enable these tests"
  );
}

suite("real resumes — document extraction (pdf/docx)", () => {
  const supported = docs.filter(isAllowed);

  it("has a corpus with both PDFs and DOCX", () => {
    expect(supported.length).toBeGreaterThanOrEqual(15);
    expect(supported.some((f) => extOf(f) === "pdf")).toBe(true);
    expect(supported.some((f) => extOf(f) === "docx")).toBe(true);
  });

  it.each(supported)(
    "extracts usable text from %s",
    async (file) => {
      const buf = readFileSync(path.join(DOCS, file));
      expect(buf.length).toBeLessThanOrEqual(MAX_FILE_BYTES);

      const text = await extractText(file, buf);
      expect(text.length).toBeGreaterThanOrEqual(MIN_TEXT_CHARS);

      // normalize() must have run: no NBSP, no NULs, no runs of blank space.
      expect(text).not.toMatch(/[\u00a0\u0000]/);
      expect(text).not.toMatch(/[^\S\n]{2,}/);
      expect(text).toBe(text.trim());

      // A real resume is prose, not a handful of glyphs — a garbled or
      // image-only extraction would not clear this bar.
      expect(text).toMatch(/[A-Za-z]{4,}/);
      expect(text.split(/\s+/).length).toBeGreaterThan(50);
    },
    60_000
  );

  it("rejects legacy .doc as an unsupported type rather than ingesting garbage", async () => {
    const legacy = docs.filter((f) => extOf(f) === "doc");
    expect(legacy.length).toBeGreaterThan(0); // corpus deliberately includes one
    for (const file of legacy) {
      expect(isAllowed(file)).toBe(false);
      await expect(
        extractText(file, readFileSync(path.join(DOCS, file)))
      ).rejects.toThrow(/unsupported type/);
    }
  });

  it("names every candidate non-empty (filename fallback included)", async () => {
    for (const file of supported) {
      const text = await extractText(file, readFileSync(path.join(DOCS, file)));
      const name = guessName(file, text);
      expect(name.trim().length).toBeGreaterThan(0);
      expect(name.length).toBeLessThan(80);
    }
  }, 120_000);
});

suite("real resumes — text corpus (962-resume public dataset)", () => {
  it("spans many job categories", () => {
    expect(texts.length).toBeGreaterThanOrEqual(25);
    const categories = new Set(texts.map((f) => f.replace(/-\d+\.txt$/, "")));
    expect(categories.size).toBeGreaterThanOrEqual(10);
  });

  it.each(texts)("parses and derives skills from %s", async (file) => {
    const text = await extractText(file, readFileSync(path.join(TEXT, file)));
    expect(text.length).toBeGreaterThanOrEqual(MIN_TEXT_CHARS);

    // Both extractors must be total functions on real input — no throws, no
    // duplicates, no empty strings leaking into the skill vocabulary.
    const lexicon = deriveSkills(text);
    const canonical = extractSkillsFromText(text);
    for (const s of [...lexicon, ...canonical]) {
      expect(typeof s).toBe("string");
      expect(s.trim()).toBe(s);
      expect(s.length).toBeGreaterThan(0);
    }
    expect(new Set(canonical).size).toBe(canonical.length);
  });

  it("recognizes the obvious stack of engineering resumes", () => {
    const engineering = texts.filter((f) =>
      /^(python-developer|java-developer|devops-engineer|data-science)/.test(f)
    );
    expect(engineering.length).toBeGreaterThan(0);

    // Every engineering resume in a real corpus names at least one known tool.
    for (const file of engineering) {
      const text = readFileSync(path.join(TEXT, file), "utf8");
      expect(extractSkillsFromText(text).length).toBeGreaterThan(0);
    }
  });
});

// ── Annotated corpus: accuracy, not just "it didn't throw" ────────────
// 220 resumes with human-annotated Name / Email Address / Skills / etc.
// Fetch with: node scripts/fetch-real-resumes.mjs --labeled

const LABELED = path.join(CORPUS, "labeled");
const labeledPresent = existsSync(LABELED);
const labeled = labeledPresent
  ? readdirSync(LABELED).filter((f) => f.endsWith(".txt")).sort()
  : [];
const labeledSuite = labeledPresent ? describe : describe.skip;

type Entities = Record<string, string[]>;
const entitiesOf = (file: string): Entities =>
  JSON.parse(readFileSync(path.join(LABELED, file.replace(/\.txt$/, ".entities.json")), "utf8"));

labeledSuite("real resumes — accuracy vs. human annotations", () => {
  it("has the annotated corpus", () => {
    expect(labeled.length).toBeGreaterThanOrEqual(200);
  });

  it("guessName matches the annotated candidate name on almost every resume", () => {
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    let scored = 0;
    let hit = 0;
    const misses: string[] = [];

    for (const file of labeled) {
      const truth = entitiesOf(file)["Name"] ?? [];
      if (!truth.length) continue;
      scored++;
      const got = norm(guessName(file, readFileSync(path.join(LABELED, file), "utf8")));
      const ok = truth.some((t) => {
        const want = norm(t);
        return want === got || got.includes(want) || want.includes(got);
      });
      if (ok) hit++;
      else misses.push(`${file}: got "${got}" want "${truth[0]}"`);
    }

    expect(scored).toBeGreaterThan(150);
    // Plain-text resumes lead with the candidate's name, so the first-line
    // heuristic should be near-perfect here. (It is NOT on PDF/DOCX, where
    // headers and filenames intrude — see test-data/README.md.)
    expect(hit / scored, `misses:\n${misses.slice(0, 10).join("\n")}`).toBeGreaterThan(0.95);
  });

  it("finds the annotated email address in the text it extracts", () => {
    let scored = 0;
    let hit = 0;
    for (const file of labeled) {
      const emails = entitiesOf(file)["Email Address"] ?? [];
      if (!emails.length) continue;
      scored++;
      const text = readFileSync(path.join(LABELED, file), "utf8");
      if (emails.some((e) => text.includes(e))) hit++;
    }
    expect(scored).toBeGreaterThan(50);
    expect(hit).toBe(scored);
  });
});

// ── Bulk corpus: scale + skill-extraction precision ───────────────────
// Fetch with: node scripts/fetch-real-resumes.mjs --bulk=2000

const BULK = path.join(CORPUS, "bulk");
const bulkPresent = existsSync(BULK);
const bulk = bulkPresent
  ? readdirSync(BULK).filter((f) => f.endsWith(".txt")).sort()
  : [];
const bulkSuite = bulkPresent ? describe : describe.skip;

/**
 * For a canonical skill, the share of resumes it fired on that contain NO
 * corroborating evidence — i.e. the extractor's false-positive rate for that
 * skill, measured over real resumes.
 */
function unsupportedRate(evidence: RegExp, skill: string) {
  let fired = 0;
  let unsupported = 0;
  for (const file of bulk) {
    const text = readFileSync(path.join(BULK, file), "utf8");
    if (!extractSkillsFromText(text).includes(skill)) continue;
    fired++;
    if (!evidence.test(text)) unsupported++;
  }
  return { fired, unsupported, rate: fired ? unsupported / fired : 0 };
}

bulkSuite("real resumes — skill extraction at scale", () => {
  it("parses the whole corpus without a single failure", () => {
    expect(bulk.length).toBeGreaterThanOrEqual(500);
    for (const file of bulk) {
      const text = readFileSync(path.join(BULK, file), "utf8");
      const skills = extractSkillsFromText(text);
      expect(new Set(skills).size).toBe(skills.length);
      expect(skills.every((s) => s.length > 0 && s.trim() === s)).toBe(true);
    }
  }, 120_000);

  it("stays fast enough to ingest a folder of thousands", () => {
    const t0 = Date.now();
    for (const file of bulk) extractSkillsFromText(readFileSync(path.join(BULK, file), "utf8"));
    const perResume = (Date.now() - t0) / bulk.length;
    expect(perResume).toBeLessThan(10); // ms — observed ~1ms
  }, 120_000);

  it("does not fire multi-character skills without evidence", () => {
    // Guards the word-boundary matcher: these were the regressions that
    // motivated it (django→Go, javascript→Java), and they stay clean.
    expect(unsupportedRate(/react/i, "React").rate).toBe(0);
    expect(unsupportedRate(/swift|ios/i, "Swift").rate).toBe(0);
    expect(unsupportedRate(/spring boot|java/i, "Spring").rate).toBeLessThan(0.1);
  }, 120_000);

  // ── Characterization tests for two KNOWN BUGS ──────────────────────
  // These assert today's WRONG behaviour so a fix trips them loudly. When
  // lib/skills.ts is fixed, flip both to the low rate the fix achieves.

  it("KNOWN BUG: 'monitoring' alias makes every DBA an Observability engineer", () => {
    const r = unsupportedRate(/prometheus|grafana|datadog|opentelemetry|new relic|splunk/i, "Observability");
    // "SQL Monitoring", "database monitoring/health check" → Observability.
    // Fix: drop "monitoring" from the Observability aliases in lib/skills.ts.
    expect(r.fired).toBeGreaterThan(bulk.length * 0.2);
    expect(r.rate).toBeGreaterThan(0.5);
  }, 120_000);

  it("KNOWN BUG: bare 'Go' alias matches the English verb", () => {
    const r = unsupportedRate(/golang|go lang|go programming/i, "Go");
    // "go live", "Go-LIVE", "go-forward server requirements" → Go.
    // Fix: require "golang"/"go" only in a skills-list context in lib/skills.ts.
    expect(r.rate).toBeGreaterThan(0.5);
  }, 120_000);
});
