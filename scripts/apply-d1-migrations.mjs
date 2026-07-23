import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const drizzleDir = path.join(root, "drizzle");
const configPath = path.join(root, "wrangler.jsonc");
const isRemote = process.argv.includes("--remote");
const migrationFiles = readdirSync(drizzleDir)
  .filter((fileName) => /^\d+.*\.sql$/i.test(fileName))
  .sort((first, second) => first.localeCompare(second));

if (migrationFiles.length === 0) {
  console.error("No drizzle SQL migrations found.");
  process.exit(1);
}

for (const fileName of migrationFiles) {
  const filePath = path.join(drizzleDir, fileName);
  const args = [
    "wrangler",
    "d1",
    "execute",
    "DB",
    "--config",
    configPath,
    "--file",
    filePath,
  ];

  if (isRemote) args.push("--remote");
  else args.push("--local");

  console.log(`Applying ${fileName} (${isRemote ? "remote" : "local"})`);
  const result = spawnSync("npx", args, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}