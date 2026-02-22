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

## Role-Recommended Shortcuts (Future)

Coordinators will be able to publish recommended shortcut sets per role:
- Washers: New Task, Daily Register, Queue
- Supervisors: Shifts, Fleet, Analytics
- Coordinators: All + Settings, Imports

Users can adopt recommended shortcuts with one click.

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
