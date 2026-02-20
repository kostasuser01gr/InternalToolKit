import { getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getServerEnv();

  return Response.json({
    ok: true,
    version: env.APP_VERSION,
    freeOnlyMode: env.FREE_ONLY_MODE,
    aiProviderMode: env.AI_PROVIDER_MODE,
  });
}
