# AuriHire prompt review: planner.md, screener-extractor.md, screen.md

Independent second opinion, written fresh from the three prompt files, `screen-schema.ts`, `test/evals/rules.ts`, and the Hetero sample (one JD, two resumes). Rewrites that drop in are under `rewrites/lib/ai/`. Every claim below quotes the line it is about.

What I could not see and therefore assume (each is also an open question in §6):

- A1. How the plan's `label`, `keywords`, `terms` and `rationale` become the screen's `expectation`, `alsoCounts`, `fromTheJobDescription` and `alreadyProved`. I assume `label` → `expectation` and `keywords`/`terms` → `alsoCounts`.
- A2. How code combines the screen's `verdict` with the years it computes for `condition` criteria. The rewrite tells the screen to leave years verdicts `unknown` with rows named unless the resume states the figure, so code can decide.
- A3. Where lines are "checked against the resume text". `parseScreenAnswers` only trims them; the check must live elsewhere or the prompt's threat is empty.

---

## 1. The sample, walked through the current prompts

### 1.1 Planner on the Hetero JD

What a correct plan looks like: about 14 criteria, 4 critical (PhD/MD degree; 15 years BA/BE with 5 as head; 3+ USFDA inspections as head/delegate; replicate and RSABE design), high for span of control, budget, patient-BE studies, WinNonlin, inspection-response authorship and regulatory guidance; low for the five good-to-haves and one behaviour (calm under inspection); no criterion for age, location, on-call, pay, process or benefits.

Where the current prompt goes wrong on it:

1. **Tier count.** "Knockouts for a senior role are few: the defining scope dimension, the credential ..., the years/level, and the therapeutic-area or modality depth — four or five critical criteria at most, and always under a third of the plan". Six JD must-haves plus a mandated scope knockout plus a mandated therapeutic-area knockout is eight. "Four or five" and "under a third" of a 12-to-15 plan cannot both hold. P2c lets eight of fifteen through. Then the Quiz Drafter quizzes all eight.
2. **"Preferably in oncology" becomes a knockout.** The exec rule makes "the therapeutic-area or modality depth" a knockout, and the only tier rule for preferences covers degrees and certifications. A candidate with psychiatry patient-BE work only would be `not_met` on a critical criterion. Gundu ("14 oncology studies ... discontinued 2023") passes, but by luck.
3. **The degree combination.** "M.Pharm (Pharmacology or Pharmaceutics) with a PhD, or MD" has no rule. The subject list offers `degreeType in "MD|PhD"` for "MD or PhD" only. The likely draft is `degreeType in "M.Pharm|PhD|MD"` (any-of), which lets Gundu's M.Pharm satisfy the gate. That alone breaks the expected outcome.
4. **"5 years as head of a clinical facility" has no subject.** "Every years figure the JD states becomes a condition" forces a condition, but neither `yearsLeading` ("managing a team") nor `yearsInFunctions` (functions are what the role does, not the scope held) carries "as head". Models pick `yearsInFunctions` with functions "Head of clinical facility", which the extractor's row functions ("clinical operations") never match, so code counts zero years and the criterion fails for everyone.
5. **"Faced at least 3 USFDA inspections ..."** is a count. No subject counts things. "Anything the three kinds cannot express is a plain term criterion" turns it into `term` with terms ["USFDA inspection"], and the count and the "as head of facility or PI's delegate" qualifier are lost, since "label: the requirement itself, and nothing else" forbids them in the label and the screen never sees the rationale. Gundu's Ranbaxy line "Present at 2 USFDA inspections ... as clinical operations head, not as head of facility" then matches the term.
6. **Non-requirement years figures.** "Every years figure the JD states becomes a condition" is stated twice and literally covers "Over the last five years it has hosted inspections", "overlap with them for at least three months", "two to three USFDA inspections a year" and "under 30 days". Nothing says a figure must be about the candidate.
7. **The age band.** "never introduce or infer protected attributes" does not say what to do with one the JD states. A helpful model writes an openQuestion "The job description specifies an age band of 40 to 52; confirm this should be removed", and P7 (`\bage\b`) rejects the draft. Nothing tells it to drop the line silently.
8. **"A seasoned leader".** The rule "emit it as a judgement or term criterion with inferred:true where appropriate, no condition, and put the number in openQuestions" marks a stated phrase inferred and raises an open question about a number the JD already gives (15 years).
9. **"Current hands-on use of Phoenix WinNonlin".** "A condition may only carry a value the JD states" is buried mid-paragraph, and `lastUsedWithin` is the one years subject P10 does not check, so an invented `lastUsedWithin <= 1` passes the evals.
10. **Location.** Handled correctly by "This holds even when the JD states location or on-site presence as a requirement". Kept as is.

### 1.2 Extractor on the two resumes

