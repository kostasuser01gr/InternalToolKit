#!/bin/bash

# Configuration
PROD_URL="https://internal-tool-kit-web.vercel.app"

echo "=== PRODUCTION HEALTH CHECK ==="
echo "Target: $PROD_URL"

# 1. Check /login
echo -n "Checking /login (HTML)... "
LOGIN_RESPONSE=$(curl -s -I "$PROD_URL/login")
if echo "$LOGIN_RESPONSE" | grep -iq "content-type: text/html"; then
  echo "✅ OK"
else
  echo "❌ FAIL (Not HTML)"
  echo "$LOGIN_RESPONSE" | grep -i "content-type"
  exit 1
fi

# 2. Check /api/health
echo -n "Checking /api/health (JSON)... "
HEALTH_RESPONSE=$(curl -s "$PROD_URL/api/health")
if echo "$HEALTH_RESPONSE" | jq -e ".ok == true" > /dev/null 2>&1; then
  echo "✅ OK"
else
  echo "❌ FAIL (Invalid JSON or status)"
  echo "Response: $HEALTH_RESPONSE"
  exit 1
fi

echo ""
echo "=== VERCEL PRODUCTION LOGS (Last 30m) ==="
# Attempt to fetch logs, but don't fail the whole script if Vercel CLI is not linked/auth'd in this specific shell
vercel logs "$PROD_URL" --environment production --since 30m 2>/dev/null || echo "Info: Could not fetch logs via Vercel CLI (not linked or authenticated)."

echo ""
echo "🎉 Production is healthy!"
echo "View full logs at: https://vercel.com/kostasuser01gr/internal-tool-kit-web/logs"
