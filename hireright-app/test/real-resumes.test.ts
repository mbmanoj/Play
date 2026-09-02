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
