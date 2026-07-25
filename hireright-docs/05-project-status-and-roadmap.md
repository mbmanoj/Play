# Hireright — Project Status & Roadmap

*Living project tracker. Last updated 2026-06-07.*

The North Star: a two-sided AI recruiting SaaS. **Client side** — JD → AI hiring
plan → screen → AI first-round interview → shortlist, client approving every gate.
**Candidate side** — resume-matched jobs, AI mock interviews, apply.

---

## ✅ Done

| Track | Artifact |
|---|---|
| Research & strategy (market, buyer + candidate pain, competitors, feature tiers) | `01-research-synthesis-and-mvp-plan.md` |
| Investor deck outline | `02-investor-deck-outline.md` |
| Build-ready spec (schemas, state machine, invariants) | `03-build-ready-spec.md` |
| Positioning / messaging | `04-positioning-one-pager.md` |
| Visual product overview | `hireright-overview.html` |
| Clickable M1+M2 POC | `poc-m1-m2.html` |
| **Real app — Phase 1 (M0,M1) + Phase 2 (M2,M3,M-Compliance)** | `../hireright-app/` — builds clean, runs |

The thin-slice wedge works today: JD → AI-drafted plan → edit → **approve (Gate 1)**
→ evidence-cited ranked shortlist → audit trail + adverse-impact.
Currently uses **mocked AI** and a **file-backed store**.

---

## ⬜ Pending items

### 🔴 Phase 2 hardening — make what's built real (do first)
- [ ] **Wire real Anthropic API** into `lib/ai/anthropic.ts` (plan gen + ranking); switch on `AI_PROVIDER`, keep mock fallback. *Biggest quality jump.*
- [ ] **Postgres** — replace file store (`lib/db.ts`); migrations from `lib/types.ts`.
- [ ] **Real auth + RBAC** — replace mock login; enforce tenant isolation.
- [ ] **Harden ingestion** — replace `pdf-parse` (audit vulns); robust file/error handling.
- [ ] **Apply POC feedback** to M1/M2 UI once received.

### 🟠 Phase 3 — close the client loop
- [ ] **M4 Outreach & Scheduling** — email + calendar booking + reminders (advance gate).
- [ ] **M5 AI First Interview** — email-native async, multi-turn, adaptive; AI-use disclosed.
- [ ] **M6 Scoring & Recommendation** — evidence-cited scorecard; `is_final=false`.
- [ ] **M7 Shortlist & Client Actions** — package + one-click send/schedule (Gate 3), logged.
- [ ] **M-Status** — candidate "where do I stand" transparency (kills the black hole).

### 🟡 Phase 4 — two-sided + voice
- [ ] **M5 voice** interview.
- [ ] **M8 Candidate Portal** — resume-matched jobs, upload/update, apply.
- [ ] **M9 Mock Interview** — coaching (~$25/mo), private to candidate.

### 🟢 Real integrations
- [ ] **ATS adapters** — Greenhouse / Lever / Ashby (folder ingestion done).

### ⚙️ Cross-cutting (throughout)
- [ ] Automated tests — esp. the **7 invariants**: gate enforcement, plan immutability,
      evidence-required, AI-never-decides, demographic firewall, tenant isolation, append-only audit.
- [ ] Deployment / hosting · security hardening · observability.

---

## Recommended sequence
**Phase 2 hardening (real AI → Postgres → real auth)** → **Phase 3 (M4–M7 + M-Status)**
→ **Phase 4** → integrations & polish. Hardening first upgrades everything already
built without adding scope, making the wedge sellable before extending the pipeline.

## Known environment limitations
- Commits can't be signed (signing key file is empty/unprovisioned) and can't be
  pushed (`403`, no write access to `mbmanoj/Play`). Work is committed locally on
  `claude/lucid-davinci-7esob`; both clear once run where the key is populated and
  the remote is writable.
