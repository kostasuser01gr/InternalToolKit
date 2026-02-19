# OpenAI MCP Registration Form Pack

Use this pack when filling the OpenAI MCP server registration form.

## MCP Server URL

```text
https://app.example.com/mcp
```

## Auth Dropdown Mapping

- If `AUTH_MODE=no_auth`:
  - Select: `No Auth`

- If `AUTH_MODE=api_key`:
  - Select: `Custom header`
  - Header: `x-api-key`
  - Value: `<your MCP_API_KEY>`

## Pre-flight Tests (copy/paste)

Replace `app.example.com` and values as needed.

```bash
# Verification file must be plain text
curl -i https://app.example.com/.well-known/mcp-verification.txt

# Health endpoint must be reachable over public HTTPS
curl -i https://app.example.com/health

# MCP without auth (AUTH_MODE=no_auth)
curl -i -X POST https://app.example.com/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":"ping","method":"initialize","params":{}}'

# MCP with API key auth (AUTH_MODE=api_key)
curl -i -X POST https://app.example.com/mcp \
  -H "content-type: application/json" \
  -H "x-api-key: <your MCP_API_KEY>" \
  -d '{"jsonrpc":"2.0","id":"ping","method":"initialize","params":{}}'
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| OpenAI verification fails on localhost URL | `localhost` is not publicly reachable | Use Cloudflare Tunnel and submit the HTTPS public domain |
| Verification file check fails | Endpoint returns HTML or JSON instead of plain text | Ensure `/.well-known/mcp-verification.txt` returns plain text only |
| `curl /health` times out | Tunnel not running or wrong ingress target | Restart `cloudflared` and confirm ingress points to `http://localhost:3030` |
| `POST /mcp` returns 401/403 | Auth mode mismatch | Match OpenAI form auth selection with `AUTH_MODE` and header settings |
| DNS name not resolving | DNS route not created or not propagated | Re-run `cloudflared tunnel route dns mcpserver app.example.com` and wait for propagation |
