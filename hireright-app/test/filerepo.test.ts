import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { FileRepo } from "@/lib/db/file";
import type { Job } from "@/lib/types";

// Regression: a job created through one FileRepo instance must be visible to a
// second instance (Next.js can run server actions and RSC renders against
// different module instances). Before the mtime-reload fix, the reader's cache
// was loaded once at startup and never refreshed, so a just-created job 404'd.

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "db.json");

function job(id: string): Job {
  return {
    id,
    clientId: "client_demo",
    title: "Test Role",
    jdText: "Requirements: Strong Python.",
    stage: "JD_UPLOADED",
    createdAt: "2026-08-01T00:00:00.000Z",
    createdBy: "user_demo"
  };
}

describe("FileRepo — cross-instance consistency", () => {
  beforeEach(() => {
    if (fs.existsSync(DB_PATH)) fs.rmSync(DB_PATH);
  });
  afterEach(() => {
    if (fs.existsSync(DB_PATH)) fs.rmSync(DB_PATH);
  });

  it("a job created in one instance is visible to another instance", async () => {
    const reader = new FileRepo();
    await reader.snapshot(); // reader caches the seed (no job yet)

    const writer = new FileRepo();
    await writer.createJob(job("job_x"));

    const db = await reader.snapshot(); // must re-read from disk
    expect(db.jobs.some((j) => j.id === "job_x")).toBe(true);
  });

  it("a candidate portal user created elsewhere is found by email", async () => {
    const writer = new FileRepo();
    await writer.snapshot();
    const reader = new FileRepo();
    await reader.snapshot();

    await writer.createCandidateUser({
      id: "cu1",
      name: "Jo",
      email: "jo@x.co",
      resumeText: "Python",
      skills: ["python"],
      createdAt: "2026-08-01T00:00:00.000Z"
    });

    expect(await reader.candidateUserByEmail("jo@x.co")).not.toBeNull();
  });
});