- Vemuri: "Research Fellow (CSIR-JRF/SRF) ... 2000 – 2004 (Ph.D. work, concurrent)". Under "`yearsExperience` ... or from dated employment (earliest professional start to the latest end)" the model computes 26 years; the resume states 22. `careerStartYear` becomes 2000. Which wins is unspecified, and code computes this anyway.
- Vemuri: "DR. LAKSHMI PRASANNA VEMURI" → `candidateName` "DR. LAKSHMI PRASANNA VEMURI" under "exactly as the resume writes it". "Date of birth: 14 March 1979 | Nationality: Indian" is covered by the protected rule; "Current CTC: on discussion. Notice period: 3 months." and the signed declaration are covered by nothing.
- Vemuri: "Ph.D., Pharmaceutical Sciences" → `degreeType` "Ph.D." under "by name as the resume gives them", or "PhD" under "Expand abbreviations to their common canonical form". The planner emits "PhD" because P10 requires the JD's spelling. Three spellings, no owner.
- Gundu: "Head, Clinical Facility (BA/BE) — 24 years" is a headline; "one row per role held" invites a sixth history row with no employer. "2010 PGDBA (distance)" has no rule, so a model may list it in `degreeType` and treat a diploma as a master's. "Born 1975 (age 51)" is covered.
- Gundu: "Phoenix WinNonlin (hands-on, daily)" in Skills AND "still review every study's concentration-time profiles myself in WinNonlin" in the summary: "No duplicates within a category" says one entry; "A term used in two roles is two entries, one per row" says per row. The summary names no role, so which row? Unspecified.
- Gundu: "a 2019 WHO Notice of Concern" could be stored as a term under a regulatory category and read later as a credential. Nothing says what an adverse finding is.

### 1.3 Screen on the two resumes

- Gundu, degree gate. Education lists M.Pharm, B.Pharm, PGDBA. "a degree that is not on the list" supports `not_met`; "Silence in a resume is not evidence" supports `unknown` (he might hold a PhD he did not list). A cautious first reader or the second reader can flip the rejection to `unknown`. Nothing says an Education section is a complete list.
- Vemuri, "Current hands-on use of Phoenix WinNonlin". Her only tool lines are at Lambda (2012–2017) and a 2016 Certara training. A reader who takes "derived — it follows from what is on the page. Dates ..." literally derives "not used since 2017" and answers `not_met`. The honest answer is `unknown`: the resume does not say she stopped.
- Gundu, "5 years as head". No stated figure. "Never add up years" forbids 2012–present = 14, but nothing says what verdict to give instead, so the model answers `met` or `not_met` from the arithmetic it was told not to do.
- Vemuri, "Telugu" (low). Kakatiya University, Warangal; Guntur; Hyderabad address; a Telugu name. "implied — the work shown means it" has no guard against inferring a language from a place or a name. The correct answer is `unknown`.
- Both, `alreadyProved`, `alsoCounts`, `conditions`, `tier`: the screen receives these fields (`screenQuestions` in `screen-schema.ts`) and the prompt explains only `nameTheRows`. "alreadyProved" reads as "already met".
- Gundu, "Notice period: 3 months; can negotiate to 45 days." If a recruiter adds a notice-period criterion, "set `askCandidate` to true and leave the verdict `unknown`" is right, but the rule does not say "even when the resume states a figure", and this resume states one.

---

## 2. Diagnosis: planner.md (ranked)

**P-1. The critical cap contradicts itself and still inflates.**
Quote: "four or five critical criteria at most, and always under a third of the plan" together with "Right-size the plan: 8–15 criteria" and "the therapeutic-area or modality depth" listed among knockouts.
In practice: on the sample, 8 of ~15 critical, one of them a "preferably". Quiz Drafter and knockout gates both inherit it.
Fix: rewrite rules 15, 16, 20: at least one, at most four, fewer than a third; an ordered rule for which must-haves keep critical when the JD lists more; tools, preferences, behaviours and inferred criteria never critical; domain depth critical only when the JD makes it a must-have.

**P-2. Judgement criteria lose their bar before the screen sees them.**
Quote: "label: the requirement itself, and nothing else ... no 'Experience with X'" and "judgement: ... No terms, no condition; the interview kit draws on these."
In practice: "Faced at least 3 USFDA inspections as head of facility" becomes label "USFDA inspections"; the screen (which never sees the JD or the rationale) cannot tell 1 from 3 or delegate from attendee.
Fix: rule 7: a judgement's label IS the bar and carries the count, scope or role; rule 13: judgements are screened from the resume and answer unknown when silent.

**P-3. Counts and anything unexpressible are forced into `term`.**
Quote: "Anything the three kinds cannot express is a plain term criterion."
In practice: a count criterion gets fake `terms` to satisfy P11, and a term match ("USFDA inspection") on Gundu's Ranbaxy row counts an inspection he attended as a non-head.
Fix: rule 13: whatever the other two kinds cannot express is a judgement.

**P-4. No rule for degree combinations or for choosing degreeType over educationLevel.**
Quote: "named degrees any of which satisfies (`degreeType`, `in`, "MD|PhD" for "MD or PhD")".
In practice: "M.Pharm with a PhD, or MD" → `in "M.Pharm|PhD|MD"` → Gundu passes the gate. Or `educationLevel >= doctorate`, where the extractor counts PharmD as doctorate.
Fix: rule 11 degreeType bullet ("Use this whenever degrees are named"), rule 12 (combination → terminal credential each path needs, "PhD|MD", full wording in the label).

