# PayCheck UI/UX Audit

Audit date: 19 August 2026
Scope: dashboard, goal selection, guided setup, case workspace, Expected Pay, Drawn Pay, and arrears/recovery presentation.

## Executive assessment

PayCheck is now understandable enough for a first-time user to begin a calculation without knowing the internal pay-engine vocabulary. The strongest improvement is the connected journey from a clear home-page promise to a goal-based setup, a result-first overview, actionable missing-information states, fast Drawn Pay entry, and optional technical evidence.

Overall static-review score after the mobile/PWA follow-up: **8.5/10**.

## Mobile and installability follow-up

The post-Phase-6 pass treats mobile as a primary usage context rather than a compressed desktop screen:

- compact safe-area-aware header and page gutters, with the least essential header CTA removed only at very narrow widths;
- 16 px mobile form controls to prevent unwanted iOS input zoom and larger touch targets for workspace disclosures;
- mobile-first case header/progress layout and task-first ordering, including the fast Drawn Pay list before its detailed editor;
- tighter result and dashboard information density without removing calculation capability;
- a browser-aware **Install app** action in global navigation and an inviting home-page install card;
- an accessible install-help dialog when the browser does not expose a native prompt;
- a generated, versioned production service worker that precaches the exact built shell rather than guessing hashed assets;
- automated desktop and Pixel 7 checks for overflow, install metadata, fallback help, service-worker control, cached entry assets and a real offline reload.

The app is now materially more resilient for repeat mobile use. Remaining release checks should include VoiceOver/TalkBack and physical iOS/Android device testing, especially because native install-prompt availability and browser chrome differ by platform.

## Phase 6 implementation update

Phase 6 has now addressed the release-readiness items identified by this audit:

- application-level crash recovery with safe return/reload actions;
- route/dialog code splitting, reducing the initial minified JavaScript chunk from 546.81 kB to about 426 kB;
- URL-addressable workspace sections using `?step=` and browser history;
- programmatic focus after setup/workspace transitions and first-error focus;
- associated setup errors using `aria-invalid` and `aria-describedby`;
- persisted Simple/Detailed audit preference;
- live result and current-section announcements;
- mobile current-section text and automatic current-tab scrolling;
- unresolved-only filters in Due Pay and arrears/recovery ledgers;
- a 12 px floor for tertiary/interactive text and reduced-motion support;
- automated Playwright journeys in installed Chrome at 1440 px and Pixel 7 viewports, including console-error assertions.

The remaining items below are retained as the audit record. Career-change form selection, unavailable-calculator semantics, styling consolidation and deletion undo are useful follow-up refinements rather than Phase 6 blockers.

| Area | Score | Assessment |
| --- | ---: | --- |
| Value proposition and primary CTA | 9/10 | The hero states the job clearly and the primary action is unambiguous. |
| Information architecture | 8/10 | The journey has a useful beginning, middle and result; workspace depth is well grouped. |
| Guided setup | 8/10 | Progressive questions, autosave and safe previews reduce anxiety. |
| Calculation comprehension | 8/10 | Result, confidence, coverage and next action are visible together. |
| Data entry efficiency | 8/10 | Drawn Pay supports quick entry, detailed editing, copy-forward and paste. |
| Trust and auditability | 9/10 | Due and Drawn remain independent; partial results and assumptions are explicit. |
| Accessibility | 8/10 | Labels, focus transitions, live updates, reduced motion and install-help focus management are covered; assistive-technology testing remains. |
| Mobile resilience | 9/10 | Core journeys, responsive ordering, touch sizing, overflow and the Pixel 7 viewport are now production-browser tested. |
| Failure recovery | 8/10 | Validation and render failures are recoverable, and the visited application shell can reopen offline. |

No calculation formulas were evaluated as part of this UX audit; engine correctness remains covered by deterministic unit tests.

## Method and limitation

The review covered component structure, interaction state, responsive CSS, accessible names/landmarks, validation paths, calculation messaging, lint, tests and production build behavior.

The browser-audit skill's preferred `agent-browser` executable is not available in this environment. Phase 6 therefore uses Playwright with installed Chrome as the repeatable fallback. It now covers desktop/mobile rendering, keyboard focus transitions, primary workflow interactions and browser-console errors. It does not replace a manual screen-reader or physical touch-device review.

## What is working well

### A clear psychological contract

- “Check your pay. Know what you are due.” names both the user’s task and benefit.
- “Saved in your browser,” “Rule-based results,” and “Full calculation trail” answer privacy, credibility and control concerns before the user commits effort.
- The example card is labelled as an illustration, avoiding the false impression that it is the visitor’s result.

