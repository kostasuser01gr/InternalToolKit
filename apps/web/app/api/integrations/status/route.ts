import { getRequestId, withObservabilityHeaders } from "@/lib/http-observability";

const INTEGRATIONS = [
  {
    name: "Viber Channel Token",
    envKey: "VIBER_CHANNEL_AUTH_TOKEN",
    description: "Token for Viber Channel Post API (preferred for public announcements)",
    setupUrl: "https://developers.viber.com/docs/tools/channels-post-api/",
    testable: true,
  },
  {
    name: "Viber Bot Token",
    envKey: "VIBER_BOT_TOKEN",
    description: "Token for Viber Bot API (fallback for group delivery)",
    setupUrl: "https://developers.viber.com/docs/api/rest-bot-api/",
    testable: true,
  },
  {
    name: "Viber Target Group",
    envKey: "VIBER_TARGET_GROUP_ID",
    description: "Viber group/community ID to mirror messages to",
    testable: false,
  },
  {
    name: "Viber Bridge Enabled",
    envKey: "FEATURE_VIBER_BRIDGE",
    description: "Set to '1' to enable Viber mirror bridge",
    testable: false,
  },
  {
    name: "Cron Secret",
    envKey: "CRON_SECRET",
    description: "Secret for authenticating scheduled cron endpoints",
    testable: false,
  },
  {
    name: "Database URL",
    envKey: "DATABASE_URL",
    description: "Supabase Postgres connection string (pooler, port 6543)",
    testable: false,
  },
  {
    name: "Direct Database URL",
    envKey: "DIRECT_URL",
    description: "Supabase Postgres direct connection (port 5432, for migrations)",
    testable: false,
  },
  {
    name: "Session Secret",
    envKey: "SESSION_SECRET",
    description: "Secret key for encrypting session cookies",
    testable: false,
  },
];

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  const result = INTEGRATIONS.map((int) => ({
    ...int,
    configured: !!process.env[int.envKey],
  }));

  return Response.json(result, withObservabilityHeaders({ status: 200 }, requestId));
}
