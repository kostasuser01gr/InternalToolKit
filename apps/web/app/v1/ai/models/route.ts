import { getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getServerEnv();
  const providers =
    env.AI_PROVIDER_MODE === "mock"
      ? ["mock-fallback"]
      : ["free-cloud-primary", "free-cloud-secondary", "mock-fallback"];

  return Response.json({
    ok: true,
    mode: "free-only",
    defaultModelId: "free-cloud-primary:v1",
    providers,
    models: providers.map((provider) => ({
      id: `${provider}:v1`,
      provider,
      freeOnly: true,
    })),
  });
}
