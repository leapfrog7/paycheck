# PayCheck Product Spec

## Product goal

PayCheck is a Central Government pay, arrears and benefits calculator designed for frontend-only use in the initial phases. The product helps users create payroll cases, track calculation periods, compare due and drawn pay, and review arrears or recovery outcomes.

## Scope for Phase 2

This phase focuses on core case creation and persistence only.

- define a Pay Case data model
- create a guided form to initialise a case
- persist created cases in browser storage
- list saved cases and reopen a case
- prepare the data model for future timeline and due-drawn features
- keep all calculation logic separate from UI and storage layers

## In scope for MVP

- 7th CPC pay commission only
- pay-level and basic pay input for the starting pay model
- case metadata, period selection, and allowance selection
- save, reopen, and display stored cases

## Out of scope for this phase

- matrix validation against 7th CPC tables
- increment generation
- DA/HRA/Transport Allowance calculations
- month-wise pay generation
- due-drawn calculations
- pension, gratuity, or other future calculators
- backend, API, or database integration

## Pay Case model

A case must be serialisable JSON and must support the following fields:

- id
- caseName
- employeeName
- calculationStartDate
- calculationEndDate
- payCommission
- startingPay
- incrementDateMonth
- hraCityClass
- applicableAllowances
- futureEventTimeline
- futureDrawnPayData
- assumptions
- createdAt
- updatedAt

The initial pay commission support is limited to `7th CPC`.

Starting pay details for 7th CPC support:

- payLevel
- basicPay

Allowances should include at least:

- Basic Pay (always enabled and not user-selected)
- DA
- HRA
- Transport Allowance

The model should remain extensible for later allowances such as NPA, Deputation Allowance, Special Pay and Custom Allowance.

## UX requirements

The New Calculation flow should provide a simple guided form with sections for:

1. Case details
2. Calculation period
3. Starting pay
4. Allowances

The form should not expose advanced fields such as event timeline, drawn-pay data, overrides, or assumptions during case creation.

After a case is created, the application should navigate to a case workspace showing a summary plus placeholders for:

- Pay Timeline
- Events
- Due Pay
- Drawn Pay
- Arrears / Recovery

## Storage requirements

- browser storage only
- use localStorage for now unless a suitable IndexedDB abstraction already exists
- isolate storage logic in `src/storage`
- do not access browser storage directly from UI components

## Validation requirements

Basic validation during case creation:

- case title required
- calculation start date required
- calculation end date required
- end date cannot precede start date
- pay level required
- basic pay must be a positive number

## Quality constraints

- calculations remain separate from UI objects and storage
- data structures should be deterministic and serialisable
- assumptions should be recorded for later display in the case details
- no hidden defaults where data is missing
