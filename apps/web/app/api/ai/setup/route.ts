import { NextResponse } from "next/server";
import { getAiSetupSummary } from "@/lib/ai/key-detection";

export async function GET() {
  const summary = getAiSetupSummary();
  return NextResponse.json(summary);
}
