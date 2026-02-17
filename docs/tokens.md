# Design Token Contract

## Token Source

- `apps/web/styles/tokens.css`
- `apps/web/styles/globals.css`

## Semantic Color Tokens

Required variables:

- `--background`
- `--surface`
- `--surface-2`
- `--border`
- `--text`
- `--text-muted`
- `--accent-purple-gradient`
- `--glow-shadow`

Rules:

1. Neon purple is for active/selected controls only.
2. Glass surfaces must use blur + subtle border + soft shadow.
3. Feature code should consume semantic tokens, not random hex values.

## Radius Scale

- `--radius-xs`
- `--radius-sm`
- `--radius-md`
- `--radius-lg`
- `--radius-xl`

## Spacing Scale (8px Grid)

- `--space-1` = 8px
- `--space-2` = 16px
- `--space-3` = 24px
- `--space-4` = 32px
- `--space-5` = 40px
- `--space-6` = 48px

Rules:

1. Page/component spacing should map to this scale.
2. Avoid single-use spacing values unless justified.

## Density Tokens

- `--density-card-padding`
- `--density-table-cell-padding`
- `--density-row-height`
- `--density-page-gap`

Rules:

1. Comfortable/compact mode changes these tokens only.
2. Data table row height and card padding must respond to these values.

## Viewport + Safe-Area Contract

Global utility classes in `globals.css`:

- `safe-pt`, `safe-pb`, `safe-pl`, `safe-pr`
- `app-viewport`, `app-viewport-min`

Rules:

1. Fixed mobile header/footer/nav must use safe-area utilities.
2. Shell height should use viewport utilities (dvh/svh/lvh aware), not hardcoded `100vh`.
3. Standalone display-mode tweaks must preserve tappable insets.

## State Coverage Contract

Core components must demonstrate and support:

- default
- hover
- active
- disabled
- loading
- error

Reference verification page: `/components`.