### Lower initial cognitive load

- The user chooses a goal before seeing pay terminology.
- Setup asks for one category of information at a time.
- Salary components reveal their eligibility/location context only when selected.
- Draft autosave makes it safer to stop and return.

### Result-first orientation

- The case opens on an overview rather than a dense ledger.
- The main amount is paired with confidence and month coverage.
- The next action points to the section that most improves the result.
- Partial totals are explicitly qualified and are never described as final.

### Efficient repeat work

- Drawn Pay defaults to a fast month list while retaining component-level editing.
- Copy-forward and bulk paste support long periods.
- Blank and zero are explained as different states, which prevents a financially significant ambiguity.

### Layered trust

- Simple view now uses plain language instead of codes such as `MISSING_HRA_ELIGIBILITY`.
- Detailed audit view retains rule IDs, reason codes, provenance and calculation steps.
- Due Pay is calculated from rules; Drawn Pay remains independently user-entered.

## Priority findings

### P1 — Address before a public release

#### 1. Add application-level crash recovery

There is no React error boundary around the route tree. A render error can replace the useful workflow with a blank/error screen, as happened earlier when a structured pay-matrix object reached an `<option>`.

Recommendation: add a friendly error boundary around the routed application. Preserve local data, explain that the saved case is safe, offer “Return to calculations” and “Reload,” and log the technical stack only to a development/audit surface.

#### 2. Manage focus when the interface changes context

The dialogs initially receive focus and trap Tab, which is good. However, moving to the next setup step replaces the focused button without deliberately focusing the new step heading or first invalid field. Workspace tab changes also replace the main panel without moving focus or announcing its new heading.

Recommendation:

- focus the step heading after Back/Continue;
- focus the first invalid field after validation;
- focus the workspace panel heading after a workspace step change;
- restore focus to the element that opened a dialog when it closes;
- connect field errors with `aria-describedby` and `aria-invalid`.

#### 3. Complete real-browser end-to-end verification

Unit tests protect calculations but cannot validate visual overflow, native date/month controls, focus order, dialog behavior, actual browser-console errors or touch targets.

Minimum release suite:

1. At 1440 px and 390 px, create a one-month Basic + DA case and reach Case Overview.
2. Select HRA/Transport and verify guidance leads to eligibility/location fields.
3. Enter Drawn Pay, copy it forward, edit components and reach a final comparison.
4. Confirm Simple view contains no raw reason codes; Detailed audit contains them.
5. Reload every workspace step and confirm saved data survives.
6. Complete the journey with keyboard only and assert no console errors.

#### 4. Increase the smallest supporting text

Several active styles use approximately `.58rem`–`.68rem` text for statuses, explanations and controls. Even where contrast passes, this is difficult for older users and users reading government-pay details on mobile.

Recommendation: set a practical floor of 12 px for tertiary labels and 14 px for explanatory/interactive text, while allowing zoom to 200% without clipped content.

### P2 — High-value workflow improvements

#### 5. Make workspace state linkable and browser-history aware

The selected workspace section exists only in local component state. Refresh returns to Overview, and browser Back does not return to the previously viewed section.

Recommendation: store the section in a query parameter such as `?step=drawn`. This enables reliable refresh, support links, history navigation and future deep links from validation messages.

#### 6. Reduce choice overload in Career Changes

The page asks “What changed?” but then presents the timeline and multiple detailed forms together. Users who only know “I was promoted” still have to scan form terminology before choosing where to act.

Recommendation: show compact choice cards first—Promotion, MACP/ACP, Pay Commission revision, Correction—and reveal one form after selection. Keep previously added events in the timeline above.

#### 7. Improve the seven-item mobile workspace navigator

Horizontal scrolling prevents the step bar from breaking, but a seven-item strip can hide Result or Drawn Pay off-screen. There is no explicit edge cue or automatic scroll-to-current behavior.

Recommendation: automatically bring the current item into view, add subtle edge fades, and consider a compact “Section X of 7” selector below 480 px.

#### 8. Add unresolved-only navigation to long output ledgers

Drawn Pay already filters missing/entered months. Pay History, Due Pay and Result show every month, so a multi-year case can make the one unresolved month hard to find.

Recommendation: add “All / Needs attention” filters and a “Next unresolved month” action, while keeping the complete ledger available for audit.

#### 9. Announce material result changes

The Expected Pay preview has `aria-live="polite"`, but the workspace’s live result and saved status are not live regions. A keyboard/screen-reader user may not know that entering Drawn Pay changed the net result.

Recommendation: announce concise transitions such as “Drawn Pay saved for January 2025; one of twelve months entered” and “Net result updated,” without announcing every keystroke.