**P-5. "Every years figure ... becomes a condition" is stated twice and is wrong as stated.**
Quote: "Every years figure the JD states becomes a condition; two figures on one line are two conditions on one requirement." (appears in the kinds section and again under Right-size.)
In practice: employer and timeline figures ("three months", "five years", "30 days") become conditions; "5 years as head of a facility" has no subject and gets a `yearsInFunctions` with a function no history row will ever carry.
Fix: rule 12: a value is a figure stated as a requirement of the candidate; the "as head" case maps to `yearsLeading` with the scope in the label; the duplicate is removed. Open question 5 asks for a scope subject.

**P-6. A protected attribute the JD states has no rule, and the "seasoned" rule misfires.**
Quote: "never introduce or infer protected attributes" and "'Senior clinical development leader' with no number is NOT a years condition: emit it as a judgement or term criterion with inferred:true where appropriate, no condition, and put the number in openQuestions."
In practice: "Age: 40 to 52 years" surfaces in an openQuestion and P7 rejects the draft; "seasoned leader" is marked inferred though stated, and spawns a redundant open question.
Fix: rule 5 (drop silently, never in any field) and rule 12 last sentence (ask the number only when the JD gives no other years figure).

**P-7. The executive section invents scope and is pharma-shaped.**
Quote: "Where the JD is silent on a scope dimension the title implies, add it inferred:true" and "Therapeutic-area and modality depth (oncology/hematology, CAR-T, biologics) follows as its own criterion."
In practice: five scope criteria on every Director+ role regardless of JD, crowding a 15-criterion plan; a "therapeutic area" criterion on a VP Engineering plan.
Fix: rules 18–20: scope only where the JD states it, at most one inferred scope criterion, "domain depth" phrased for any industry.

**P-8. Preferences have no tier rule except for degrees.**
Quote: "'Preferred' degrees and certifications are low."
In practice: "Experience with patient BE studies, preferably in oncology" → one criterion whose bar includes oncology.
Fix: rule 6: a preference is a separate low criterion, never a qualifier on a must-have.

**P-9. "Current" and `lastUsedWithin` invite an invented value.**
Quote: "a skill used recently (`lastUsedWithin`, `<=`, "3" for "hands-on in the last three years")" with the only guard, "A condition may only carry a value the JD states", buried mid-paragraph, and P10 not checking this subject.
In practice: `lastUsedWithin <= 1` for "Current hands-on use", passing the evals.
Fix: rule 11 bullet: only when the JD gives the number; otherwise the word goes in the label.

**P-10. Smaller contradictions and duplication.**
- "The screening quiz is drafted by a separate Quiz Drafter step from your critical-tier criteria" vs `rules.ts` Q1, which allows "critical- AND high-tier criteria". Fix: say "from the top tiers".
- `keywords` and `terms` both described as the matching vocabulary ("they drive automated resume matching" / "ANY one of which satisfies"). Fix: rule 8 (keywords = spellings and synonyms, also P4 anchoring) and rule 10 (terms = alternatives, any satisfies).
- "cutoffValue: how many candidates should advance to interviews (default 5 unless the JD signals otherwise)" with "Openings | 1" in the table → cutoff 1. Fix: rule 28, "not the number of openings".
- The logistics rule is a 90-word paragraph; the "even when the JD states it as a requirement" clause is its last sentence. Fix: rule 4, one list.

Further gaps closed in the rewrite: the opening line now tells the model the screen reads criteria without the JD (the reason labels must carry the bar); facts about the employer and its targets are named as never-criteria (rule 4); "nationality" and "caste" are listed as protected (rule 5); good-to-haves are merged rather than must-haves dropped when the plan is full (rule 22).

---

## 3. Diagnosis: screener-extractor.md (ranked)

**E-1. The dedup rule contradicts the per-row rule.**
Quote: "No duplicates within a category; repetition in the resume adds nothing — one mention and twenty mentions both yield one entry." vs "A term used in two roles is two entries, one per row."
In practice: WinNonlin in Vemuri's Lambda row and Gundu's summary and skills list come back as one entry, two, or three depending on which sentence the model read last; the stored record differs per run.
Fix: rule 8: one entry per (term, row); a Skills listing is dropped when a role shows the term in use.

**E-2. The extractor is told to compute years that code computes.**
Quote: "`yearsExperience` ... Take it from an explicit statement ("12 years of experience") or from dated employment (earliest professional start to the latest end)."
In practice: Vemuri → 26 (from the 2000 fellowship) against her stated 22; "Never estimate" in the same section is contradicted; the pipeline note says code "computes years-of-experience conditions from the extracted history".
Fix: rule 12: stated only, never computed.

**E-3. `careerStartYear` falls back to a graduation year and counts student work.**
Quote: "when no role carries a date, the year the first degree was completed."
In practice: a guess presented as a stated value, and an age proxy; Vemuri's start becomes 2000 from a PhD fellowship.
Fix: rule 15: earliest dated role that is not student work; otherwise not stated. Rules 16 and 18 keep fellowships as rows with functions "doctoral research" so code can decide whether they count (open question 4).

