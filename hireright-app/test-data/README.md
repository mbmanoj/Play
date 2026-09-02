# Real-resume test corpus

Hand-written fixtures don't break the ingester — real resumes do. Real CVs are
two-column, table-heavy, exported from a dozen different Word/LaTeX/Canva
pipelines, full of non-breaking spaces and Wingdings bullets, and sometimes
image-only. This corpus exists so `lib/ingestion/parse.ts` and `lib/skills.ts`
get exercised against documents people actually sent to recruiters.

## Fetch it

```bash
cd hireright-app
node scripts/fetch-real-resumes.mjs          # ~4 MB, ~100 files
node scripts/fetch-real-resumes.mjs --labeled   # + 220 annotated resumes
node scripts/fetch-real-resumes.mjs --bulk=2000 # + 89 MB one-time download
node scripts/fetch-real-resumes.mjs --all
npm test                                     # test/real-resumes.test.ts now runs
```

Output lands in `test-data/real-resumes/`:

| path            | what                                                            |
| --------------- | --------------------------------------------------------------- |
| `docs/`         | 22 real PDF / DOCX / DOC resumes, exactly as published           |
| `text/`         | 75 plain-text resumes (default) spanning 25 job categories       |
| `labeled/`      | 220 resumes + human-annotated `.entities.json` ground truth      |
| `bulk/`         | N resumes sampled from a 29,783-resume labelled corpus           |
| `MANIFEST.json` | provenance + sha256 for every file written                       |

Each tier is gated separately in the test file, so `--labeled` and `--bulk`
stay optional — the base corpus is enough to run `npm test`.

Downloads are cached as `.cache-*` next to the output so re-runs are free;
`--force` re-fetches. Disk: ~7 MB for the base corpus, ~115 MB with `--all`
(the 89 MB bulk zip is kept so `--bulk=N` can be re-sampled offline — delete
`.cache-resumes_corpus.zip` to reclaim it).

The corpus is **gitignored**. `test/real-resumes.test.ts` skips itself when the
corpus is absent, so CI and fresh clones stay green without it.

## Where the resumes come from

All sources are publicly published and need no credentials (notably: no Kaggle
login). Every source is pinned to a commit SHA in the fetch script, so the
corpus is reproducible.

### Documents (PDF / DOCX) — real CVs from real job seekers

