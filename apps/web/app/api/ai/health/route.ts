import { NextResponse } from "next/server";

import { getModelHealth } from "@/lib/assistant/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const health = getModelHealth();
  return NextResponse.json({ ok: true, models: health });
}
