import { describe, it, expect } from "vitest";
import { normalizeSkill, normalizeSkills, extractSkillsFromText } from "@/lib/skills";

describe("skills — canonicalization", () => {
  it("maps aliases to canonical names", () => {
    expect(normalizeSkill("k8s")).toBe("Kubernetes");
    expect(normalizeSkill("js")).toBe("JavaScript");
    expect(normalizeSkill("py")).toBe("Python");
    expect(normalizeSkill("reactjs")).toBe("React");
    expect(normalizeSkill("golang")).toBe("Go");
  });

  it("keeps unknown skills (LLM owns vocabulary) and dedupes case-insensitively", () => {
    expect(normalizeSkill("Elixir")).toBe("Elixir"); // not in taxonomy → kept
    expect(normalizeSkills(["React", "reactjs", "REACT"])).toEqual(["React"]);
    expect(normalizeSkills(["k8s", "Kubernetes"])).toEqual(["Kubernetes"]);
  });
});

describe("skills — word-boundary extraction (no substring false positives)", () => {
  it("does NOT extract Go from 'Django'", () => {
    expect(extractSkillsFromText("We build services with Django and Flask.")).not.toContain("Go");
    expect(extractSkillsFromText("We build services with Django and Flask.")).toContain("Django");
  });

  it("does NOT extract Java from a JavaScript-only JD", () => {
    const s = extractSkillsFromText("Frontend role: strong JavaScript and TypeScript.");
    expect(s).toContain("JavaScript");
    expect(s).toContain("TypeScript");
    expect(s).not.toContain("Java");
  });

  it("does NOT emit generic noise words as skills", () => {
    const s = extractSkillsFromText("A great data-driven team player with passion.");
    expect(s).not.toContain("data");
    expect(s).not.toContain("Data");
    expect(s).not.toContain("team");
  });

  it("extracts real canonical skills and normalizes aliases", () => {
    const s = extractSkillsFromText("Experience with k8s, Postgres, and CI/CD on AWS.");
    expect(s).toContain("Kubernetes");
    expect(s).toContain("PostgreSQL");
    expect(s).toContain("CI/CD");
    expect(s).toContain("AWS");
  });
});
