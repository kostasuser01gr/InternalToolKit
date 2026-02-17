import type { NextConfig } from "next";

function parseSources(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

const nextConfig: NextConfig = {
  transpilePackages: ["@internal-toolkit/shared"],
  async headers() {
    const imgSources = unique([
      "'self'",
      "data:",
      "blob:",
      ...parseSources(process.env.CSP_IMG_SRC),
    ]);
    const fontSources = unique([
      "'self'",
      "data:",
      ...parseSources(process.env.CSP_FONT_SRC),
    ]);
    const connectSources = unique([
      "'self'",
      "https://api.openai.com",
      ...parseSources(process.env.CSP_CONNECT_SRC),
    ]);

    const csp = [
      "default-src 'self'",
      "object-src 'none'",
      `img-src ${imgSources.join(" ")}`,
      "style-src 'self' 'unsafe-inline'",
      // Next.js App Router streaming injects inline hydration scripts.
      "script-src 'self' 'unsafe-inline'",
      `font-src ${fontSources.join(" ")}`,
      `connect-src ${connectSources.join(" ")}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
