import fs from "fs";
import path from "path";
import { DB } from "./types";
import { seedDB } from "./seed";

// ── File-backed JSON store ────────────────────────────────────────────
// Simple, dependency-free persistence at .data/db.json. Survives restarts;
// consistent within a single process. Swap point for a real database.

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "db.json");

let cache: DB | null = null;

function ensure(): DB {
  if (cache) return cache;
  if (fs.existsSync(DB_PATH)) {
    cache = JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as DB;
  } else {
    cache = seedDB();
    persist(cache);
  }
  return cache;
}

function persist(db: DB) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export function read(): DB {
  return ensure();
}

export function write<T>(fn: (db: DB) => T): T {
  const db = ensure();
  const result = fn(db);
  persist(db);
  return result;
}

export function resetDB(): void {
  cache = seedDB();
  persist(cache);
}
