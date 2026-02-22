/**
 * AI key detection — checks which provider env vars are configured.
 * Server-side only. Never exposes actual key values.
 */

export interface ProviderStatus {
  id: string;
  name: string;
  envVar: string;
  isConfigured: boolean;
  description: string;
}

const PROVIDERS: Omit<ProviderStatus, "isConfigured">[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    envVar: "OPENROUTER_API_KEY",
    description: "Required for multi-model AI routing (free models via OpenRouter).",
  },
  {
    id: "openai",
    name: "OpenAI",
    envVar: "OPENAI_API_KEY",
    description: "Optional. Used as fallback if OpenRouter is unavailable.",
  },
];

export function detectProviderKeys(): ProviderStatus[] {
  return PROVIDERS.map((p) => ({
    ...p,
    isConfigured: !!process.env[p.envVar],
  }));
}

export function isAnyAiConfigured(): boolean {
  return detectProviderKeys().some((p) => p.isConfigured);
}

export function getMissingProviders(): ProviderStatus[] {
  return detectProviderKeys().filter((p) => !p.isConfigured);
}

/**
 * Returns a safe summary for client-side display.
 * Never includes actual key values.
 */
export function getAiSetupSummary() {
  const providers = detectProviderKeys();
  const configured = providers.filter((p) => p.isConfigured);
  const missing = providers.filter((p) => !p.isConfigured);

  return {
    isReady: configured.length > 0,
    configuredCount: configured.length,
    totalCount: providers.length,
    providers: providers.map((p) => ({
      id: p.id,
      name: p.name,
      envVar: p.envVar,
      isConfigured: p.isConfigured,
      description: p.description,
    })),
    message: configured.length === 0
      ? "AI not configured. Open Settings → AI Setup to add API keys."
      : missing.length > 0
        ? `AI partially configured (${configured.length}/${providers.length} providers).`
        : "AI fully configured.",
  };
}
