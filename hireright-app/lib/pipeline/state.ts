import { JobStage } from "../types";

// ── Pipeline state machine (M0/M2/M3) ─────────────────────────────────
// Linear for Phase 1+2. Each transition past a gate requires a recorded
// human decision (enforced in actions.ts via ApprovalDecision logging).

const ORDER: JobStage[] = [
  "DRAFT",
  "JD_UPLOADED",
  "PLAN_GENERATED",
  "PLAN_APPROVED",
  "SCREENING",
  "SCREEN_COMPLETE"
];

export const GATES: Partial<Record<JobStage, string>> = {
  PLAN_APPROVED: "Client must approve the closure plan before screening."
};

export function canTransition(from: JobStage, to: JobStage): boolean {
  return ORDER.indexOf(to) === ORDER.indexOf(from) + 1;
}

export function stageIndex(s: JobStage): number {
  return ORDER.indexOf(s);
}

export function stageLabel(s: JobStage): string {
  return (
    {
      DRAFT: "Draft",
      JD_UPLOADED: "JD uploaded",
      PLAN_GENERATED: "Plan generated",
      PLAN_APPROVED: "Plan approved",
      SCREENING: "Screening",
      SCREEN_COMPLETE: "Shortlist ready"
    } as Record<JobStage, string>
  )[s];
}

export const ALL_STAGES = ORDER;
