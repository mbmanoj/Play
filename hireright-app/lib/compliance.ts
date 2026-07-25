import { Candidate, RankingResult } from "./types";

// ── Adverse-impact analysis (M-Compliance) ────────────────────────────
// Computes selection rates + impact ratios across voluntary demographic
// groups, flagging any below the four-fifths (80%) rule.
//
// FIREWALL: demographics are read ONLY here, for monitoring — never by the
// ranking/scoring code in lib/ai/*.

export interface GroupStat {
  dimension: string;
  group: string;
  total: number;
  selected: number;
  selectionRate: number;
  impactRatio: number | null; // vs. highest-rate group in the dimension
  flagged: boolean;
}

export function adverseImpact(
  candidates: Candidate[],
  ranking: RankingResult,
  shortlistSize: number
): GroupStat[] {
  const selectedIds = new Set(
    ranking.candidates
      .filter((c) => c.knockoutFailures.length === 0)
      .slice(0, shortlistSize)
      .map((c) => c.candidateId)
  );

  const dims: { key: keyof NonNullable<Candidate["demographics"]>; name: string }[] = [
    { key: "gender", name: "Gender" },
    { key: "ethnicity", name: "Ethnicity" },
    { key: "ageBand", name: "Age band" }
  ];

  const out: GroupStat[] = [];
  for (const dim of dims) {
    const buckets = new Map<string, { total: number; selected: number }>();
    for (const c of candidates) {
      const g = (c.demographics?.[dim.key] as string) || "undisclosed";
      const b = buckets.get(g) || { total: 0, selected: 0 };
      b.total += 1;
      if (selectedIds.has(c.id)) b.selected += 1;
      buckets.set(g, b);
    }
    const rows = Array.from(buckets.entries()).map(([group, b]) => ({
      dimension: dim.name,
      group,
      total: b.total,
      selected: b.selected,
      selectionRate: b.total ? b.selected / b.total : 0,
      impactRatio: null as number | null,
      flagged: false
    }));
    const maxRate = Math.max(...rows.map((r) => r.selectionRate), 0);
    rows.forEach((r) => {
      r.impactRatio = maxRate > 0 ? Math.round((r.selectionRate / maxRate) * 100) / 100 : null;
      r.flagged = r.impactRatio !== null && r.impactRatio < 0.8 && r.total > 0;
    });
    out.push(...rows);
  }
  return out;
}