**E-4. In-progress degrees and diplomas are not addressed.**
Quote: "`degreeType`: the degrees held, by name as the resume gives them" and "`educationLevel`: the highest level held".
In practice: "PhD (pursuing)" → doctorate; Gundu's "PGDBA (distance)" → a degree, possibly master's.
Fix: rule 4 (in progress → term with level "in progress"), rules 13–14 (diplomas and in-progress degrees never in degreeType, never raise educationLevel).

**E-5. Indian CV fields have no rule beyond protected attributes.**
Quote: "Set `candidateName` to the person's full name exactly as the resume writes it" and "Never infer or record protected attributes (age, gender, race, religion, nationality, disability, family status)".
In practice: candidateName "DR. LAKSHMI PRASANNA VEMURI"; CTC, notice period, declaration, place/signature and "POSITION APPLIED FOR" lines are fair game for `line` or a term.
Fix: rule 3 (list of non-evidence lines never copied), rule 11 (strip honorifics).

**E-6. Headlines become history rows.**
Quote: "Return `history`: one row per role held ... A row without dates is still a row."
In practice: "Head, Clinical Facility (BA/BE) — 24 years" and "POSITION APPLIED FOR: Director – Clinical Pharmacology & BA/BE" become rows with no employer, and code counts their (absent) dates.
Fix: rule 16: headlines, summary bullets, "position applied for" and degrees taken while employed are not rows.

**E-7. LinkedIn durations, overlapping roles and part-time study have no guidance.**
Quote: "`start` and `end` as `YYYY-MM` (or `YYYY` when only the year is given, empty when not stated".
In practice: "Jan 2019 – Present · 4 yrs 7 mos" → the model back-computes or writes the duration into a value; concurrent roles get "adjusted" dates.
Fix: rule 17: ignore duration text; overlapping rows keep their own dates, code handles overlap.

**E-8. The line rule is ambiguous about bullets and wrapped text, and conflicts with per-row entries.**
Quote: "the single resume line (or sentence) it was found in, copied verbatim ... When a term appears in several places, use the line that shows the term in use rather than the one that lists it."
In practice: "(or sentence)" invites joining a wrapped bullet into one string that no longer exists verbatim; the "several places" rule says pick one line while the row rule says emit one per row.
Fix: rule 9: one physical line, no bullet marker, the physical line containing the term when a sentence wraps; "in use over a list entry" applies within an entry.

**E-9. Degree spelling is defined three ways across two files.**
Quote: extractor "by name as the resume gives them ("MD", "PhD", "PharmD", "MBA", "MSc", "Bachelor of Technology")" and "Expand abbreviations ... 'B.Tech' → 'Bachelor of Technology'"; planner P10 forces the JD's spelling ("every degree member appears in the text").
In practice: planner "PhD", extractor "Ph.D." or "Doctor of Philosophy", resume "Ph.D."; code compares strings that never match.
Fix: rule 13 gives one canonical form (common abbreviation without dots). The cross-file mismatch needs code (open question 3).

**E-10. Copy-paste and US-centric residue.**
Quote: "Evaluate ONLY job-relevant content." (there is no job in this call) and "MD, PharmD, JD and PhD all count as doctorate" (MBBS unmapped; MD in India is a postgraduate clinical degree).
In practice: harmless noise in the first case; in the second, MBBS holders get an empty educationLevel.
Fix: rule 23 drops the phrase; rule 14 maps MBBS → bachelor and keeps the existing doctorate set unchanged pending open question 3.

Further gaps closed: adverse inspection outcomes are not terms (rule 5), publication and thesis titles are evidence of their subject (rule 1), credentials are recorded as claimed never verified (rule 4), `scope` tie-break by title (rule 19).

---

## 4. Diagnosis: screen.md (ranked)

**S-1. The verdict for a years criterion is undefined.**
Quote: "Never add up years. ... You name the work-history rows ... and code adds the dates up. If you write a total, it is ignored — and if you let a total change your verdict, your verdict is wrong."
In practice: the model must still fill `verdict`. With no instruction, it answers from the arithmetic it was told not to do (Gundu, "5 years as head": 2012–present → `met`; a 4.5-year row → `not_met`).
Fix: rule 10: name the rows; stated figure → `statedValue` and the verdict it supports; otherwise `unknown` and code decides; `not_met` only on a stated shortfall. Depends on A2.

**S-2. Five of the six input fields are unexplained.**
Quote: "Criteria marked `nameTheRows` need them" is the only field the prompt defines, while `screenQuestions` sends `expectation`, `tier`, `alsoCounts`, `conditions`, `fromTheJobDescription`, `alreadyProved`.
In practice: "alreadyProved" is read as "already met" and returns `met` with no lines; `tier` tempts stricter reading of critical criteria.
Fix: §1 defines each field; `alreadyProved` is a pointer, never a verdict; `tier` never changes the bar.

