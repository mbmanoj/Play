# Hireright — MVP (Phase 1 + 2, with real-AI wiring)

AI recruiting SaaS. **JD in → defensible, evidence-backed ranked shortlist out**, with
the client approving every gate.

## Run it

```bash
cd hireright-app
npm install
npm run dev          # → http://localhost:3000
```

Runs out of the box with **mocked AI** + 8 seed candidates — no config needed.

## Use real Claude (task #2 — done)

```bash
cp .env.local.example .env.local
# edit .env.local:
#   AI_PROVIDER=anthropic
#   ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

- `lib/ai/anthropic.ts` calls **claude-opus-5** with structured JSON output for plan
  generation (M2) and evidence-cited candidate ranking (M3).
- Invariants enforced: **verbatim evidence quotes**, **demographic firewall** (demographics
  are never sent to the model), and the **mock as an automatic per-call fallback** if the API errors.
- Switch is in `lib/ai/index.ts` (`AI_PROVIDER` + key presence). The Integrations page shows
  the effective provider.

## What's implemented

| Module | What you can do |
|---|---|
| **M0 Platform Core** | Demo login, per-client workspace, immutable audit log |
| **M1 Ingestion** | Upload a folder of resumes (PDF/DOCX/TXT/MD) → parsed profiles. ATS/LinkedIn "coming soon". |
| **M2 Closure Plan** | Upload a JD → AI drafts criteria/weights/questions → edit → **approve (Gate 1)** locks an immutable plan. |
| **M3 Resume Filtering** | Rank candidates with **verbatim evidence quotes**, sub-scores, knockout flags, confidence. |
| **M-Compliance** | Append-only audit trail + adverse-impact dashboard (four-fifths rule). Demographics firewalled. |

## Demo flow
Sign in → **+ New role** → "Load sample JD" → approve the plan → **Run screening** →
evidence-cited shortlist → **Compliance** for the audit trail + impact ratios.

## Architecture / swap points
- `lib/ai/` — mock + real Claude behind one interface.
- `lib/db.ts` — file-backed JSON store (`.data/db.json`). Swap for Postgres later.
- `lib/pipeline/state.ts` — pipeline state machine + gates.
- `lib/compliance.ts` — the **only** place demographics are read.
- `lib/ingestion/` — pluggable connectors (folder live; ATS scaffolded).