#### 10. Clarify unavailable calculator navigation

Future calculators appear in the professional navigation taxonomy, which is useful, but “Coming soon” entries are still links to the calculator section. Users may interpret them as available routes.

Recommendation: render unavailable items as non-navigation status rows, or label the action explicitly as “View roadmap.”

### P3 — Refinement and maintainability

#### 11. Add reduced-motion support

The design uses hover transforms and transitions but has no `prefers-reduced-motion` rule.

Recommendation: remove non-essential animation and smooth movement when reduced motion is requested.

#### 12. Standardize human-readable dates

The dashboard and overview format dates helpfully, but the workspace header and some event facts show raw ISO dates. ISO is auditable but less friendly for quick scanning.

Recommendation: display `01 Jan 2025` in Simple view and retain `2025-01-01` in Detailed audit or machine exports.

#### 13. Unify the styling strategy

The active UI mixes a large global stylesheet with Tailwind utilities in JSX, and several CSS sections are compressed into long single lines. This does not directly harm users today, but it raises the risk of inconsistent states and missed mobile regressions.

Recommendation: choose one component styling convention, extract shared tokens/status patterns, and split feature CSS into reviewable blocks.

#### 14. Persist the user’s detail preference

Simple/Detailed audit mode resets to Simple when the workspace remounts. Simple is the correct default, but repeat audit users will switch frequently.

Recommendation: store the preference locally, scoped to the device—not to financial case data.

#### 15. Provide a non-destructive recovery path for deletion

Deleting a case uses a clear native confirmation, but deletion is immediate and permanent.

Recommendation: use a short undo window or a local trash state, particularly because all data is browser-only.

#### 16. Split the initial JavaScript bundle by route/workflow

The production build succeeds, but Vite reports a 546.81 kB minified initial JavaScript chunk (152.37 kB gzip), above its 500 kB warning threshold. Pay matrices and specialist forms do not all need to load for a user reading the home page.

Recommendation: lazy-load the case workspace and specialist event forms, and measure the home-to-CTA interaction after splitting. Keep deterministic rule data with the route that first needs it.

## Heuristic review

| Heuristic | Status | Evidence |
| --- | --- | --- |
| Visibility of system status | Good | Autosave, completion, confidence, resolved months and progress are visible. |
| Match with the user’s language | Good | “Expected Pay,” “Actually Paid,” and action-oriented guidance replace internal codes in Simple view. |
| User control and freedom | Mixed | Back, save/exit and editable sections exist; deletion has no undo and workspace state is not history-aware. |
| Consistency | Good | Cards, statuses, result tones and navigation patterns are largely consistent. |
| Error prevention | Good | No silent defaults, blank versus zero distinction, dated eligibility and explicit incomplete states. |
| Recognition over recall | Good | Case facts and live result remain visible; Career Changes still exposes several forms simultaneously. |
| Efficiency | Good | Autosave, quick Drawn entry, copy-forward and paste serve repeat/high-volume use. |
| Minimalism | Good | Progressive setup and Simple view limit technical detail; long histories still need unresolved filters. |
| Error recovery | Mixed | Messages usually explain next action; application render crashes have no friendly boundary. |
| Help and documentation | Good | Trust/methodology framing and Detailed audit exist; exportable case documentation is still future work. |

## Accessibility snapshot

Confirmed statically:

- semantic header, main, navigation, section and aside landmarks are used;
- primary/mobile navigation has accessible labels;
- icon-only mobile and dialog controls have accessible names;
- goal/setup dialogs use `role="dialog"`, `aria-modal`, Escape handling and a focus trap;
- most inputs are wrapped by labels or use explicit label IDs;
- focus-visible styling exists globally and on utility-styled controls;
- progress/current workspace items expose `aria-current`;
- status is not communicated only by color in the main workflow.

Needs live or implementation follow-up:

- step-change focus and focus restoration;
- error-to-field programmatic association;
- screen-reader announcement quality;
- 200% zoom/reflow and 320 px width;
- contrast measurement for all amber/grey tertiary text;
- reduced motion;
- keyboard operation of native `<details>` menus and all sticky/scrolling regions.

## Phase 6 verification and next work

Phase 6 is implemented and covered by unit, lint, production-build and desktop/mobile browser checks. A manual screen-reader pass remains advisable before public release because automation cannot judge announcement quality or comprehension.

The highest-value next product phase is a traceable export/report containing inputs, assumptions, Due Pay, Drawn Pay, differences and rule references. Career-change choice cards and deletion undo can be included in that refinement. New retirement calculators should remain separate modules and should start only when explicitly requested.
