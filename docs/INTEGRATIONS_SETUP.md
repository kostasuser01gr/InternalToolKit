# Integrations Setup

## Overview

The Internal Toolkit uses several external services. This document explains how to configure them.

## Required Environment Variables

### Core (Required)
```env
DATABASE_URL=postgresql://...     # Supabase pooler (port 6543)
DIRECT_URL=postgresql://...       # Supabase direct (port 5432, for migrations)
SESSION_SECRET=<random-string>    # Cookie encryption key
NEXTAUTH_URL=https://your-app.vercel.app
```

### AI Providers (Optional — free router)
```env
# At least one recommended for AI features
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=AIza...
GROQ_API_KEY=gsk_...
TOGETHER_API_KEY=...
```

### Viber Bridge (Optional)
```env
FEATURE_VIBER_BRIDGE=1            # Enable bridge
VIBER_BOT_TOKEN=<token>           # From Viber Admin Panel
VIBER_WEBHOOK_SECRET=<secret>     # For inbound webhooks
VIBER_TARGET_GROUP_ID=<id>        # Target group/community
```

### Feature Flags
```env
NEXT_PUBLIC_FEATURE_VOICE_INPUT=1   # Voice input in washer app
NEXT_PUBLIC_FEATURE_CHAT=1          # Chat module
NEXT_PUBLIC_FEATURE_FEEDS=1         # Feeds module
```

### Washer Kiosk
```env
KIOSK_TOKEN=<secure-random-token>   # Embedded in share link
```

## Setup Wizard

### Via Settings UI
Navigate to **Settings → Integrations** (Coordinator/God role only):
1. System detects missing API keys
2. Prompts for each integration
3. "Test Connection" validates the key
4. Keys are stored in environment, not in database

### Via CLI
```bash
pnpm setup:integrations
```
This interactive CLI tool:
1. Checks which keys are configured
2. Prompts for missing ones
3. Writes to `.env.local` (gitignored)
4. Validates connections

## Weather (No Key Needed)
The weather widget uses [Open-Meteo](https://open-meteo.com/), which is free and keyless.
- Cached for 10 minutes
- 5 pre-configured Greek airport stations
- Custom lat/lon via API: `/api/weather?lat=37.9&lon=23.7`

## Supabase
```bash
supabase link --project-ref <ref>
```
Project ref: `xtawoqzaeuvaelnruotc`

## Vercel
Configured via Vercel dashboard. Root directory: `apps/web`.
