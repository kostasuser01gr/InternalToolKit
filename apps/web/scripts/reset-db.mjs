import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";

if (existsSync("dev.db")) {
  unlinkSync("dev.db");
}

execSync("pnpm exec prisma db execute --file prisma/init.sql", {
  stdio: "inherit",
});
execSync("pnpm exec prisma db seed", { stdio: "inherit" });