**S-3. "Silence is not evidence" has no exception for closed lists.**
Quote: "The most serious error you can make is answering **not_met** because you could not find something. Silence in a resume is not evidence." vs the not_met example "a degree that is not on the list".
In practice: Gundu's degree gate comes back `unknown` from a cautious reader, or the second reader flips the rejection; the expected outcome is lost.
Fix: rule 2 (Education and Certifications sections are complete; a Skills list is not) and rule 11 (degree conditions answered from the Education section).

**S-4. A dated mention is read as disuse.**
Quote: "**derived** — it follows from what is on the page. Dates that show a role ran five years."
In practice: Vemuri's WinNonlin at Lambda (2012–2017) → `not_met` on "current hands-on use". Nothing says she stopped.
Fix: rule 3: "current"/"recent" with an old latest mention is `unknown` with the lines found.

**S-5. "Preferably" inside an expectation raises the bar.**
Quote: "Give the verdict that fits — usually `not_met` with `partial` true".
In practice: "patient BE studies, preferably in oncology" with psychiatry-only patient work → `not_met`, partial, on a critical criterion → rejection.
Fix: rule 4.

**S-6. Implied links have no common-knowledge guard, and languages can be implied from identity.**
Quote: "A criterion asking for **CRO experience** is met by a role at IQVIA, because IQVIA is a CRO."
In practice: the model guesses whether "Deccan Bioclinical Research Pvt. Ltd." is a CRO; it answers Telugu `met` for Vemuri from Kakatiya University and a Hyderabad address.
Fix: §3: implied only when the link is common knowledge and the reason states it; a language is never implied by name, place, university or nationality.

**S-7. The ask-the-candidate list is incomplete and silent about stated figures.**
Quote: "Salary expectations, notice period, willingness to relocate, willingness to travel, and the right to work in a country: set `askCandidate` to true and leave the verdict `unknown`."
In practice: Gundu's "Notice period: 3 months; can negotiate to 45 days" → `not_met` on a 60-day criterion; current location read off an address.
Fix: rule 8: "where they will live" added; "even when the resume states a figure".

**S-8. `statedValue` is a number but the rule says copy as given.**
Quote: "Copy it as the resume gives it; do not convert or round."
In practice: "INR 48 crore" → 48 or 480000000; "more than 30 regulatory inspections" → nothing or 30; "110 to 130" → either.
Fix: rule 15: number only, unit in the reason, lower figure for ranges and "more than".

**S-9. Degrees in progress and diplomas are unaddressed on degree conditions.**
Quote: "a qualification in progress" appears only as a `partial` example.
In practice: "PhD (expected 2027)" or a PG diploma against `degreeType in PhD|MD` is answered inconsistently.
Fix: rule 11.

**S-10. Repetition and a missing untrusted-input line.**
Quote: "**Never answer from what is missing.** See the three verdicts above." (the third statement of the same rule) and no mention that the resume is data.
In practice: wasted attention; reliance on the appended injection guard alone.
Fix: one statement (rule 1); §1 last bullet names the resume as untrusted.

Length: the screen rewrite is 1216 body words against 1026. The 190 extra words are §1 (input fields the original never defined) and rule 10 (the years verdict the original left undefined). The extractor rewrite is 1174 against 1113; the 61 extra words are rules 3, 4, 16 and 17 (Indian CV lines, in-progress credentials, headlines, LinkedIn durations). The planner rewrite is 2054 against 2298.

---

## 5. Change logs

### 5.1 planner.md

| # | Change | Why | Fixes |
|---|---|---|---|
| 1 | Opening paragraph says the screen reads criteria without the JD | Gives the model the reason labels must carry the bar | P-2 |
| 2 | Rule 4: one list of never-criteria incl. employer facts and targets; "even when listed as a must-have" moved to the first clause | Buried clause; employer figures leaking into conditions | P-5, P-10 |
| 3 | Rule 5: stated protected attributes dropped silently, never in any field; caste and nationality named | Age band → openQuestion → P7 failure | P-6 |
| 4 | Rule 6: preferences are separate low criteria | "preferably oncology" became a knockout qualifier | P-8, P-1 |
| 5 | Rule 7: a judgement's label carries count, scope or role | Bar lost before the screen | P-2 |
| 6 | Rule 8 vs 10: keywords = spellings/synonyms (and P4 anchoring); terms = alternatives | Two lists with one description | P-10 |
| 7 | Rule 11: subjects as a list; degreeType "whenever degrees are named"; lastUsedWithin only with a stated number | Invented lastUsedWithin; educationLevel misuse | P-9, P-4 |
| 8 | Rule 12: value = figure stated as a requirement of the candidate; "as head" → yearsLeading with scope in label; degree combination → terminal credential; "seasoned" never inferred, number asked only when no other years figure | Non-requirement figures; subject gap; Gundu passing the gate | P-5, P-4, P-6 |
| 9 | Rule 13: unexpressible → judgement, not term; judgements are screened | Counts as fake terms | P-3 |
| 10 | Rules 15–17: ≥1, ≤4, < one third; ordered rule for excess must-haves; never-critical list | Contradictory cap, inflation | P-1 |
| 11 | Rules 18–20: scope only where stated, at most one inferred, "domain depth" generic, critical only if must-have | Invented scope, pharma shape | P-7 |
| 12 | Rule 22: merge good-to-haves when full | No rule for what to drop | P-7 |
| 13 | Rule 28: cutoff is not openings | Cutoff 1 from "Openings 1" | P-10 |
| 14 | "Quiz Drafter ... from your critical-tier criteria" → "from the top tiers" | Q1 allows critical and high | P-10 |
| 15 | Duplicate "Every years figure..." removed; logistics paragraph, exec paragraph and kinds paragraph split into numbered rules | Rules missed in long paragraphs | all |
| 16 | Output contract kept verbatim | Must mirror rules.ts | constraint |

