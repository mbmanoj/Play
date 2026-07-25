// Small ULID-ish unique id generator (no external deps).
export function uid(prefix = ""): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}${prefix ? "_" : ""}${t}${r}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}