| Source | Files | Notes |
| ------ | ----- | ----- |
| [JAIJANYANI/Automated-Resume-Screening-System](https://github.com/JAIJANYANI/Automated-Resume-Screening-System) → `Original_Resumes/` | 19 | Recruiter-collected CVs for finance/compliance roles in Singapore. Mixed PDF, DOCX and one legacy `.doc`. The most realistic set here — messy filenames, headers, tables. |
| [OmkarPathak/pyresparser](https://github.com/OmkarPathak/pyresparser) → `OmkarResume.pdf` | 1 | The author's own resume, shipped as parser test input. GPL-3.0. |
| [DhavalThkkar/Resume_Parser](https://github.com/DhavalThkkar/Resume_Parser) → `sample/` | 2 | Sample resumes shipped with the parser. MIT. |

### Text corpus — 962 real resumes across 25 job families

[`UpdatedResumeDataSet.csv`](https://github.com/Priyanshu-1729/Resume-Screening-using-Python)
is a GitHub mirror of the Kaggle
[Resume Dataset](https://www.kaggle.com/datasets/gauravduttakiit/resume-dataset)
(CC0), scraped from LiveCareer: 962 rows of `Category, Resume`. The fetch
script dedupes it (the raw dataset repeats many resumes verbatim) and picks
round-robin across categories, so even a small `--count` spans Java Developer,
Testing, DevOps, HR, Sales, Advocate, Civil Engineer, and the rest.

### Annotated corpus — ground truth for accuracy (`--labeled`)

[DataTurks-Engg/Entity-Recognition-In-Resumes-SpaCy](https://github.com/DataTurks-Engg/Entity-Recognition-In-Resumes-SpaCy)
(`traindata.json` + `testdata.json`) is 220 real resumes with **human-annotated
entities**: `Name`, `Email Address`, `Skills`, `Designation`, `Companies worked
at`, `College Name`, `Degree`, `Graduation Year`, `Location`. The fetcher writes
each as `resume-NNN.txt` plus a `resume-NNN.entities.json` sidecar.

This is the only source here that can measure *accuracy* rather than "the
parser didn't throw" — `test/real-resumes.test.ts` uses it to hold `guessName`
to a 95% floor against the annotated names.

### Bulk corpus — 29,783 resumes (`--bulk=N`)

[florex/resume_corpus](https://github.com/florex/resume_corpus) `resumes_corpus.zip`
(89 MB) is 29,783 real resumes scraped from Indeed, each with a `.lab` file of
job-title labels (Software_Developer, Systems_Administrator, Project_manager,
Security_Analyst, ...). The fetcher samples `N` of them with a fixed seed, so
every machine gets the same slice and thresholds in the tests stay meaningful.

Two ingestion hazards this corpus surfaces and the fetcher handles: the scrape
wrapped hit terms in `<span class="hl">` markup (stripped on write), and a
handful of entries are empty or near-empty (dropped below 200 chars).

### What is NOT reachable from this environment

Checked, and blocked by the session's egress policy — don't waste time on them
from a Claude Code web session:

| Source | Status |
| ------ | ------ |
| Kaggle (`kaggle.com`) | blocked at the proxy; also needs credentials |
| Hugging Face (`huggingface.co`, `datasets-server.…`) | blocked at the proxy |
| Zenodo, figshare, data.world, archive.org | blocked at the proxy |
| Git LFS objects (e.g. [noran-mohamed/Resume-Classification-Dataset](https://github.com/noran-mohamed/Resume-Classification-Dataset) `Dataset.csv`, 65 MB) | the git proxy refuses to sign LFS requests for repos outside the session's authorized set |
| `github.com/<owner>/<repo>/raw/...` | 403 — use `raw.githubusercontent.com` instead |

`raw.githubusercontent.com` works, which is why every source above is pinned to
a raw URL. Off this environment, the richest set is
[Kaggle: snehaanbhawal/resume-dataset](https://www.kaggle.com/datasets/snehaanbhawal/resume-dataset)
— 2,484 resumes as **real PDFs** with matching HTML, the best PDF-layout
torture test available.

## What the corpus found

Running the real corpus through `lib/` surfaced bugs no fixture had:

- **`Observability` fires on 635 of 1,993 resumes; 84% mention no observability
  tool at all.** `lib/skills.ts` aliases `"monitoring"` → `Observability`, so
  "SQL Monitoring" and "database monitoring/health check alert scripts" make
  every Oracle DBA an observability engineer.
- **`Go` fires on 128 resumes; 81% never mention the language.** The bare `"go"`
  alias word-boundary-matches the English verb: "go live", "Go-LIVE",
  "go-forward server requirements".
- **`guessName` returns a non-name on 7 of 21 real PDF/DOCX files** —
  `"PERSONAL PARTICULARS"`, `"Curriculum Vitae"`, `"180517 Vasanthi Kasinathan"`,
  `"PWC Olivia Peter Regulatory Manager"`. It scores 100% on plain-text resumes,
  which is exactly why fixtures never caught it.

The first two are pinned by characterization tests marked `KNOWN BUG` in
`test/real-resumes.test.ts` — fixing `lib/skills.ts` will trip them, which is
the point: flip them to the post-fix rate deliberately.

## Privacy

These are real people's resumes: real names, emails, phone numbers, employers.
They are already public at the URLs above, but that is not a licence to spread
them further.

- Do **not** commit the corpus (`.gitignore` covers it).
- Do **not** ship it to a hosted environment or a third-party API — including
  the Anthropic-backed extraction path in `lib/ai/`. Run parser tests against
  it locally; use `lib/ai/mock.ts` for anything that would leave the machine.
- Do **not** use it as demo data in a screenshot or a deployed preview.

If someone asks to have their resume removed, delete the file and drop its
entry from the source list in `scripts/fetch-real-resumes.mjs`.
