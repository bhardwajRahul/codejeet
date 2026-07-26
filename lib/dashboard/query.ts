import { DIFFICULTIES, maskHasTimeframe, type Difficulty, type Timeframe } from "./schema";
import type { DashboardIndex } from "./decode";

export interface QueryOptions {
  search: string;
  difficulties: Difficulty[];
  topics: string[];
  timeframe: Timeframe;
  premium: "free" | "premium" | "all";
}

export type SortOrder = "asc" | "desc" | null;

// Returns indexes into index.links, never row objects. Nothing is allocated
// per row, so this stays cheap over 15k links on every keystroke.
export function filterLinks(index: DashboardIndex, options: QueryOptions): number[] {
  const words = options.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const difficulties = options.difficulties.map((d) => DIFFICULTIES.indexOf(d));
  const topics = options.topics
    .map((topic) => index.topics.indexOf(topic))
    .filter((topic) => topic >= 0);
  // "all" means no recency filter, matching the current dropdown.
  const timeframe = options.timeframe === "all" ? null : options.timeframe;

  const result: number[] = [];

  for (let i = 0; i < index.links.length; i++) {
    const [problem, company, , mask] = index.links[i];

    if (difficulties.length > 0 && !difficulties.includes(index.problems[problem][2])) continue;

    if (options.premium !== "all") {
      const isPremium = index.problems[problem][4] === 1;
      if (options.premium === "free" ? isPremium : !isPremium) continue;
    }

    if (timeframe !== null && !maskHasTimeframe(mask, timeframe)) continue;

    if (topics.length > 0) {
      const owned = index.topicSets[problem];
      if (!topics.every((topic) => owned.has(topic))) continue;
    }

    if (words.length > 0) {
      const title = index.titleLower[problem];
      const companyName = index.companyLower[company];
      // Iterate the topic id array directly. Spreading the Set or lowercasing
      // here would allocate once per row per keystroke, which is the cost this
      // whole rewrite exists to remove.
      const topicIds = index.problems[problem][5];
      const matchesAll = words.every(
        (word) =>
          title.includes(word) ||
          companyName.includes(word) ||
          topicIds.some((topic) => index.topicsLower[topic].includes(word))
      );
      if (!matchesAll) continue;
    }

    result.push(i);
  }

  return result;
}

export function sortLinks(
  index: DashboardIndex,
  linkIndexes: readonly number[],
  frequency: SortOrder,
  acceptance: SortOrder
): number[] {
  const sorted = [...linkIndexes];
  if (!frequency && !acceptance) return sorted;

  sorted.sort((a, b) => {
    if (frequency) {
      const diff = index.links[a][2] - index.links[b][2];
      if (diff !== 0) return frequency === "asc" ? diff : -diff;
    }
    if (acceptance) {
      // An unknown acceptance sorts below every known value.
      const left = index.problems[index.links[a][0]][3] ?? -1;
      const right = index.problems[index.links[b][0]][3] ?? -1;
      const diff = left - right;
      if (diff !== 0) return acceptance === "asc" ? diff : -diff;
    }
    return 0;
  });

  return sorted;
}

export interface Stats {
  total: number;
  totalSolved: number;
  easy: number;
  easySolved: number;
  medium: number;
  mediumSolved: number;
  hard: number;
  hardSolved: number;
}

// Counts are per unique slug, not per row, so a question asked by 40 companies
// counts once. Progress is keyed by slug for the same reason.
export function computeStats(
  index: DashboardIndex,
  linkIndexes: readonly number[],
  solved: Record<string, boolean>
): Stats {
  const seen = new Set<string>();
  const stats: Stats = {
    total: 0,
    totalSolved: 0,
    easy: 0,
    easySolved: 0,
    medium: 0,
    mediumSolved: 0,
    hard: 0,
    hardSolved: 0,
  };

  for (const linkIndex of linkIndexes) {
    const [slug, , difficulty] = index.problems[index.links[linkIndex][0]];
    if (seen.has(slug)) continue;
    seen.add(slug);

    const isSolved = solved[slug] === true;
    stats.total++;
    if (isSolved) stats.totalSolved++;

    if (difficulty === 0) {
      stats.easy++;
      if (isSolved) stats.easySolved++;
    } else if (difficulty === 1) {
      stats.medium++;
      if (isSolved) stats.mediumSolved++;
    } else {
      stats.hard++;
      if (isSolved) stats.hardSolved++;
    }
  }

  return stats;
}
