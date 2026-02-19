import { createHash } from "node:crypto";
import { headers } from "next/headers";

type RequestContext = {
  requestId: string;
  ipAddress: string;
  userAgent: string;
  deviceId: string;
  route: string;
};

function toDigest(input: string) {
  return createHash("sha256").update(input).digest("hex").slice(0, 24);
}

function firstForwardedIp(value: string | null) {
  if (!value) {
    return "unknown";
  }

  const first = value
    .split(",")
    .map((part) => part.trim())
    .find(Boolean);

  return first ?? "unknown";
}

export async function getRequestContext(routeFallback = "unknown"): Promise<RequestContext> {
  const incomingHeaders = await headers();

  const userAgent = incomingHeaders.get("user-agent")?.trim() || "unknown";
  const ipAddress =
    firstForwardedIp(incomingHeaders.get("x-forwarded-for")) ||
    incomingHeaders.get("x-real-ip")?.trim() ||
    "unknown";
  const route =
    incomingHeaders.get("x-invoke-path")?.trim() ||
    incomingHeaders.get("x-pathname")?.trim() ||
    routeFallback;
  const requestId = incomingHeaders.get("x-request-id")?.trim() || crypto.randomUUID();
  const explicitDeviceId = incomingHeaders.get("x-device-id")?.trim();
  const deviceId = explicitDeviceId && explicitDeviceId.length > 0
    ? explicitDeviceId
    : toDigest(`${userAgent}|${incomingHeaders.get("accept-language") || ""}`);

  return {
    requestId,
    ipAddress,
    userAgent,
    deviceId,
    route,
  };
}
