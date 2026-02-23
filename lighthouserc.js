module.exports = {
  ci: {
    collect: {
      startServerCommand:
        "pnpm --filter @internal-toolkit/web start --port 4174",
      startServerReadyPattern: "Ready in",
      startServerReadyTimeout: 30_000,
      url: [
        "http://127.0.0.1:4174/login",
        "http://127.0.0.1:4174/api/health",
      ],
      numberOfRuns: 1,
      settings: {
        preset: "desktop",
        chromeFlags: "--no-sandbox --headless",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.5 }],
        "categories:accessibility": ["error", { minScore: 0.7 }],
        "categories:best-practices": ["warn", { minScore: 0.7 }],
        "categories:seo": "off",
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
