# Feeds Module

## Overview

The Feeds module provides automated scanning of RSS/Atom sources to surface booking policy changes, competitor news, sales opportunities, and security alerts relevant to car rental operations.

## Architecture

### Data Model
- **FeedSource** — RSS/Atom feed URL with ETag caching, scan frequency, workspace scope
- **FeedItem** — Individual articles with category, relevance score, keywords, pin status
- Deduplication via `@@unique([workspaceId, urlHash])` using SHA-256 URL hash

### Scanner (`lib/feeds/scanner.ts`)
- Parses RSS 2.0 `<item>` and Atom `<entry>` formats
- CDATA section support
- HTML stripping and entity decoding
- ETag/If-Modified-Since support for efficient polling
- Summary truncation to 500 characters

### Categorization Engine
Categories with keyword dictionaries:
| Category | Keywords |
|---|---|
| BOOKING_POLICY | booking policy, cancellation, refund, insurance, fuel policy, surcharge, deposit, excess… |
| SALES_OPPORTUNITY | promotion, discount, deal, offer, commission, loyalty, promo code, upgrade… |
| SECURITY_ALERT | scam, fraud, security, breach, phishing, malware, vulnerability… |
| COMPETITOR_NEWS | europcar, goldcar, hertz, avis, sixt, enterprise, fleet, rental car… |
| GENERAL | Fallback when no keywords match |

Relevance score: 0.0–1.0, based on keyword match count (capped at 5 matches = 1.0).

## Default Sources
- Europcar Newsroom RSS
- Google News: car rental Europe
- Google News: Greece tourism car rental

## Server Actions
- `addFeedSourceAction` — Add custom RSS source
- `seedDefaultSourcesAction` — Seed workspace with default sources
- `scanFeedSourceAction` — Manually trigger scan of a source
- `pinFeedItemAction` — Toggle pin on feed item

## UI (`/feeds`)
- Category filter chips (all categories + "All")
- Sources sidebar with item counts and scan buttons
- Feed cards showing title, summary, category badge, relevance score, source, date
- Pin/unpin feed items
- Add custom source form
- Seed defaults button

## Scheduling (Future)
Currently manual scan only. Planned: cron-based scanning every 10–30 minutes via Vercel Cron or external scheduler.

## Rate Limiting & ToS
- User-Agent: `InternalToolKit-FeedReader/1.0`
- ETag support to minimize redundant fetches
- No aggressive scraping — respects server caching headers
- Google News RSS is public and ToS-compliant for personal/internal use
