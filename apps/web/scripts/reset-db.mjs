import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";

if (existsSync("dev.db")) {
  unlinkSync("dev.db");
}

execSync("npx prisma db execute --file prisma/init.sql", { stdio: "inherit" });
execSync("npx prisma db seed", { stdio: "inherit" });
