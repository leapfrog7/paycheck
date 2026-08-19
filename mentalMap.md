# PayCheck Application Mental Map

This document is the practical map of the current frontend-only application: where responsibilities live, which files are important, and how a saved case becomes an auditable arrears/recovery result.

## Product shape

PayCheck helps Central Government employees reconstruct Expected (Due) Pay, record the salary actually Drawn, and compare the two month by month. The current main workflow is a 7th CPC pay case with historical 5th/6th CPC support where a long calculation period requires it.

```text
Home / dashboard
  -> choose goal
  -> guided five-step setup
  -> save normalized case in localStorage
  -> result-first case overview
  -> review pay history, events and allowances
  -> enter Drawn Pay
  -> Due versus Drawn result
  -> optional Detailed audit view
```

There is no backend. Government tables, engines, saved cases and calculations all run in the browser.

## Top-level structure

```text
paycheck/
├── AGENTS.md                 repository development rules
├── .github/workflows/        verified GitHub Pages deployment
├── mentalMap.md              this architecture and navigation map
├── README.md                 setup and project introduction
├── docs/                     product and domain design notes
├── public/                   manifest, install icons and shared SVG icon sprite
├── scripts/                  PWA icon generation and service-worker template
├── src/
│   ├── __tests__/            Vitest rule, engine and workflow tests
│   ├── components/           application shell and home-page components
│   ├── data/                 versionable rule tables and product catalogs
│   ├── domain/               financial types, constructors and validation
│   ├── engines/              pure deterministic calculations
│   ├── features/cases/       case workflow models, forms and result UI
│   ├── pages/                top-level route pages
│   ├── pwa/                  install prompt state and service-worker registration
│   ├── storage/              browser persistence adapters
│   ├── App.jsx               route table
│   ├── main.jsx              React entry point
│   └── index.css             global design system and feature styles
├── playwright.config.js      production desktop/mobile browser test configuration
├── package.json              commands and dependencies
└── vite.config.js            Vite/Vitest configuration
```

## Route and shell map

| Route/file | Responsibility |
| --- | --- |
| `src/main.jsx` | Mounts the React app in Strict Mode, provides install-prompt state and registers the production service worker. |
| `src/App.jsx` | Defines `/`, `/saved-cases`, `/case/:caseId`, redirects `/new-calculation`, catches unknown routes, lazy-loads secondary routes, and respects Vite's deployment base path. |
| `src/components/AppErrorBoundary.jsx` | Preserves a recoverable, local-data-safe screen when a React render fails. |
| `src/components/AppShell.jsx` | Wraps every route with the site header, content area and footer. |
| `src/components/SiteHeader.jsx` | Brand and global navigation. |
| `src/components/SiteFooter.jsx` | Product trust and footer navigation. |
| `src/components/InstallAppButton.jsx` | Browser-aware install action with accessible Add to Home Screen fallback instructions. |
| `src/components/InstallAppPromo.jsx` | Home-page install value proposition and CTA. |
| `src/pages/DashboardPage.jsx` | Home dashboard, primary CTA, recent cases and calculation entry point. |
| `src/pages/SavedCasesPage.jsx` | Lists and deletes locally saved cases. |
| `src/features/cases/pages/CaseWorkspacePage.jsx` | Owns the seven-section case workspace, URL-backed `?step=` view, focus announcements and persisted case updates. |

`src/pages/HomePage.jsx` and `src/pages/NewCalculationPage.jsx` remain in the tree but are not direct route targets in the current `App.jsx`; the dashboard and dialog now own those journeys.

## PWA and offline shell

