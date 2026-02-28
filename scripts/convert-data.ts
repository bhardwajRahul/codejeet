import fs from "fs";
import path from "path";

const SOURCE_DIR = "/tmp/leetcode-companywise-data";
const DEST_DIR = path.join(process.cwd(), "data");

const folders = fs.readdirSync(SOURCE_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());

let converted = 0;
let skipped = 0;

for (const folder of folders) {
  const allCsvPath = path.join(SOURCE_DIR, folder.name, "all.csv");

  if (!fs.existsSync(allCsvPath)) {
    skipped++;
    continue;
  }

  const destPath = path.join(DEST_DIR, `${folder.name}.csv`);
  fs.copyFileSync(allCsvPath, destPath);
  converted++;
}

console.log(`Converted: ${converted} companies`);
console.log(`Skipped (no all.csv): ${skipped}`);
console.log(`Total folders scanned: ${folders.length}`);
