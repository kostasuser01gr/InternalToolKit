/**
 * Server-side Convex HTTP client for use in Next.js server actions/API routes.
 *
 * This module provides a singleton ConvexHttpClient that communicates with
 * the Convex backend over HTTPS. It replaces Prisma/Postgres for all DB
 * operations when Convex is configured.
 */

import { ConvexHttpClient } from "convex/browser";

let _client: ConvexHttpClient | null = null;

/**
 * Returns the Convex HTTP client, creating it lazily.
 * Returns null if NEXT_PUBLIC_CONVEX_URL is not set (graceful degradation).
 */
export function getConvexClient(): ConvexHttpClient | null {
  if (_client) return _client;

  const url =
    process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;

  if (!url) return null;

  _client = new ConvexHttpClient(url);
  return _client;
}

/**
 * Returns the Convex HTTP client or throws if not configured.
 * Use this in code paths that REQUIRE Convex (post-migration).
 */
export function requireConvexClient(): ConvexHttpClient {
  const client = getConvexClient();
  if (!client) {
    throw new Error(
      "Convex is not configured. Set NEXT_PUBLIC_CONVEX_URL or CONVEX_URL.",
    );
  }
  return client;
}
