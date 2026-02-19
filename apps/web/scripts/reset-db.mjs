import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";

if (existsSync("dev.db")) {
  unlinkSync("dev.db");
}

execSync("pnpm db:migrate:deploy", {
  stdio: "inherit",
});
execSync("pnpm exec prisma db seed", { stdio: "inherit" });
