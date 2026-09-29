// Same company recorded under two spellings. Other hyphenated slugs stay distinct.
const COMPANY_SLUG_ALIASES: Record<string, string> = {
  "j-p-morgan": "jpmorgan",
  "media-net": "medianet",
  "apollo-io": "apolloio",
  "booking-com": "bookingcom",
  "machine-zone": "machinezone",
  "otter-ai": "otterai",
  "pony-ai": "ponyai",
  "sumo-logic": "sumologic",
};

function canonicalCompanySlug(slug: string): string {
  return COMPANY_SLUG_ALIASES[slug] ?? slug;
}

export function compareCollisionKey(path: string): string | null {
  const prefix = "/compare/";
  if (!path.startsWith(prefix)) return null;
  const segment = path.slice(prefix.length);
  if (segment.length === 0 || segment.includes("/")) return null;
  const vs = segment.indexOf("-vs-");
  if (vs <= 0 || vs >= segment.length - 4) return segment;
  const left = canonicalCompanySlug(segment.slice(0, vs));
  const right = canonicalCompanySlug(segment.slice(vs + 4));
  return `${left}-vs-${right}`;
}

function hyphenCount(path: string): number {
  return path.split("-").length - 1;
}

function preferComparePath(current: string, candidate: string): boolean {
  const currentHyphens = hyphenCount(current);
  const candidateHyphens = hyphenCount(candidate);
  if (candidateHyphens !== currentHyphens) return candidateHyphens < currentHyphens;
  return candidate.localeCompare(current) < 0;
}

export function dedupeSitemapEntries<T extends { path: string }>(entries: readonly T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const key = compareCollisionKey(entry.path);
    if (key === null) continue;
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }

  const winners = new Map<string, T>();
  for (const [key, group] of groups) {
    let winner = group[0];
    for (let index = 1; index < group.length; index++) {
      const candidate = group[index];
      if (preferComparePath(winner.path, candidate.path)) winner = candidate;
    }
    winners.set(key, winner);
  }

  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const entry of entries) {
    const key = compareCollisionKey(entry.path);
    if (key === null) {
      deduped.push(entry);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    const winner = winners.get(key);
    if (winner) deduped.push(winner);
  }
  return deduped;
}
