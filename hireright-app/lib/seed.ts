import { DB, Candidate } from "./types";

// ── Demo seed data ────────────────────────────────────────────────────
// Eight sample candidate resumes (plain text) so the app has a pool to
// rank out-of-the-box. Demographics are voluntary + firewalled from scoring.

const DEMO_CLIENT = "client_demo";

function cand(
  id: string,
  name: string,
  resumeText: string,
  demographics: Candidate["demographics"]
): Candidate {
  return {
    id,
    clientId: DEMO_CLIENT,
    name,
    source: "seed",
    fileName: `${name.toLowerCase().replace(/\s+/g, "_")}.txt`,
    resumeText,
    skills: extractSkills(resumeText),
    ingestedAt: new Date("2026-06-01T09:00:00Z").toISOString(),
    demographics
  };
}

function extractSkills(text: string): string[] {
  const known = [
    "python", "java", "typescript", "javascript", "react", "node", "sql",
    "postgres", "aws", "gcp", "kubernetes", "docker", "go", "rust",
    "machine learning", "llm", "nlp", "data", "fastapi", "django",
    "graphql", "terraform", "ci/cd", "rest", "microservices"
  ];
  const lower = text.toLowerCase();
  return known.filter((k) => lower.includes(k));
}

const CANDIDATES: Candidate[] = [
  cand(
    "cand_aanya",
    "Aanya Sharma",
    `Senior Backend Engineer with 7 years building scalable services.
Expert in Python, FastAPI, and PostgreSQL. Designed microservices on AWS
handling 50M requests/day. Led migration to Kubernetes and Docker.
Built CI/CD pipelines with Terraform. Mentored 4 junior engineers.
B.Tech Computer Science, IIT Delhi.`,
    { gender: "female", ethnicity: "South Asian", ageBand: "30-50" }
  ),
  cand(
    "cand_ben",
    "Ben Carter",
    `Full-stack developer, 4 years experience. Strong in TypeScript, React,
and Node. Built a GraphQL API and REST microservices. Familiar with SQL
and Postgres. Some AWS exposure. Shipped a customer dashboard used by
10k users. BSc Software Engineering.`,
    { gender: "male", ethnicity: "White", ageBand: "<30" }
  ),
  cand(
    "cand_chen",
    "Chen Wei",
    `Machine Learning Engineer with 6 years in NLP and LLM systems.
Python, PyTorch, and data pipelines. Deployed models on GCP and AWS.
Published 3 papers on NLP. Built a RAG system with vector search.
Strong SQL. PhD candidate, Computer Science.`,
    { gender: "nonbinary", ethnicity: "East Asian", ageBand: "30-50" }
  ),
  cand(
    "cand_diego",
    "Diego Morales",
    `Backend engineer, 9 years. Java and Go specialist. Built high-throughput
microservices and REST APIs. Deep Kubernetes and Docker experience on AWS.
Designed CI/CD with Terraform. SQL and Postgres. Led a team of 6.`,
    { gender: "male", ethnicity: "Hispanic", ageBand: "30-50" }
  ),
  cand(
    "cand_fatima",
    "Fatima Al-Sayed",
    `Software Engineer, 3 years. Python and Django. Built REST APIs and
data processing jobs. Basic AWS. SQL and Postgres. Interested in ML.
BSc Computer Science. Strong problem solver, hackathon winner.`,
    { gender: "female", ethnicity: "Middle Eastern", ageBand: "<30" }
  ),
  cand(
    "cand_grace",
    "Grace Okoro",
    `Senior Platform Engineer, 8 years. Expert in Go, Kubernetes, Docker,
and Terraform on GCP and AWS. Built CI/CD and microservices infrastructure.
Python for tooling. SQL. Reduced deploy time by 80%. Tech lead.`,
    { gender: "female", ethnicity: "Black", ageBand: "30-50" }
  ),
  cand(
    "cand_hiro",
    "Hiroshi Tanaka",
    `Data Engineer, 5 years. Python, SQL, and large-scale data pipelines.
Built ETL on AWS. Some machine learning and LLM prototyping. Postgres
and data warehousing. Familiar with Docker. MSc Data Science.`,
    { gender: "male", ethnicity: "East Asian", ageBand: "30-50" }
  ),
  cand(
    "cand_ivan",
    "Ivan Petrov",
    `Junior developer, 1 year experience. JavaScript and React. Learning
Node and TypeScript. Built a personal project with REST API. Basic SQL.
Bootcamp graduate. Eager to grow into backend engineering.`,
    { gender: "male", ethnicity: "White", ageBand: "<30" }
  )
];

export function seedDB(): DB {
  const now = new Date("2026-06-01T08:00:00Z").toISOString();
  return {
    clients: [{ id: DEMO_CLIENT, name: "Acme Corp" }],
    users: [
      {
        id: "user_demo",
        clientId: DEMO_CLIENT,
        name: "Demo Recruiter",
        email: "recruiter@acme.example",
        role: "admin"
      }
    ],
    jobs: [],
    plans: [],
    candidates: CANDIDATES,
    rankings: [],
    interviews: [],
    scorecards: [],
    actions: [],
    outbox: [],
    audit: [
      {
        eventId: "evt_seed",
        timestamp: now,
        actorType: "system",
        actorId: "system",
        action: "system.seeded",
        entityType: "client",
        entityId: DEMO_CLIENT,
        rationale: "Initial demo data loaded (8 candidates)."
      }
    ]
  };
}

export const SAMPLE_JD = `Senior Backend Engineer

We are hiring a Senior Backend Engineer to design and scale our services.

Requirements (must have):
- 5+ years backend engineering experience
- Strong Python
- Experience with PostgreSQL / SQL
- Microservices and REST API design
- AWS cloud experience

Nice to have:
- Kubernetes and Docker
- CI/CD and Terraform
- Mentoring / team leadership
- Machine learning exposure
`;
