# Shortcuts & Quick Bar

## Overview

Users can customize their workspace with pinned actions ("Quick Bar") for fast access to frequently used features.

## Quick Bar

The Quick Bar appears in the top navigation bar (desktop only) showing up to 6 action buttons.

### Default Actions
| Action | Route |
|--------|-------|
| New Task | /washers |
| Daily Register | /washers |
| Fleet | /fleet |
| Shifts | /shifts |
| Feeds | /feeds |
| Imports | /imports |

### Customization
1. User-defined shortcuts (from `/v1/shortcuts` API) appear first
2. Default actions fill remaining slots
3. Maximum 6 buttons shown

## Shortcuts API

### Create Shortcut
`POST /v1/shortcuts`
```json
{
  "label": "New Task",
  "command": "route /washers",
  "keybinding": "shift+n"
}
```

### List Shortcuts
`GET /v1/shortcuts`

### Delete Shortcut
`DELETE /v1/shortcuts/<id>`

## Command Types

| Command | Behavior |
|---------|----------|
| `route /path` | Navigate to route |
| `/slash-command` | Open chat with command |
| Other text | Copy to clipboard |

## Role-Recommended Shortcuts

Coordinators publish recommended shortcut sets per role. The Quick Bar shows a "+" button when recommendations are available.

### Built-in Role Defaults
| Role | Recommended Shortcuts |
|------|----------------------|
| ADMIN | Settings, Analytics, Imports |
| STAFF | My Tasks, My Shifts |

### How It Works
1. Quick Bar loads user shortcuts from `/v1/shortcuts`
2. Role defaults are compared against user's current bar
3. Missing recommendations appear as "+" button
4. User clicks "+" → sees recommended list
5. Click any recommendation → instantly adopted
6. Coordinators can customize role defaults via API (future: Settings UI)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ⌘K / Ctrl+K | Open command palette |
| / | Focus search bar |
| g → d | Go to dashboard |
| g → a | Go to analytics |
| Escape | Close palette/menus |

## Persistence
- Shortcuts stored server-side per user per workspace
- Quick Bar loads via `/v1/shortcuts` on mount
- Immediate UI update on changes
