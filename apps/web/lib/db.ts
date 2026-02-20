import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createDatabaseUrlCandidates, createSingleFailoverRunner } from "@/lib/db-failover";
import { getDatabaseUrl, getDirectDatabaseUrl } from "@/lib/env";
import { logSecurityEvent } from "@/lib/security";

declare global {
  var prismaProxy: PrismaClient | undefined;
}

function createPrismaClient(connectionString: string) {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function createDbProxy() {
  const directDatabaseUrl = getDirectDatabaseUrl();
  const candidates = createDatabaseUrlCandidates({
    databaseUrl: getDatabaseUrl(),
    ...(directDatabaseUrl ? { directUrl: directDatabaseUrl } : {}),
  });
  const hasFallback = Boolean(candidates.fallback);
  const failoverRunner = createSingleFailoverRunner({ hasFallback });
  const state = {
    activeClient: createPrismaClient(candidates.primary),
    fallbackClient: null as PrismaClient | null,
    fallbackInitPromise: null as Promise<PrismaClient> | null,
    usingFallback: false,
  };
  const proxyCache = new Map<string, unknown>();

  function serializePath(path: PropertyKey[]) {
    return path
      .map((part) =>
        typeof part === "symbol" ? `[symbol:${String(part)}]` : String(part),
      )
      .join(".");
  }

  function resolvePath(path: PropertyKey[]) {
    let current: unknown = state.activeClient;

    for (const key of path) {
      if (!current || (typeof current !== "object" && typeof current !== "function")) {
        return undefined;
      }

      current = (current as Record<PropertyKey, unknown>)[key];
    }

    return current;
  }

  async function getFallbackClient() {
    if (!candidates.fallback) {
      throw new Error("DIRECT_URL fallback is not configured.");
    }

    if (state.fallbackClient) {
      return state.fallbackClient;
    }

    if (state.fallbackInitPromise) {
      return state.fallbackInitPromise;
    }

    state.fallbackInitPromise = (async () => {
      const fallbackClient = createPrismaClient(candidates.fallback as string);

      try {
        await fallbackClient.$queryRaw`SELECT 1`;
        state.fallbackClient = fallbackClient;
        return fallbackClient;
      } catch (error) {
        await fallbackClient.$disconnect().catch(() => undefined);
        throw error;
      } finally {
        state.fallbackInitPromise = null;
      }
    })();

    return state.fallbackInitPromise;
  }

  async function activateFallback(triggerError: unknown) {
    if (state.usingFallback || !candidates.fallback) {
      return state.usingFallback;
    }

    try {
      const fallbackClient = await getFallbackClient();
      const previousClient = state.activeClient;
      state.activeClient = fallbackClient;
      state.usingFallback = true;

      if (previousClient !== fallbackClient) {
        void previousClient.$disconnect().catch(() => undefined);
      }

      logSecurityEvent("db.failover_activated", {
        reason: "connectivity_error",
        errorType: triggerError instanceof Error ? triggerError.name : "unknown",
        from: "DATABASE_URL",
        to: "DIRECT_URL",
      });
      return true;
    } catch (error) {
      logSecurityEvent("db.failover_failed", {
        reason: "connectivity_error",
        errorType: error instanceof Error ? error.name : "unknown",
        from: "DATABASE_URL",
        to: "DIRECT_URL",
      });
      return false;
    }
  }

  function invokeMethod(
    parentPath: PropertyKey[],
    method: PropertyKey,
    args: unknown[],
  ) {
    const executeOnActiveClient = () => {
      const parent = resolvePath(parentPath);
      const fn =
        parent && (typeof parent === "object" || typeof parent === "function")
          ? (parent as Record<PropertyKey, unknown>)[method]
          : undefined;

      if (typeof fn !== "function") {
        throw new Error(
          `Prisma method ${serializePath([...parentPath, method])} is not callable.`,
        );
      }

      return Promise.resolve(fn.apply(parent, args));
    };

    return failoverRunner.run(executeOnActiveClient, async (error) => {
      const switched = await activateFallback(error);
      if (!switched) {
        throw error;
      }

      return executeOnActiveClient();
    });
  }

  function getProxy(path: PropertyKey[]) {
    const key = serializePath(path);
    const cached = proxyCache.get(key);
    if (cached) {
      return cached;
    }

    const proxy = new Proxy(
      {},
      {
        get(_target, prop) {
          const value = resolvePath([...path, prop]);

          if (typeof value === "function") {
            return (...args: unknown[]) => invokeMethod(path, prop, args);
          }

          if (value && typeof value === "object") {
            return getProxy([...path, prop]);
          }

          return value;
        },
      },
    );

    proxyCache.set(key, proxy);
    return proxy;
  }

  return getProxy([]) as PrismaClient;
}

export const db = global.prismaProxy ?? createDbProxy();

if (process.env.NODE_ENV !== "production") {
  global.prismaProxy = db;
}
