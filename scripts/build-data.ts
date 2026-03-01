import fs from "fs/promises";
import path from "path";
import { loadAllQuestions } from "../lib/data";

interface ScrapedProblem {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  category: string;
  content_html: string;
  content_markdown: string;
  question: string;
  examples: string;
  constraints: string;
  topics: string[];
  total_accepted: number;
  total_submissions: number;
  acceptance_rate: string;
  similar_questions: { title: string; slug: string; difficulty: string; url: string }[];
  hints: string[];
}

async function loadScrapedProblems(): Promise<Map<string, ScrapedProblem>> {
  const problemsDir = path.join(process.cwd(), "data", "problems");
  const map = new Map<string, ScrapedProblem>();

  try {
    const files = await fs.readdir(problemsDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json") && !f.startsWith("_"));

    for (const file of jsonFiles) {
      const content = await fs.readFile(path.join(problemsDir, file), "utf8");
      const data = JSON.parse(content) as ScrapedProblem;
      if (data.slug) {
        map.set(data.slug, data);
      }
    }
  } catch {
    console.warn("No scraped problems found in data/problems/, continuing with CSV data only");
  }

  return map;
}

async function main() {
  const { questions, companies } = await loadAllQuestions();
  const scraped = await loadScrapedProblems();
  console.log(`Loaded ${scraped.size} scraped problem details`);

  // Enrich questions with lightweight scraped metadata (no heavy HTML/markdown)
  // Also fix Is Premium flag: if scraper couldn't get content, the question is premium
  let enriched = 0;
  const enrichedQuestions = questions.map((q) => {
    const problem = scraped.get(q.slug);
    if (problem && problem.content_html) {
      enriched++;
      return {
        ...q,
        "Is Premium": "N",
        category: problem.category || "",
        total_accepted: problem.total_accepted || 0,
        total_submissions: problem.total_submissions || 0,
        similar_questions: problem.similar_questions || [],
        hints: problem.hints || [],
        has_content: true,
        topics: q.topics.length > 0 ? q.topics : problem.topics || [],
        Topics: q.Topics || (problem.topics || []).join(", "),
      };
    }
    // No scraped content = premium question
    if (scraped.has(q.slug)) {
      return { ...q, "Is Premium": "Y" };
    }
    return q;
  });

  const topicSet = new Set<string>();
  for (const q of enrichedQuestions) {
    for (const topic of q.topics) {
      topicSet.add(topic);
    }
  }
  const topics = Array.from(topicSet).sort((a, b) => a.localeCompare(b));

  const outDir = path.join(process.cwd(), "public", "data");
  await fs.mkdir(outDir, { recursive: true });

  // Write main questions.json (lightweight, for dashboard listing)
  const outPath = path.join(outDir, "questions.json");
  await fs.writeFile(outPath, JSON.stringify({ questions: enrichedQuestions, companies, topics }));

  // Copy individual problem JSONs to public/data/problems/ (full content for problem pages)
  const problemsOutDir = path.join(outDir, "problems");
  await fs.mkdir(problemsOutDir, { recursive: true });

  let copied = 0;
  for (const [slug, problem] of scraped) {
    if (problem.content_html) {
      await fs.writeFile(path.join(problemsOutDir, `${slug}.json`), JSON.stringify(problem));
      copied++;
    }
  }

  console.log(
    `Wrote ${enrichedQuestions.length} questions (${enriched} enriched), ${companies.length} companies, ${topics.length} topics to ${outPath}`
  );
  console.log(`Copied ${copied} full problem files to ${problemsOutDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
