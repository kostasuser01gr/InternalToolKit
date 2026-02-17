# InternalToolKit Quality Scorecard

Use this scorecard before release.

## UI

| Check | Pass Criteria | Fail Criteria |
| --- | --- | --- |
| Visual consistency | Tokens and glass style are consistent across routes. | Mismatched spacing/colors or non-token styling. |
| Responsive shell | Mobile/tablet/desktop shell variants render correctly. | Missing/incorrect shell layout on any breakpoint. |
| State completeness | `/components` shows default/hover/active/disabled/loading/error for core components. | Missing state or broken component behavior. |
| Overflow control | No horizontal overflow at tested viewports. | Any x-axis scroll at mobile/tablet/desktop. |

## Accessibility

| Check | Pass Criteria | Fail Criteria |
| --- | --- | --- |
| Labels and semantics | Interactive elements are labeled and keyboard reachable. | Missing labels/roles or keyboard traps. |
| Focus visibility | Focus ring appears on keyboard navigation. | Hidden/insufficient focus state. |
| Reduced motion | Motion respects reduced-motion preference. | Animations continue aggressively in reduced mode. |
| Error communication | Error states are textual and clear. | Color-only or silent failures. |

## Performance

| Check | Pass Criteria | Fail Criteria |
| --- | --- | --- |
| CLS safety | Reserved heights for cards/charts, stable shell loading. | Noticeable layout shifts during load. |
| Lightweight interactions | Data table/filter interactions stay responsive. | Interaction lag under moderate data volume. |
| PWA readiness | Manifest valid, standalone mode works, safe-area respected. | Broken install/runtime shell in standalone mode. |

## Security

| Check | Pass Criteria | Fail Criteria |
| --- | --- | --- |
| Session cookie flags | HttpOnly + SameSite + Secure (prod/flag) are set. | Missing secure cookie properties. |
| Route protection | Unauthenticated users blocked from app routes. | Protected pages accessible anonymously. |
| Header baseline | CSP + XCTO + Referrer + Permissions + frame protection enabled. | Missing or weak headers. |
| Audit trail | Meaningful actions append audit events. | No audit evidence for core actions. |

## DX

| Check | Command | Pass Criteria |
| --- | --- | --- |
| Lint | `pnpm lint` | 0 errors/warnings configured as failures |
| Typecheck | `pnpm typecheck` | strict TS passes |
| E2E smoke | `pnpm test:e2e` | golden flows pass |
| Build | `pnpm build` | web + api + shared build successfully |

## Verdict

- **PASS**: all checks pass.
- **FAIL**: any check fails.
