# PayCheck Development Rules

PayCheck is a Central Government pay, arrears and benefits calculator.

This file is the repository-wide instruction source for people and coding agents. Windows treats `AGENTS.md` and `agents.md` as the same filename, so do not create a second case-only variant.

## Core principles

1. Calculation logic must be deterministic.
2. AI must never determine financial calculation results.
3. Calculation engines must remain independent of React UI components.
4. Government rules and rates should be stored as structured data wherever possible.
5. Every calculated result must be traceable and explainable.
6. Avoid hard-coding rates inside UI components.
7. Prefer pure functions for calculation engines.
8. Every engine should be testable independently.
9. Do not silently assume missing user data.
10. Assumptions used in calculations must be recorded for display to the user.

## Initial scope

The MVP covers:
- 7th CPC pay matrix
- annual increment
- promotion/MACP events
- DA
- HRA
- Transport Allowance
- month-wise pay generation
- due-drawn comparison
- arrears/recovery summary

Do not implement 5th CPC, 6th CPC, pension or retirement calculators unless specifically requested.

The repository already contains historical 5th/6th CPC pay-state and transition support needed to replay long-running 7th CPC cases. Treat that as existing calculation infrastructure; do not broaden it into unrelated calculators without an explicit request.

## Product intent

This project is intentionally frontend-only at the start. The eventual architecture needs client-side rule tables, calculation engines, browser storage and exports.

## Engineering guardrails

- React is a presentation layer only.
- Calculation logic should live in pure, isolated engine modules.
- Rule tables should be data-first and versioned where practical.
- The UI must render assumptions, inputs, and calculation traces clearly for auditability.
- Missing or ambiguous values must surface as explicit validation states, not silent defaults.
- All financial output must be reproducible from the same input set.
- Future functionality may extend to more government schemes, but the current MVP remains limited to the scope above.

## Working approach

- Keep business rules separate from UI concerns.
- Treat calculations as auditable logic rather than AI-generated outputs.
- Prefer small, testable functions over monolithic components.
- Validate data assumptions before computing final values.
- Store reference tables and configuration in data modules rather than inline JSX or component props.

## Architecture boundaries

Dependencies should flow in this direction:

```text
data + domain -> engines -> feature models -> React components/pages
                                      -> storage adapter
```

- `src/data/` contains dated rates, matrices, mappings and product catalogs. Data modules must not import React.
- `src/domain/` defines normalized financial concepts, validation, event types and constructors. Domain modules must not import React.
- `src/engines/` performs deterministic calculations. Engines may depend on data and domain modules, but never on UI or browser storage.
- `src/features/cases/models/` adapts persisted case data for engines and converts engine output into workflow-facing models. Keep calculations in engines, not these adapters.
- `src/features/cases/components/` and `src/pages/` render and collect information. They must not introduce rates, fixation logic or hidden calculation defaults.
- `src/storage/` is the persistence boundary. At present it is a browser `localStorage` adapter.

See `mentalMap.md` for the current file-by-file map and calculation flow.

## Case and calculation conventions

- Normalize persisted cases with `normalizeCaseInput` before use.
- Preserve the distinction between Due Pay and Drawn Pay. Drawn values are user-entered evidence and must never be inferred from Due Pay.
- Use `null`/unresolved states for unknown monetary results. Do not use zero to mean “not entered.”
- Date-sensitive calculations use explicit `YYYY-MM-DD` effective dates and dated rule tables.
- A failed or incomplete engine result must return a reason/status that can be audited.
- User-facing explanations belong in `calculationPresentation.js`; raw reason codes belong in Detailed audit view, not as the primary message.
- New persisted fields need safe defaults in both `createEmptyPayCase` and `normalizeCaseInput`.
- Existing saved cases must remain readable after schema additions.

## UI and UX conventions

- Lead with the result, its confidence, and the next useful action.
- Use plain government-pay language in Simple view. Preserve rule IDs, provenance, assumptions and engine reason codes in Detailed audit view.
- Never show a provisional or partial total as final. State its coverage beside the amount.
- Ask for information only when it becomes relevant to the selected goal or selected allowance.
- Every form control needs an accessible label; every icon-only control needs an accessible name.
- Validation must explain how to recover and should remain close to the relevant input.
- Maintain keyboard-visible focus and usable layouts at narrow mobile widths.
- Avoid rendering arbitrary engine objects directly in JSX. Convert them to strings or structured elements first.

## Testing requirements

- Add or update unit tests for every rule, engine branch, normalization change and presentation translation.
- Prefer table-driven tests for dated rates and pay-matrix mappings.
- Include regression tests for boundary dates, unsupported states, missing input and partial periods.
- A calculation change is not complete until the same inputs reproduce the same outputs and trace.
- UI changes should be checked at desktop and mobile widths, with keyboard navigation and browser console errors reviewed.
- PWA changes must be tested against a production build because the development server does not register the service worker.

## PWA conventions

- `public/manifest.webmanifest` owns install metadata and shortcuts.
- Edit `public/app-icon.svg`, then run `npm run icons:pwa` to regenerate install PNGs.
- The production service worker is emitted by `vite.config.js` from `scripts/service-worker-template.txt`; never edit generated `dist/sw.js`.
- Keep install UI browser-aware. A direct prompt is only available when the browser provides `beforeinstallprompt`; preserve the accessible Add to Home Screen fallback.
- Cache only the application shell. Saved financial cases continue to use the storage adapter and must not be duplicated into service-worker caches.

Before handing off a change, run:

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

## Current product workflow

The main case journey is:

1. Choose a calculation goal.
2. Complete the guided five-step case setup.
3. Review the result-first Case Overview.
4. Resolve career changes and selected allowance requirements.
5. Enter Drawn Pay using the quick month list or detailed editor.
6. Review month-wise arrears/recovery.
7. Switch to Detailed audit view when rule-level evidence is required.

The current post-workflow roadmap begins with end-to-end accessibility and browser verification, then export/reporting and broader calculator modules only when explicitly requested.

## Change checklist

1. Locate the owning layer before editing.
2. Verify that the relevant government rule is represented as data or a pure engine rule.
3. Preserve unresolved states and provenance.
4. Update normalization for persisted schema changes.
5. Add focused tests, then run the full verification commands.
6. Update `mentalMap.md` when important files, flows or ownership boundaries change.
