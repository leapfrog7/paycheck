# PayCheck Development Rules

PayCheck is a Central Government pay, arrears and benefits calculator.

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
