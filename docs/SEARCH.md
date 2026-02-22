# Global Search

## Overview

Real-time search across all entities in the Operations OS. Accessible via the command palette (⌘K / Ctrl+K) and the top search bar.

## Searchable Entities

| Entity | Fields Searched | Results Link |
|--------|-----------------|--------------|
| Vehicles | plateNumber, model | /fleet |
| Washer Tasks | notes | /washers |
| Chat Threads | title | /chat |
| Chat Messages | content | /chat |
| Shifts | title | /shifts |
| Feed Items | title, summary | /feeds |
| Users/Staff | name, email | /settings |

## API

`GET /api/search?q=<query>&workspaceId=<optional>`

- Minimum 2 characters required
- Returns up to 20 results across all entity types
- Each result: `{ type, id, title, subtitle?, url? }`
- Schema-safe: skips entity types whose tables don't exist yet

## Performance

- **Postgres pg_trgm indexes** (wave 11) — GIN trigram indexes on 7 columns for fast partial and typo-tolerant matching
- `trigramSearch()` uses `similarity()` scoring + `ILIKE` fallback
- Results scored by relevance and sorted descending
- Results limited to 5 per entity type, 20 total
- Debounced client-side (300ms delay before API call)

### Indexes (migration `20260222201100_wave11_fts_trigram`)
| Table | Column | Index |
|-------|--------|-------|
| Vehicle | plateNumber | GIN gin_trgm_ops |
| Vehicle | model | GIN gin_trgm_ops |
| User | name | GIN gin_trgm_ops |
| Shift | title | GIN gin_trgm_ops |
| FeedItem | title | GIN gin_trgm_ops |
| ChatThread | title | GIN gin_trgm_ops |
| ChatMessage | content | GIN gin_trgm_ops |

## Permission Model

- Search scoped to workspace when `workspaceId` provided
- Chat messages RBAC-filtered: only public channels + user's member channels + channelless threads
- User search is cross-workspace (names/emails only, no sensitive data)

## Command Palette Integration

The command palette (⌘K) combines:
1. **Local actions**: Navigation routes, theme toggle, shortcuts
2. **Server search results**: Debounced API call to `/api/search`
3. **Custom shortcuts**: User-defined actions from `/v1/shortcuts`

Results appear in a unified list with type labels and keyboard navigation.
