# QA V2 BASELINE

## Failing Workflows/Steps
- CI (Run 22477784794)
  - Step: `quality E2E smoke tests`

## Failures Grouped
### E2E Smoke Tests (Desktop)
- `shift planner flow: create shift and show in board`: Failed to see "Shift created." toast/msg.
- `command palette opens and navigates`: Failed to navigate to `/analytics`, stayed on `/overview`.
- `chat basic flow: create thread and send message`: Failed to see "Thread created." toast/msg.

### Observations
- Many failures are related to missing expected UI responses (toasts/navigation) after a click.
- Could be hydration issues, slow backend, or missing "use client" on buttons.
