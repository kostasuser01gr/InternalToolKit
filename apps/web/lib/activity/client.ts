"use client";

type ClientActivityInput = {
  action: string;
  entityType: string;
  entityId: string;
  workspaceId?: string;
  meta?: Record<string, unknown>;
};

export async function logClientActivity(input: ClientActivityInput) {
  try {
    await fetch("/api/activity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  } catch {
    // Best-effort logging in the demo template.
  }
}
