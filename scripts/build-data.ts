import fs from "fs/promises";
import path from "path";
import { loadAllQuestions } from "../lib/data";

async function main() {
  const { questions, companies } = await loadAllQuestions();

  const topicSet = new Set<string>();
  for (const q of questions) {
    for (const topic of q.topics) {
      topicSet.add(topic);
    }
  }
  const topics = Array.from(topicSet).sort((a, b) => a.localeCompare(b));

  const outDir = path.join(process.cwd(), "public", "data");
  await fs.mkdir(outDir, { recursive: true });

  const outPath = path.join(outDir, "questions.json");
  await fs.writeFile(outPath, JSON.stringify({ questions, companies, topics }));

  console.log(
    `Wrote ${questions.length} questions, ${companies.length} companies, ${topics.length} topics to ${outPath}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