### 5.2 screener-extractor.md

| # | Change | Why | Fixes |
|---|---|---|---|
| 1 | Rule 1: headline/summary and Training/Publications sections are evidence; titles evidence their subject | Academic CVs | E-10, further |
| 2 | Rule 3: non-evidence lines (DOB, nationality, CTC, notice period, declaration, signature, position applied for) never copied | Indian CV fields | E-5 |
| 3 | Rule 4: credentials as claimed; in progress → term with level "in progress" | Pursuing PhD counted as doctorate | E-4 |
| 4 | Rule 5: inspection outcomes are not terms; regulators are | WHO Notice of Concern stored as a credential | further |
| 5 | Rule 8: one entry per (term, row); Skills entry dropped when a role shows use | Contradiction between dedup and per-row | E-1, E-8 |
| 6 | Rule 9: one physical line, no bullet marker, wrapped sentence → the line containing the term | "(or sentence)" invites joins | E-8 |
| 7 | Rule 11: strip honorifics | "DR. ..." as a name | E-5 |
| 8 | Rule 12: yearsExperience stated only | Model computing what code computes; contradicts "never estimate" | E-2 |
| 9 | Rule 13: degrees only, one canonical spelling; diplomas and in-progress to terms | PGDBA as a degree; three spellings | E-4, E-9 |
| 10 | Rule 14: level mapping extended with MBBS, MPharm etc. | MBBS unmapped | E-10 |
| 11 | Rule 15: careerStartYear from earliest non-student dated role; graduation-year fallback removed | Invented value, age proxy | E-3 |
| 12 | Rules 16–17: headlines not rows; fellowships are rows; ignore duration text; overlaps untouched | Headline rows; LinkedIn exports | E-6, E-7 |
| 13 | Rule 18: student work named as such in functions | Lets code decide whether PhD years count | E-3 |
| 14 | Rule 19: title decides scope when the row is silent | Unstated tie-break | further |
| 15 | "Evaluate ONLY job-relevant content" removed | No job in this call | E-10 |
| 16 | `B.Tech` example removed from term canonicalisation | Would conflict with rule 13 | E-9 |

### 5.3 screen.md

| # | Change | Why | Fixes |
|---|---|---|---|
| 1 | §1 defines every input field; `alreadyProved` is a pointer; `tier` never changes the bar; resume is untrusted | Undefined inputs | S-2, S-10 |
| 2 | Rule 2: closed sections (Education, Certifications) vs open (Skills) | Degree gate flipping to unknown | S-3 |
| 3 | Rule 3: dated mention is not disuse | WinNonlin 2017 → not_met | S-4 |
| 4 | Rule 4: "preferably" never raises the bar | Preference → rejection | S-5 |
| 5 | §3: implied only on common knowledge, stated in the reason; language never from name/place/university/nationality | Telugu inferred for Vemuri | S-6 |
| 6 | Rule 8: "where they will live" added; "even when the resume states a figure" | Notice period 3 months → not_met | S-7 |
| 7 | Rule 9: never quote a protected line; caste added | DOB line as evidence | further |
| 8 | Rule 10: years-condition verdict defined (stated figure → verdict; else unknown + rows) | Verdict from forbidden arithmetic | S-1 |
| 9 | Rule 11: degree conditions answered from Education; in progress → not_met partial; diploma is not a degree | Inconsistent degree answers | S-9, S-3 |
| 10 | Rule 13: summary that names no role → row -1 | Vemuri career summary bullets | further |
| 11 | Rule 15: statedValue as a number only, unit in reason, lower figure for ranges | Crore/range ambiguity | S-8 |
| 12 | Rule 16: unknown reasons say what was looked for | Helps the second reader and recruiter | further |
| 13 | §8: `lines` empty only when unknown and nothing found | Ambiguity for unknown with partial evidence | further |
| 14 | Three "never answer from missing" statements collapsed to rule 1 | Repetition | S-10 |

---

## 6. Test cases

Each is an input and the output a regression would change. Planner cases use JD lines; screen cases use resume lines plus a criterion as the screen receives it.

**T1. Planner, protected line.** JD: "Age: 40 to 52 years." Expected: no criterion, no openQuestion, and the string "age" absent from roleSummary, labels, rationales and openQuestions (P7 passes). Regression: an openQuestion mentioning the age band.