| File | Responsibility |
| --- | --- |
| `public/manifest.webmanifest` | Install name, scope, colors, icons and calculation shortcuts. |
| `public/app-icon.svg` | Editable source icon. |
| `public/app-icon-192.png`, `public/app-icon-512.png` | Install and maskable icon outputs. |
| `src/pwa/InstallPromptProvider.jsx` | Captures the browser install event and tracks installed/standalone state. |
| `src/pwa/installPromptContext.js` | Context contract and consumer hook. |
| `src/pwa/registerServiceWorker.js` | Registers `/sw.js` only in production. |
| `scripts/service-worker-template.txt` | Auditable service-worker lifecycle and cache strategy. |
| `scripts/generate-pwa-icons.mjs` | Rebuilds PNG icons from the SVG source. |
| `vite.config.js` | Emits a versioned `sw.js` whose precache list is derived from the actual build bundle. |
| `.github/workflows/deploy-pages.yml` | Tests, lints and builds with `/paycheck/`, adds the SPA fallback, and deploys the artifact to GitHub Pages. |

Do not edit `dist/sw.js`; it is generated. The offline cache contains application code and static assets, while financial values continue to be owned by the existing local case-storage boundary.

## Home and setup UI

| File | Responsibility |
| --- | --- |
| `src/components/BrandLogo.jsx` | Reusable PayCheck mark and wordmark. |
| `src/components/ProductIcon.jsx` | Consistent SVG/icon rendering. |
| `src/components/HomeGuidance.jsx` | “How it works” and trust guidance. |
| `src/components/CalculatorDirectory.jsx` | Available and future calculator cards driven by catalog data. |
| `src/data/calculatorCatalog.js` | Calculator availability, labels and descriptions. |
| `src/data/calculationGoals.js` | User goals and goal-specific messaging. |
| `src/features/cases/components/CalculationGoalDialog.jsx` | First decision: what the user wants to calculate. |
| `src/features/cases/components/NewCalculationDialog.jsx` | Guided five-step case setup and validation. |
| `src/features/cases/components/ExpectedPayPreview.jsx` | Safe preview based only on confirmed setup information. |
| `src/features/cases/components/GuidedCareerChanges.jsx` | Plain-language career-history questions used during setup. |
| `src/features/cases/components/SeventhCpcLevelOptions.jsx` | Converts structured matrix levels to renderable select options. |

## Case model and persistence

| File | Responsibility |
| --- | --- |
| `src/features/cases/models/payCase.js` | Creates empty cases/events and normalizes old or partial saved data. This is the case schema boundary. |
| `src/storage/caseStorage.js` | CRUD for the `paycheck:cases` localStorage collection. Every read is normalized. |
| `src/domain/pay/drawnPay.js` | Drawn Pay record shape, entry modes, validation, normalization and upsert/copy operations. |
| `src/domain/pay/payState.js` | Canonical opening pay-state constructor. |
| `src/domain/pay/payStateValidation.js` | CPC-specific pay-state validation. |
| `src/domain/events/eventTypes.js` | Event identifiers and display labels. |
| `src/domain/events/eventStatus.js` | Event/provenance statuses. |
| `src/domain/events/fixationOptions.js` | Fixation choices and labels. |

Important case fields include the calculation goal and period, opening/starting pay, selected allowances, dated location and eligibility histories, service events, Drawn Pay history, proration decisions, assumptions and unresolved issues.

## Calculation flow

```text
normalized case
  |
  +-> opening pay state + service events
  |     -> calculatePayEventTimeline
  |     -> applyPayEvent
  |     -> CPC-specific increment/promotion/MACP/transition engines
  |     -> month-wise Pay History
  |
  +-> buildCaseDuePayLedger
  |     -> buildFinancialSegments
  |     -> calculateAllowancesForSegment
  |     -> calculateSegmentDue
  |     -> buildMonthlyDueLedger
  |     -> Due Pay months + trace/provenance/unresolved reasons
  |
  +-> Drawn Pay history (independently entered)
        + Due Pay ledger
        -> buildDueDrawnComparison
        -> compareDueDrawnMonth
        -> summarizeDueDrawnComparison
        -> arrear/recovery totals and unresolved coverage
```

The UI must not bypass this path by calculating amounts inside JSX.

## Pay engines

### Orchestration

| File | Responsibility |
| --- | --- |
| `src/engines/pay/applyPayEvent.js` | Dispatches a service event to the correct CPC/event calculation. |
| `src/engines/pay/eventTimeline.js` | Sorts and replays events from the opening pay state, retaining each result. |
| `src/engines/pay/history/buildPayHistory.js` | Builds month periods and pay segments from the replayed timeline. |
| `src/engines/pay/dni/resolveDni.js` | Dispatches Date of Next Increment resolution to the CPC-specific resolver. |

