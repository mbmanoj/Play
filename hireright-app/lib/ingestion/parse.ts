// ── Resume parsing (M1) ───────────────────────────────────────────────
// Folder/file ingestion: extract text from PDF / DOCX / TXT / MD.
// Server-only (uses Node Buffer + optional native-free parsers).

const SKILL_LEXICON = [
  "python", "java", "typescript", "javascript", "react", "node", "sql",
  "postgres", "postgresql", "aws", "gcp", "kubernetes", "docker", "go",
  "rust", "machine learning", "llm", "nlp", "data", "fastapi", "django",
  "graphql", "terraform", "ci/cd", "rest", "microservices", "etl", "pytorch"
];

export async function extractText(fileName: string, buf: Buffer): Promise<string> {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  try {
    if (ext === "txt" || ext === "md") return buf.toString("utf8");
    if (ext === "docx") {
      const mammoth = await import("mammoth");
      const res = await mammoth.extractRawText({ buffer: buf });
      return res.value;
    }
    if (ext === "pdf") {
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
      const res = await pdfParse(buf);
      return res.text;
    }
  } catch (e) {
    return `[Could not parse ${fileName}: ${(e as Error).message}]`;
  }
  return buf.toString("utf8");
}

export function deriveSkills(text: string): string[] {
  const low = text.toLowerCase();
  return SKILL_LEXICON.filter((s) => low.includes(s));
}

export function guessName(fileName: string, text: string): string {
  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean);
  if (firstLine && firstLine.length < 50 && /^[A-Za-z .'-]+$/.test(firstLine)) {
    return firstLine;
  }
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
}
