// ── Skill taxonomy + normalization (LLM-owned extraction, taxonomy-normalized) ──
// The LLM extracts skills from a JD or résumé; this module canonicalizes them
// (k8s → Kubernetes, js → JavaScript) and dedupes, so employer job skills and
// candidate skills share ONE vocabulary and match cleanly. Unknown skills the
// LLM finds are kept as-is (open vocabulary) — the taxonomy normalizes, it
// does not gate. The deterministic extractor here is the no-key fallback and
// uses word-boundary matching, so "django" no longer yields "go", nor
// "javascript" → "java".

// Canonical name → lowercase aliases (the canonical string itself is always an
// implicit alias). Keep this to REAL skills — no generic noise words like
// "data" or "team" (those produced junk criteria before).
const TAXONOMY: Record<string, string[]> = {
  // Languages
  Python: ["py"],
  JavaScript: ["js"],
  TypeScript: ["ts"],
  Java: [],
  Go: ["golang"],
  Rust: [],
  "C++": ["cpp"],
  "C#": ["csharp", ".net", "dotnet"],
  Ruby: ["ruby on rails", "rails"],
  PHP: [],
  Kotlin: [],
  Swift: [],
  Scala: [],
  // Frontend
  React: ["reactjs", "react.js"],
  "React Native": [],
  "Next.js": ["nextjs"],
  Vue: ["vue.js", "vuejs"],
  Angular: [],
  "Node.js": ["node", "nodejs"],
  HTML: [],
  CSS: [],
  Tailwind: ["tailwindcss"],
  // APIs / backend
  GraphQL: [],
  REST: ["rest api", "restful", "rest apis"],
  gRPC: [],
  Microservices: ["microservice"],
  FastAPI: [],
  Django: [],
  Flask: [],
  Spring: ["spring boot"],
  Express: ["express.js"],
  // Data stores
  SQL: [],
  PostgreSQL: ["postgres"],
  MySQL: [],
  MongoDB: ["mongo"],
  Redis: [],
  Elasticsearch: ["elastic search"],
  Snowflake: [],
  Kafka: ["apache kafka"],
  RabbitMQ: [],
  // Cloud / infra
  AWS: ["amazon web services"],
  GCP: ["google cloud", "google cloud platform"],
  Azure: [],
  Docker: [],
  Kubernetes: ["k8s"],
  Terraform: [],
  Ansible: [],
  "CI/CD": ["cicd", "continuous integration", "continuous delivery", "continuous deployment"],
  Jenkins: [],
  Linux: [],
  Observability: ["monitoring", "prometheus", "grafana"],
  // Data / ML
  "Machine Learning": ["ml"],
  "Deep Learning": [],
  NLP: ["natural language processing"],
  LLM: ["large language model", "large language models", "llms"],
  PyTorch: [],
  TensorFlow: [],
  Pandas: [],
  Spark: ["apache spark", "pyspark"],
  ETL: [],
  "Data Engineering": [],
  "Data Science": [],
  Airflow: ["apache airflow"],
  // Practices / soft skills (real requirements JDs ask for)
  Git: [],
  Agile: ["scrum"],
  "System Design": [],
  Leadership: ["team lead", "tech lead", "team leadership", "leading teams"],
  Mentoring: ["mentorship", "mentor", "mentoring engineers"],
  Communication: []
};

// alias (lowercase) → canonical
const ALIAS_TO_CANON: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [canon, aliases] of Object.entries(TAXONOMY)) {
    m.set(canon.toLowerCase(), canon);
    for (const a of aliases) m.set(a.toLowerCase(), canon);
  }
  return m;
})();

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-token match: the alias must not be flanked by another alphanumeric.
// So "go" matches "go"/"go." but NOT "django"; "java" doesn't match "javascript".
function boundaryMatch(lowText: string, alias: string): boolean {
  return new RegExp(`(?<![a-z0-9])${escapeRe(alias.toLowerCase())}(?![a-z0-9])`).test(lowText);
}

/** Canonicalize a single raw skill. Unknown skills are kept (trimmed) — the LLM owns vocabulary. */
export function normalizeSkill(raw: string): string {
  const s = raw.toLowerCase().trim().replace(/\s+/g, " ");
  if (!s) return "";
  return ALIAS_TO_CANON.get(s) ?? raw.trim();
}

/** Canonicalize + dedupe a list (case-insensitive). */
export function normalizeSkills(raws: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of raws) {
    const n = normalizeSkill(r);
    if (!n) continue;
    const key = n.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(n);
    }
  }
  return out;
}

/** Deterministic extractor (no-key fallback): canonical skills present in the text, word-boundary matched. */
export function extractSkillsFromText(text: string): string[] {
  const low = text.toLowerCase();
  const found: string[] = [];
  for (const [canon, aliases] of Object.entries(TAXONOMY)) {
    const forms = [canon.toLowerCase(), ...aliases];
    if (forms.some((f) => boundaryMatch(low, f))) found.push(canon);
  }
  return found;
}

/** Search terms for a skill (for the mock résumé scorer): the canonical + its aliases, or the term itself. */
export function keywordsFor(skill: string): string[] {
  const canon = ALIAS_TO_CANON.get(skill.toLowerCase());
  if (canon) return [canon.toLowerCase(), ...TAXONOMY[canon]];
  return [skill.toLowerCase()];
}