### CPC-specific calculations

- `src/engines/pay/7cpc/`: annual increment, promotion, MACP, matrix placement and fixation from lower-post DNI.
- `src/engines/pay/6cpc/`: annual increment, rounding, promotion, MACP and fixation choices.
- `src/engines/pay/5cpc/`: stage-based increment, promotion and ACP.
- `src/engines/pay/5cpcTo6cpcTransition.js`: Rule 7 transition and fitment.
- `src/engines/pay/6cpcTo7cpcTransition.js`: 2.57 fitment and matrix placement.
- `src/engines/pay/dni/`: 5th/6th/7th CPC DNI rules and qualifying-service evaluation.

### Due Pay ledger

| File | Responsibility |
| --- | --- |
| `src/engines/pay/ledger/buildFinancialSegments.js` | Splits the period when financial state or dated context changes. |
| `src/engines/pay/ledger/calculateAllowancesForSegment.js` | Resolves enabled allowances for one segment through the registry. |
| `src/engines/pay/ledger/calculateSegmentDue.js` | Produces auditable segment totals and proration status. |
| `src/engines/pay/ledger/buildMonthlyDueLedger.js` | Groups segments into month-wise Due Pay and marks unresolved months explicitly. |

### Due versus Drawn

| File | Responsibility |
| --- | --- |
| `src/engines/pay/comparison/compareMonth.js` | Compares one Due month with one independently entered Drawn record. |
| `src/engines/pay/comparison/buildDueDrawnComparison.js` | Aligns the monthly ledgers. |
| `src/engines/pay/comparison/summarizeComparison.js` | Totals resolved arrears/recoveries and qualifies partial totals. |

## Allowance system

```text
ALLOWANCE_REGISTRY
  ├── DA -> dated DA rule lookup -> DA calculation/rounding
  ├── HRA -> dated HRA scheme + city class -> HRA calculation
  ├── Transport -> CPC/location/pay rule -> Transport calculation
  └── Custom -> validated user definition -> custom calculation
```

Important files:

- `src/engines/allowances/allowanceRegistry.js`: engine lookup boundary.
- `src/data/allowances/da/historicalDaRates.js`: dated DA series and authority metadata.
- `src/data/allowances/hra/hraRuleSchemes.js`: HRA schemes and DA-threshold rates.
- `src/data/allowances/transport/transportAllowanceRules.js`: CPC-specific transport rules.
- `src/domain/allowances/`: allowance codes, result contracts, eligibility/location states and custom definitions.
- `src/engines/allowances/`: pure DA, HRA, Transport and custom-allowance calculators.

## Rule data

| Directory/file | Contents |
| --- | --- |
| `src/data/pay/7cpcPayMatrix.js` | Full 7th CPC pay matrix and level labels. |
| `src/data/pay/6cpcPayBands.js` | 6th CPC bands, grade pays and hierarchy helpers. |
| `src/data/pay/5cpcPayScales.js` | Verified standard stage-based scales and aliases. |
| `src/data/pay/5cpcTo6cpcMapping.js` | Historical scale-to-band mapping. |
| `src/data/pay/6cpcTo7cpcMapping.js` | Grade-pay/band-to-level mapping. |
| `src/data/pay/macpFinancialHierarchy.js` | MACP target hierarchy. |

Rates and mappings belong here, not in forms or result components.

## Case-workspace presentation