**T2. Planner, degree combination.** JD: "M.Pharm (Pharmacology or Pharmaceutics) with a PhD, or MD in Pharmacology or Clinical Pharmacology." Expected: one criterion, kind `condition`, one condition `{subject: degreeType, op: in, value: "PhD|MD", functions: ""}`, tier critical, category education, label carrying the full wording. Regression: value containing "M.Pharm", or two criteria, or educationLevel.

**T3. Planner, two figures and non-requirement figures.** JD: "At least 15 years in BA/BE or clinical pharmacology, with at least 5 years as head of a clinical facility or clinical pharmacology unit at a CRO or sponsor." plus "Over the last five years it has hosted inspections from USFDA..." and "overlap with them for at least three months". Expected: one criterion with exactly two conditions, `yearsInFunctions >= 15` with functions naming bioequivalence and clinical pharmacology, and `yearsLeading >= 5`; the label names "head of a clinical facility"; no condition anywhere in the plan with value 3 or a value derived from "five years" of inspections. Regression: a third condition, a `yearsInFunctions` with functions "Head of clinical facility", or a value "3".

**T4. Planner, count and "current" tool, whole-plan tiers.** JD: "Faced at least 3 USFDA inspections as head of facility or as the PI's designated delegate, with written responses you authored." and "Current hands-on use of Phoenix WinNonlin or an equivalent PK tool." and "Experience with patient BE studies, preferably in oncology." Expected: the inspections criterion is kind `judgement`, no terms, no conditions, label containing "3" and "head of facility"; the WinNonlin criterion is kind `term` with no `lastUsedWithin` condition and tier at most high; the patient-BE criterion does not contain "oncology" in its label, and a separate low criterion carries oncology. On the full sample JD: critical count between 1 and 4 and strictly less than a third of criteria; "Hyderabad" appears in no label. Regression: any of these flipped.

**T5. Screen, closed Education section.** Resume lines (Gundu): "1999   M.Pharm, Pharmaceutics — University College of Pharmaceutical Sciences, Andhra University, Visakhapatnam", "1997   B.Pharm — Andhra University", "2010   PGDBA (distance) — Symbiosis Centre for Distance Learning, Pune". Criterion: expectation "M.Pharm with a PhD, or MD in Pharmacology or Clinical Pharmacology", conditions `[{degreeType in "PhD|MD"}]`, tier critical. Expected: verdict `not_met`, basis `stated`, lines include the three education lines verbatim, rows `[-1]`, partial `false`, reason naming that the degrees listed are M.Pharm, B.Pharm and a PGDBA diploma. Regression: `unknown`, or PGDBA treated as qualifying.

**T6. Screen, "current" with an old mention.** Resume lines (Vemuri): "Ran PK and statistics in Phoenix WinNonlin 6.x and SAS 9.3; wrote the group's PK SOPs on BLQ handling, lag time and terminal-phase selection." (row 1, 2012–2017) and "Phoenix WinNonlin & NLME advanced training, Certara, 2016". Criterion: expectation "Current hands-on use of Phoenix WinNonlin or an equivalent PK tool", alsoCounts ["WinNonlin", "Phoenix", "NONMEM", "PKanalix"]. Expected: verdict `unknown`, lines include the Lambda line, rows `[1, -1]`, reason saying the tool is shown 2012–2017 and the resume does not say whether use is current. Regression: `not_met`.

**T7. Screen, count with a role qualifier.** Resume lines (Gundu): "Head of facility for 19 inspections, seven of them USFDA.", "Wrote the facility's responses to all observations, including a 2019 WHO Notice of Concern (washout documentation at a subcontracted partner unit). Ended subcontracting; notice lifted 2020 after re-inspection." (row 0) and "Present at 2 USFDA inspections of the unit (2008, 2011) as clinical operations head, not as head of facility." (row 1). Criterion: expectation "3+ USFDA inspections faced as head of facility or PI's designated delegate, with written responses authored". Expected: verdict `met`, basis `stated`, statedValue `7`, rows `[0]` only, lines the two row-0 lines. Regression: rows including 1, statedValue 9, or `partial` true.

**T8. Screen, language never implied from identity.** Resume lines (Vemuri): "Address: Flat 402, Sri Sai Residency, Kukatpally Housing Board Colony, Hyderabad, Telangana 500072", "M.Pharm, Pharmacology, Kakatiya University, 2000 (University second rank)". Criterion: expectation "Telugu", tier low. Expected: verdict `unknown`, basis any, lines empty, rows empty, askCandidate false. Same criterion on Gundu with "Telugu, English, Hindi." → `met`, `stated`, rows `[-1]`. Regression: Vemuri `met` with basis `implied`.

Two more worth adding once A2 is settled: Vemuri on `yearsInFunctions >= 15` ("22 years in bioavailability/bioequivalence and clinical pharmacology, 9 of them heading a CRO clinical facility." → `met`, statedValue 22, rows `[0,1,2,3]`, not row 4 unless the product counts fellowships); Gundu on `yearsLeading >= 5` with no stated figure → `unknown`, rows `[0,1]`, statedValue null.

---

## 7. Open questions for the product owner

