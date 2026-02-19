# Cloudflare Tunnel Setup for OpenAI MCP Registration

This project already runs locally on `http://localhost:3030` and exposes:
- `GET /health`
- `POST /mcp`
- `GET /.well-known/mcp-verification.txt`

Use Cloudflare Tunnel to expose it over public HTTPS for OpenAI MCP registration.

## 1) Install `cloudflared`

macOS (Homebrew):
```bash
brew install cloudflared
```

Windows (PowerShell, Winget):
```powershell
winget install --id Cloudflare.cloudflared --source winget
```

Check install:
```bash
cloudflared --version
```

## 2) Quick Mode (free, temporary URL)

Run:
```bash
cloudflared tunnel --url http://localhost:3030
```

Cloudflare prints a public `https://<random>.trycloudflare.com` URL in the terminal.

Use that URL to test immediately:
```bash
curl https://<random>.trycloudflare.com/health
curl https://<random>.trycloudflare.com/.well-known/mcp-verification.txt
```

Notes:
- Quick mode URL is temporary and can change when the tunnel restarts.
- Good for smoke testing before creating a named tunnel.

## 3) Production Mode (named tunnel + custom domain)

Authenticate:
```bash
cloudflared tunnel login
```

Create tunnel:
```bash
cloudflared tunnel create mcpserver
```

Route DNS:
```bash
cloudflared tunnel route dns mcpserver app.example.com
```

Create config:
```bash
mkdir -p ~/.cloudflared
cp ops/cloudflare/config.example.yml ~/.cloudflared/config.yml
```

Edit `~/.cloudflared/config.yml`:
- keep `tunnel: mcpserver`
- set `credentials-file` to the JSON created by `cloudflared tunnel create`
- keep ingress service to `http://localhost:3030`

Example:
```yaml
tunnel: mcpserver
credentials-file: ~/.cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: app.example.com
    service: http://localhost:3030
  - service: http_status:404
```

Start named tunnel:
```bash
cloudflared tunnel run mcpserver
```

## 4) Auto-start Tunnel Service

macOS:
```bash
sudo cloudflared service install
```

Windows (PowerShell as Administrator):
```powershell
cloudflared service install
```

## 5) OpenAI Verification Compatibility Checks

OpenAI verification requires a **public HTTPS** URL.  
`localhost` URLs cannot pass domain verification.

Run:
```bash
curl https://app.example.com/.well-known/mcp-verification.txt
curl https://app.example.com/health
```

Expected:
- `/.well-known/mcp-verification.txt` returns plain text only (no HTML)
- `/health` returns a successful health response

Optional MCP endpoint check:
```bash
curl -X POST https://app.example.com/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":"ping","method":"initialize","params":{}}'
```