| File | Responsibility |
| --- | --- |
| `CaseOverview.jsx` | Result-first summary, coverage, staged progress and next actions. |
| `WorkspaceOverview.jsx` | Workspace navigation, step introductions, guidance and live-result card. |
| `PayHistory.jsx` | Month-wise Basic Pay history. |
| `DuePayLedger.jsx` | Month/segment salary breakdown and allowance resolution. |
| `ServiceEventTimeline.jsx` | Applied/unresolved event results and optional calculation steps. |
| `StandardAllowancesSection.jsx` | DA/HRA/Transport selection and required context. |
| `CustomAllowancesSection.jsx` | User-defined allowance setup. |
| `DrawnPaySection.jsx` | Drawn Pay workspace coordinator. |
| `DrawnPayQuickList.jsx` | Fast gross entry by month. |
| `DrawnPayEditor.jsx` | Component-level Drawn Pay editing. |
| `DrawnPayBulkPaste.jsx` | Spreadsheet-style month/amount import. |
| `ArrearRecoverySection.jsx` | Month-wise comparison, outcomes and partial/final totals. |
| `CalculationViewToggle.jsx` | Switches between plain-language Simple and technical Detailed audit views. |
| `calculationPresentation.js` | Central translation of engine reason codes to safe user guidance. |

Event forms are `RegularPromotionForm.jsx`, `MacpForm.jsx`, and `FifthToSixthCpcTransitionForm.jsx`.

## Feature models

| File | Responsibility |
| --- | --- |
| `buildGuidedExpectedPay.js` | Turns guided setup answers into safe routine events and an Expected Pay preview. |
| `buildCaseDuePayLedger.js` | Adapts a normalized case to the monthly Due Pay engine. |
| `buildCaseOverview.js` | Combines Due Pay, Drawn comparison and workflow completeness into a result-first model. |
| `buildAllowanceSetup.js` | Reads, validates and writes selected allowance context. |
| `drawnPayWorkspace.js` | Pure month-list, quick-entry, copy and paste-import helpers. |
| `calculationPresentation.js` | Plain-language presentation adapter; it must not alter engine outcomes. |

## Tests

`src/__tests__/` mirrors calculation capabilities rather than React structure. The major groups are:

- pay matrix and CPC-specific increments/fixations;
- historical CPC transitions;
- career progression, promotion after MACP, corrections and DNI;
- DA/HRA/Transport/custom allowances;
- proration, Pay History and Due Pay ledger;
- Drawn Pay and Due-versus-Drawn comparison;
- guided setup, case overview, allowance setup and calculation presentation.

Run all tests with `npm test`. A new rule branch needs a focused regression test near the related group.

`tests/e2e/` contains Playwright journeys for desktop and Pixel 7 Chrome. `playwright.config.js` builds and previews the production app, uses the installed Chrome channel, captures failure traces/screenshots, and checks setup/workspace behavior plus PWA metadata, install help and an actual offline reload. Run it with `npm run test:e2e`.

## Styling and assets

- `src/index.css` contains the global palette, responsive layout and all active component styles. It currently mixes conventional class rules with Tailwind utility classes used directly in JSX.
- `public/icons.svg` is the reusable legacy icon sprite.
- `public/app-icon.svg` is the current browser and install icon source; the PNG variants are generated from it.
- `src/assets/hero.png` is the current dashboard illustration.
- `src/App.css`, `src/assets/react.svg`, and `src/assets/vite.svg` appear to be starter/legacy assets and are not central to the current route flow.

## Documentation

- `docs/product-spec.md`: product intent and scope.
- `docs/pay-domain-model.md`: pay-state and event concepts.
- `docs/pay-rules.md`: calculation-rule notes.
- `docs/allowance-model.md`: allowance contracts and traceability.
- `docs/development-rules.md`: engineering conventions.
- `docs/architecture.md`: original high-level frontend architecture.
- `docs/ui-ux-audit.md`: current usability audit and prioritized next phase.

## Safe extension points

When adding a dated pay/allowance rule: add structured data, implement or extend a pure resolver/calculator, add boundary tests, then expose its reason/provenance through the existing ledger.

When adding a case field: update the empty case, normalization, storage migration behavior, form validation, summary/audit display and tests.

When adding a new calculator (for example gratuity or pension): create a separate feature/domain/engine boundary and catalog entry. Do not put its formulas in the existing pay-case React components.

When adding UI around an unresolved reason: translate it in `calculationPresentation.js`, keep the raw code available in Detailed audit view, and never change the underlying engine result in the presentation layer.
