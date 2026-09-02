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
node scripts/fetch-real-resumes.mjs --count=200 --force
npm test                                     # test/real-resumes.test.ts now runs
```

Output lands in `test-data/real-resumes/`:

| path            | what                                                       |
| --------------- | ---------------------------------------------------------- |
| `docs/`         | 22 real PDF / DOCX / DOC resumes, exactly as published      |
| `text/`         | 75 plain-text resumes (default) spanning 25 job categories  |
| `MANIFEST.json` | provenance + sha256 for every file written                  |

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

### Bigger corpora, if 100 files isn't enough

Not wired into the script — reach for these when you need volume:

- [florex/resume_corpus](https://github.com/florex/resume_corpus) —
  `resumes_corpus.zip`, ~89 MB, ~29 k labelled resumes as plain text.
- [noran-mohamed/Resume-Classification-Dataset](https://github.com/noran-mohamed/Resume-Classification-Dataset) —
  `Dataset.csv` via Git LFS (~65 MB), resumes scraped from LiveCareer plus
  Google/Bing Images.
- [Kaggle: snehaanbhawal/resume-dataset](https://www.kaggle.com/datasets/snehaanbhawal/resume-dataset) —
  2 484 resumes as **real PDFs** with matching HTML. The best PDF-layout
  torture test available, but it needs Kaggle credentials.
- Hugging Face mirrors (`brackozi/Resume`, `Unknown92/Resume_dataset`) carry the
  same CSVs if GitHub is blocked in your environment.

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
