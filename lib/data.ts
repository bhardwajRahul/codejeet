import fs from "fs/promises";
import path from "path";
import { parse } from "csv-parse/sync";

export type Timeframe = "30_days" | "3_months" | "6_months" | "more_than_6m" | "all";

export interface QuestionFilters {
  companies?: string[];
  difficulties?: ("Easy" | "Medium" | "Hard")[];
  topics?: string[];
  timeframes?: Timeframe[];
  isPremium?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface QuestionWithDetails {
  id: number;
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  Difficulty: "Easy" | "Medium" | "Hard";
  acceptance_rate: number;
  link: string;
  company: string;
  frequency: number;
  timeframe: Timeframe;
  topics: string[];
  "Acceptance %": string;
  "Frequency %": string;
  Topics: string;
  ID: string;
  Title: string;
  URL: string;
  "Is Premium": string;
}

export interface QuestionsResponse {
  questions: QuestionWithDetails[];
  companies: string[];
  totalCount: number;
}

type RawCsvRecord = {
  ID?: string;
  Title?: string;
  URL?: string;
  "Is Premium"?: string;
  "Acceptance %"?: string;
  Difficulty?: string;
  "Frequency %"?: string;
  Topics?: string;
};

const DATA_DIR = path.join(process.cwd(), "data");

let cachedQuestions: QuestionWithDetails[] | null = null;
let cachedCompanies: string[] | null = null;

const normalizeDifficulty = (value?: string): "Easy" | "Medium" | "Hard" => {
  const upperValue = (value || "").toUpperCase();
  if (upperValue === "HARD") return "Hard";
  if (upperValue === "MEDIUM") return "Medium";
  return "Easy";
};

const parsePercentage = (value?: string | number): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value) return 0;
  const cleaned = `${value}`.replace(/[^0-9.+-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const ensurePercentString = (value: string | number | undefined, numeric: number) => {
  if (value !== undefined && `${value}`.trim() !== "") {
    const stringValue = `${value}`.trim();
    return stringValue.endsWith("%") ? stringValue : `${stringValue}%`;
  }
  return `${numeric.toFixed(1)}%`;
};

const normalizePremium = (value?: string) => {
  if (!value) return "N";
  const upper = value.trim().toUpperCase();
  if (upper === "Y" || upper === "YES" || upper === "TRUE") return "Y";
  return "N";
};

const deriveSlug = (
  url?: string,
  title?: string,
  fallbackId?: string,
  company?: string,
  index?: number
) => {
  if (url) {
    const parts = url.split("/").filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  if (title) {
    return title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  return `${company ?? "question"}-${index ?? 0}`;
};

const normalizeUrl = (url?: string, slug?: string) => {
  if (url && url.trim() !== "") {
    const trimmed = url.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return new URL(trimmed).pathname;
    }
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }

  return slug ? `/problems/${slug}` : "/";
};

export async function loadAllQuestions(): Promise<{
  questions: QuestionWithDetails[];
  companies: string[];
}> {
  if (cachedQuestions && cachedCompanies) {
    return { questions: cachedQuestions, companies: cachedCompanies };
  }

  const files = await fs.readdir(DATA_DIR);
  const csvFiles = files.filter((file) => file.toLowerCase().endsWith(".csv"));

  const questions: QuestionWithDetails[] = [];
  const companies: string[] = [];

  for (const file of csvFiles) {
    const companySlug = file.replace(/\.csv$/i, "");
    companies.push(companySlug);

    const filePath = path.join(DATA_DIR, file);
    const content = await fs.readFile(filePath, "utf8");
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as RawCsvRecord[];

    records.forEach((record, index) => {
      const slug = deriveSlug(record.URL, record.Title, record.ID, companySlug, index);
      const id = Number.parseInt(record.ID || "", 10);
      const acceptanceNumeric = parsePercentage(record["Acceptance %"]);
      const frequencyNumeric = parsePercentage(record["Frequency %"]);
      const topicsArray = (record.Topics || "")
        .split(",")
        .map((topic) => topic.trim())
        .filter(Boolean);

      questions.push({
        id: Number.isFinite(id) ? id : index + 1,
        slug,
        title: record.Title || slug,
        difficulty: normalizeDifficulty(record.Difficulty),
        Difficulty: normalizeDifficulty(record.Difficulty),
        acceptance_rate: acceptanceNumeric,
        link: `https://leetcode.com${normalizeUrl(record.URL, slug)}`,
        company: companySlug,
        frequency: frequencyNumeric,
        timeframe: "all",
        topics: topicsArray,
        "Acceptance %": ensurePercentString(record["Acceptance %"], acceptanceNumeric),
        "Frequency %": ensurePercentString(record["Frequency %"], frequencyNumeric),
        Topics: topicsArray.join(", "),
        ID: slug || `${companySlug}-${index + 1}`,
        Title: record.Title || slug,
        URL: normalizeUrl(record.URL, slug),
        "Is Premium": normalizePremium(record["Is Premium"]),
      });
    });
  }

  cachedQuestions = questions;
  cachedCompanies = companies;

  return { questions, companies };
}

export async function getQuestions(filters: QuestionFilters = {}): Promise<QuestionsResponse> {
  const { questions } = await loadAllQuestions();
  let filtered = [...questions];
  const hasExplicitTimeframes = questions.some((q) => q.timeframe !== "all");

  if (filters.companies && filters.companies.length > 0) {
    const companySet = new Set(filters.companies);
    filtered = filtered.filter((q) => companySet.has(q.company));
  }

  if (filters.difficulties && filters.difficulties.length > 0) {
    const difficultySet = new Set(filters.difficulties.map((d) => normalizeDifficulty(d)));
    filtered = filtered.filter((q) => difficultySet.has(q.Difficulty));
  }

  if (
    filters.timeframes &&
    filters.timeframes.length > 0 &&
    !filters.timeframes.includes("all") &&
    hasExplicitTimeframes
  ) {
    const timeframeSet = new Set(filters.timeframes);
    filtered = filtered.filter((q) => timeframeSet.has(q.timeframe));
  }

  if (filters.topics && filters.topics.length > 0) {
    const topicSet = new Set(filters.topics.map((t) => t.toLowerCase()));
    filtered = filtered.filter((q) => q.topics.some((topic) => topicSet.has(topic.toLowerCase())));
  }

  if (filters.search) {
    const searchWords = filters.search.toLowerCase().split(/\s+/).filter(Boolean);

    filtered = filtered.filter((q) =>
      searchWords.every(
        (word) =>
          q.Title.toLowerCase().includes(word) ||
          q.company.toLowerCase().includes(word) ||
          q.Topics.toLowerCase().includes(word)
      )
    );
  }

  if (filters.isPremium !== undefined) {
    filtered = filtered.filter((q) => {
      const isPremiumFlag = q["Is Premium"].toUpperCase() === "Y";
      return filters.isPremium ? isPremiumFlag : !isPremiumFlag;
    });
  }

  if (filters.limit !== undefined) {
    const offset = filters.offset || 0;
    filtered = filtered.slice(offset, offset + filters.limit);
  }

  const uniqueCompanies = Array.from(new Set(filtered.map((q) => q.company)));

  return {
    questions: filtered,
    companies: uniqueCompanies,
    totalCount: filtered.length,
  };
}

export async function getCompanies(): Promise<string[]> {
  const { companies } = await loadAllQuestions();
  return companies;
}

export async function getTopics(): Promise<string[]> {
  const { questions } = await loadAllQuestions();
  const topicSet = new Set<string>();

  questions.forEach((q) => {
    q.topics.forEach((topic) => {
      topicSet.add(topic);
    });
  });

  return Array.from(topicSet).sort((a, b) => a.localeCompare(b));
}

export async function getCompanyQuestions(
  companyName: string,
  timeframe?: "30_days" | "3_months" | "6_months" | "more_than_6m" | "all"
): Promise<QuestionWithDetails[]> {
  const filters: QuestionFilters = {
    companies: [companyName],
  };

  if (timeframe) {
    filters.timeframes = [timeframe];
  }

  const result = await getQuestions(filters);
  return result.questions;
}
