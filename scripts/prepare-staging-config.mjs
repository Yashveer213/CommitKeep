import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../dist/server/wrangler.json", import.meta.url);
const outputPath = new URL("../dist/server/wrangler.staging.json", import.meta.url);
const config = JSON.parse(await readFile(sourcePath, "utf8"));

config.name = "commitkeep-staging";
config.d1_databases = [{
  binding: "DB",
  database_name: "commitkeep-staging",
  database_id: "dcb3d83c-0d37-4e71-af6e-fe56b19f5a1d",
  migrations_dir: "../../drizzle",
}];
config.observability = { enabled: true };
config.queues = { producers: [{ binding: "AUTOMATION_QUEUE", queue: "commitkeep-staging-jobs" }] };

await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
