import { afterEach, describe, expect, it } from "vitest";

import { getAuthRuntimeEnvError } from "@/lib/env";

const ORIGINAL_ENV = { ...process.env };
const VALID_SECRET = "env-test-secret-".padEnd(32, "x");
const VALID_DATABASE_URL =
  "postgresql://postgres:password@db.example.com:6543/postgres?sslmode=require";
const LOCAL_SETUP_COMMAND = "pnpm --filter @internal-toolkit/web setup:env";

function applyEnv(overrides: Record<string, string | undefined>) {
  process.env = { ...ORIGINAL_ENV };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getAuthRuntimeEnvError", () => {
  it("returns missing DATABASE_URL error in hosted production", () => {
    applyEnv({
      NODE_ENV: "production",
      VERCEL: "1",
      NEXT_PHASE: undefined,
      DATABASE_URL: undefined,
      SESSION_SECRET: VALID_SECRET,
      NEXTAUTH_SECRET: undefined,
    });

    expect(getAuthRuntimeEnvError()).toBe("Missing env: DATABASE_URL.");
  });

  it("returns missing SESSION_SECRET error in hosted production", () => {
    applyEnv({
      NODE_ENV: "production",
      VERCEL: "1",
      NEXT_PHASE: undefined,
      DATABASE_URL: VALID_DATABASE_URL,
      SESSION_SECRET: undefined,
      NEXTAUTH_SECRET: undefined,
    });

    expect(getAuthRuntimeEnvError()).toBe("Missing env: SESSION_SECRET.");
  });

  it("returns setup guidance when DATABASE_URL is missing in development", () => {
    applyEnv({
      NODE_ENV: "development",
      VERCEL: undefined,
      VERCEL_ENV: undefined,
      CI: undefined,
      GITHUB_ACTIONS: undefined,
      NEXT_PHASE: undefined,
      DATABASE_URL: undefined,
      SESSION_SECRET: undefined,
      NEXTAUTH_SECRET: undefined,
    });

    const error = getAuthRuntimeEnvError();
    expect(error).toContain("Missing env: DATABASE_URL.");
    expect(error).toContain(LOCAL_SETUP_COMMAND);
    expect(error).toContain("apps/web/.env.local");
  });

  it("rejects sqlite file URLs in hosted production", () => {
    applyEnv({
      NODE_ENV: "production",
      VERCEL: "1",
      NEXT_PHASE: undefined,
      DATABASE_URL: "file:./prisma/runtime.sqlite",
      SESSION_SECRET: VALID_SECRET,
      ALLOW_SQLITE_DEV: "0",
    });

    expect(getAuthRuntimeEnvError()).toContain("file: is only allowed in development");
  });

  it("allows sqlite file URLs in development when ALLOW_SQLITE_DEV=1", () => {
    applyEnv({
      NODE_ENV: "development",
      VERCEL: undefined,
      VERCEL_ENV: undefined,
      CI: undefined,
      GITHUB_ACTIONS: undefined,
      NEXT_PHASE: undefined,
      DATABASE_URL: "file:./prisma/runtime.sqlite",
      ALLOW_SQLITE_DEV: "1",
      SESSION_SECRET: undefined,
      NEXTAUTH_SECRET: undefined,
    });

    expect(getAuthRuntimeEnvError()).toBeNull();
  });

  it("allows quoted postgres URLs in hosted production", () => {
    applyEnv({
      NODE_ENV: "production",
      VERCEL: "1",
      NEXT_PHASE: undefined,
      DATABASE_URL: `'${VALID_DATABASE_URL}'`,
      SESSION_SECRET: VALID_SECRET,
    });

    expect(getAuthRuntimeEnvError()).toBeNull();
  });

  it("normalizes accidental DATABASE_URL assignment syntax", () => {
    applyEnv({
      NODE_ENV: "production",
      VERCEL: "1",
      NEXT_PHASE: undefined,
      DATABASE_URL: `DATABASE_URL=${VALID_DATABASE_URL}`,
      SESSION_SECRET: VALID_SECRET,
    });

    expect(getAuthRuntimeEnvError()).toBeNull();
  });

  it("rejects non-postgres protocols in hosted production", () => {
    applyEnv({
      NODE_ENV: "production",
      VERCEL: "1",
      NEXT_PHASE: undefined,
      DATABASE_URL: "mysql://user:pass@db.example.com:3306/internal_toolkit",
      SESSION_SECRET: VALID_SECRET,
    });

    expect(getAuthRuntimeEnvError()).toContain(
      "ensure it starts with postgresql:// or postgres://",
    );
  });

  it("rejects malformed postgres URLs with actionable guidance", () => {
    applyEnv({
      NODE_ENV: "production",
      VERCEL: "1",
      NEXT_PHASE: undefined,
      DATABASE_URL: "postgresql://",
      SESSION_SECRET: VALID_SECRET,
    });

    expect(getAuthRuntimeEnvError()).toContain(
      "URL-encode special password characters",
    );
  });

  it("requires FREE_ONLY_MODE=1", () => {
    applyEnv({
      NODE_ENV: "production",
      VERCEL: "1",
      NEXT_PHASE: undefined,
      DATABASE_URL: VALID_DATABASE_URL,
      SESSION_SECRET: VALID_SECRET,
      FREE_ONLY_MODE: "0",
    });

    expect(getAuthRuntimeEnvError()).toBe("Set FREE_ONLY_MODE=1.");
  });

  it("requires AI_ALLOW_PAID=0", () => {
    applyEnv({
      NODE_ENV: "production",
      VERCEL: "1",
      NEXT_PHASE: undefined,
      DATABASE_URL: VALID_DATABASE_URL,
      SESSION_SECRET: VALID_SECRET,
      FREE_ONLY_MODE: "1",
      AI_ALLOW_PAID: "1",
    });

    expect(getAuthRuntimeEnvError()).toBe("Set AI_ALLOW_PAID=0.");
  });
});
