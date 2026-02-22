import { NextRequest, NextResponse } from "next/server";

const PROVIDER_URLS: Record<string, string> = {
  openrouter: "https://openrouter.ai/api/v1/models",
  openai: "https://api.openai.com/v1/models",
};

const PROVIDER_KEYS: Record<string, string> = {
  openrouter: "OPENROUTER_API_KEY",
  openai: "OPENAI_API_KEY",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const providerId = body.providerId;

    if (!providerId || typeof providerId !== "string") {
      return NextResponse.json({ error: "providerId required" }, { status: 400 });
    }

    const url = PROVIDER_URLS[providerId];
    const keyEnv = PROVIDER_KEYS[providerId];

    if (!url || !keyEnv) {
      return NextResponse.json({ error: `Unknown provider: ${providerId}` }, { status: 400 });
    }

    const key = process.env[keyEnv];
    if (!key) {
      return NextResponse.json({
        success: false,
        error: `${keyEnv} not set. Add it to your environment variables.`,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${key}` },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        return NextResponse.json({
          success: true,
          message: `${providerId} connection successful.`,
          statusCode: response.status,
        });
      }

      return NextResponse.json({
        success: false,
        error: `${providerId} returned HTTP ${response.status}.`,
        statusCode: response.status,
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      const msg = fetchError instanceof Error ? fetchError.message : "Connection failed";
      return NextResponse.json({ success: false, error: msg });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
