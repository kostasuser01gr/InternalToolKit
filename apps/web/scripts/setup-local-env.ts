/**
 * setup-local-env.ts - creates apps/web/.env.local if missing and appends
 * required keys without overwriting any existing values.
 *
 * Usage:
 *   pnpm --filter @internal-toolkit/web setup:env
 *   pnpm --filter @internal-toolkit/web env:setup
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

type EnvDefinition = {
  key: string;
  hint: string;
  required: boolean;
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(scriptDir, "..", ".env.local");

const REQUIRED_ENV_VARS: EnvDefinition[] = [
  {
    key: "DATABASE_URL",
    hint: "Supabase pooler URI (Project Settings > Database > Connection string, port 6543)",
    required: true,
  },
  {
    key: "DIRECT_URL",
    hint: "Supabase direct URI (Project Settings > Database > Connection string, port 5432)",
    required: true,
  },
  {
    key: "SESSION_SECRET",
    hint: "Generate with: openssl rand -hex 32",
    required: true,
  },
];

const OPTIONAL_ENV_VARS: EnvDefinition[] = [
  {
    key: "NEXT_PUBLIC_CONVEX_URL",
    hint: "Convex dashboard deployment URL (if Convex is enabled)",
    required: false,
  },
  {
    key: "CONVEX_DEPLOYMENT",
    hint: "Convex deployment identifier (if Convex is enabled)",
    required: false,
  },
];

function parseExistingEnvKeys(fileContents: string) {
  const keys = new Set<string>();

  for (const line of fileContents.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (match?.[1]) {
      keys.add(match[1]);
    }
  }

  return keys;
}

function quoteEnvValue(value: string) {
  if (!value) {
    return '""';
  }

  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed;
  }

  return `"${trimmed.replace(/"/g, '\\"')}"`;
}

async function promptForMissingRequired(definitions: EnvDefinition[]) {
  const values = new Map<string, string>();

  if (definitions.length === 0) {
    return values;
  }

  if (!(process.stdin.isTTY && process.stdout.isTTY)) {
    return values;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (question: string) =>
    new Promise<string>((resolveAnswer) => {
      rl.question(question, (answer) => resolveAnswer(answer.trim()));
    });

  for (const definition of definitions) {
    const prompt =
      `[required] ${definition.key}\n` +
      `  ${definition.hint}\n` +
      "  value (leave empty to fill manually): ";
    const answer = await ask(prompt);
    values.set(definition.key, answer);
  }

  rl.close();
  return values;
}

async function main() {
  const existingFile = existsSync(ENV_PATH);
  const existingContents = existingFile ? readFileSync(ENV_PATH, "utf-8") : "";
  const existingKeys = parseExistingEnvKeys(existingContents);

  const missingRequired = REQUIRED_ENV_VARS.filter(
    ({ key }) => !existingKeys.has(key),
  );
  const missingOptional = OPTIONAL_ENV_VARS.filter(
    ({ key }) => !existingKeys.has(key),
  );

  if (missingRequired.length === 0) {
    console.log(`No required changes needed. Existing values were not modified: ${ENV_PATH}`);
    if (missingOptional.length > 0) {
      console.log(
        `Optional keys not set: ${missingOptional.map(({ key }) => key).join(", ")}`,
      );
    }
    return;
  }

  if (!(process.stdin.isTTY && process.stdout.isTTY)) {
    console.log("Non-interactive shell detected.");
    console.log("Add required keys manually to apps/web/.env.local:");
    for (const definition of missingRequired) {
      console.log(`- ${definition.key}: ${definition.hint}`);
    }
  }

  const promptedValues = await promptForMissingRequired(missingRequired);
  const appendedLines: string[] = [];
  const unresolvedRequired: string[] = [];

  appendedLines.push("# Added by setup-local-env.ts");

  for (const definition of missingRequired) {
    const value = promptedValues.get(definition.key) ?? "";
    if (!value) {
      unresolvedRequired.push(definition.key);
    }

    appendedLines.push(`# ${definition.hint}`);
    appendedLines.push(`${definition.key}=${quoteEnvValue(value)}`);
    appendedLines.push("");
  }

  for (const definition of missingOptional) {
    appendedLines.push(`# Optional: ${definition.hint}`);
    appendedLines.push(`${definition.key}=""`);
    appendedLines.push("");
  }

  const hasExistingContent = existingContents.trim().length > 0;
  const output = [
    ...(hasExistingContent ? [existingContents.trimEnd(), ""] : []),
    ...appendedLines,
  ].join("\n");

  writeFileSync(ENV_PATH, `${output.trimEnd()}\n`, "utf-8");

  console.log(`Updated ${ENV_PATH}`);
  console.log("Existing values were preserved (no overwrite).");

  if (unresolvedRequired.length > 0) {
    console.log("Missing required values still need manual entry:");
    for (const key of unresolvedRequired) {
      console.log(`- ${key}`);
    }
  }

  console.log("Next step: pnpm --filter @internal-toolkit/web env:check");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