1. **Years verdicts (A2).** When a criterion carries a years condition, does code overwrite the screen's verdict with its own computation, or combine them? The rewrite assumes code decides and tells the screen to answer `unknown` with rows unless the resume states the figure. If code trusts the screen's verdict, rule 10 of screen.md needs to say so instead.
2. **Field mapping (A1).** What exactly fills `expectation`, `alsoCounts`, `fromTheJobDescription` and `alreadyProved`? If `expectation` is not the label, planner rule 7 (bar in the label) must move to whichever field is.
3. **Degree normalisation.** The planner must use the JD's spelling (P10), the extractor emits a canonical form, resumes write "Ph.D.", "M.Pharm", "Doctor of Philosophy". Code needs one degree dictionary that maps all three. Decide too: is MD (India) a doctorate or a master's for `educationLevel`; is PharmD a doctorate; is PGDM/PGDBA a master's equivalent (Indian recruiters often treat IIM PGDM as an MBA)?
4. **Student years.** Do doctoral fellowships, postdocs, medical residencies and internships count toward `yearsExperience` and `yearsInFunctions`? The extractor now keeps them as rows with functions naming the student work; code can include or exclude. Does code merge overlapping rows before summing (Vemuri's concurrent fellowship)?
5. **A scope-years subject.** "5 years as head of a clinical facility", "3 years as a VP" and "4 years owning a P&L" have no subject; `yearsLeading` is the nearest and is lossy. A `yearsAtScope` subject with values from the extractor's `scope` enum would make these computable. Until then the label carries the scope and the screen reads it.
6. **Illegal JD lines.** The planner now drops a stated age band silently because P7 forbids the word in any text field. A recruiter would probably want to know the JD contains one. A non-text field (for example `complianceFlags: ["age"]`) would let the plan surface it without P7 failing.
7. **Inspection and regulatory history.** For pharma, "faced N regulator inspections" is a real screener dimension and could be a taxonomy category. Disclosed adverse outcomes (Form 483s, a WHO Notice of Concern, warning letters) are another matter: both sample candidates disclose them; storing or grading them penalises candour. The rewrite tells the extractor not to store outcomes. Confirm.
8. **Location criteria added by recruiters.** The planner never emits them, but a recruiter can add "Based in Hyderabad". Should the screen read the current city off the address (not protected, usually stated) or always ask? The rewrite asks.
9. **CTC and notice period.** Indian CVs state them. The screen always asks; the extractor never stores them. If recruiters want them displayed, that is a separate typed field, not a screener term.
10. **Quiz source.** planner.md says the quiz comes from critical criteria; `rules.ts` Q1 allows critical and high. Which is intended?
11. **In-progress degree on a critical gate.** The rewrite answers `not_met` with `partial` true (the degree is not held), which rejects, subject to the second reader. If the product would rather route these to the recruiter, make it `unknown` with `partial` true.
12. **Tier cap in code.** P2c allows up to half the criteria critical; the prompt says fewer than a third. If the third is policy, P2c should enforce `critical * 3 < n` (min 1), or the eval will keep passing inflated drafts.
13. **The line check (A3).** `parseScreenAnswers` does not verify lines. If nothing downstream does, misquoted evidence reaches recruiters and the prompt's "thrown away" is untrue.

---

## 8. Notes on rules.ts and on model and effort (separate, as asked)

**rules.ts.**
- P2c: `critical.length <= Math.max(2, Math.ceil(crits.length / 2))` is far looser than the prompt. See open question 12.
- P4: `textAnchoredInJd` passes if any label token longer than three letters appears anywhere in the JD. "with", "team", "years", "study" anchor almost anything. It guards against gross hallucination only; it does not guard the bar.
- P10: the years check `(?<!\d)15(?!\d)` passes whenever the digits appear anywhere, including "applications close 15 November 2026". A fabricated "15 years" grounds on a date.
- P7: `PROTECTED_PLAN` omits nationality, "date of birth", "years old" and "citizenship". Rule 5 of the planner now names them, but the eval will not catch a leak.
- P2b requires at least one critical criterion on every plan. For a junior role with no genuine knockout this forces inflation of one criterion. Consider allowing zero when no condition or credential criterion exists.
- Q1 vs the planner's "critical-tier criteria" line (open question 10).
- P11 treats a criterion with `kind` undefined as not-term (`c.kind !== undefined`); fine for legacy drafts, but the mock could regress silently to kind-less drafts and pass.

**Model and effort.** Not changed in the files.
- planner: `claude-opus-5`, `effort: medium`. I would raise effort to high. The call runs once per job, and the hard part is allocation under constraints (which four must-haves stay critical, how to encode a degree combination, which figures are requirements), exactly where medium effort cuts corners. The cost is one call per JD.
- screener-extractor: `claude-opus-5`, `effort: high`. Keep. The record is permanent and reused.
- screen: `claude-sonnet-5`, `effort: medium`. Defensible because the default is `unknown` and the second reader checks every critical rejection. The failure modes seen above (verbatim quoting of wrapped lines, implied links, resisting arithmetic) are the ones a smaller model at medium effort gets wrong most. Measure the second reader's disagreement rate; if more than a few percent of critical `not_met` verdicts flip, move the screen to effort high before changing the model.
