import { createServer, type IncomingHttpHeaders } from "node:http";

import { processApiRequest, type Env } from "./index";

function toHeaders(headers: IncomingHttpHeaders) {
  const normalized = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        normalized.append(key, entry);
      }
      continue;
    }

    if (typeof value === "string") {
      normalized.set(key, value);
    }
  }

  return normalized;
}

function parsePort(raw: string | undefined) {
  const parsed = Number.parseInt(raw ?? "8787", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid PORT value "${raw ?? ""}"`);
  }
  return parsed;
}

const port = parsePort(process.env.PORT);
const host = process.env.HOST?.trim() || "0.0.0.0";
const runtimeEnv: Env = process.env as unknown as Env;

const server = createServer(async (incoming, outgoing) => {
  const protocol =
    (incoming.headers["x-forwarded-proto"] as string | undefined) ?? "http";
  const authority = incoming.headers.host ?? `${host}:${port}`;
  const requestUrl = new URL(incoming.url ?? "/", `${protocol}://${authority}`);
  const method = incoming.method ?? "GET";
  const headers = toHeaders(incoming.headers);

  const bodyChunks: Uint8Array[] = [];
  for await (const chunk of incoming) {
    if (typeof chunk === "string") {
      bodyChunks.push(Buffer.from(chunk));
    } else {
      bodyChunks.push(chunk);
    }
  }

  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : bodyChunks.length > 0
        ? Buffer.concat(bodyChunks)
        : undefined;

  const requestInit: RequestInit = { method, headers };
  if (body !== undefined) {
    requestInit.body = body;
  }
  const request = new Request(requestUrl.toString(), requestInit);

  try {
    const response = await processApiRequest(request, runtimeEnv);
    outgoing.statusCode = response.status;

    response.headers.forEach((value, key) => {
      outgoing.setHeader(key, value);
    });

    const payload = await response.arrayBuffer();
    outgoing.end(Buffer.from(payload));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    outgoing.statusCode = 500;
    outgoing.setHeader("Content-Type", "application/json; charset=utf-8");
    outgoing.end(JSON.stringify({ ok: false, error: message }));
  }
});

server.listen(port, host, () => {
  console.info(
    JSON.stringify({
      event: "api.server.started",
      transport: "node-http",
      host,
      port,
    }),
  );
});
