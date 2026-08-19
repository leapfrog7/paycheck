# PayCheck Development Rules

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

## Phase 2 constraints

- Do not implement pay calculations yet.
- Do not create a backend, database, API layer, or authentication.
- Do not add pension, gratuity, or other future calculator flows.
- Keep domain models, storage, and UI separated.
- Use stable identifiers for cases via `crypto.randomUUID()` when available.
- Keep data serialisable JSON.
- Keep feature code extensible for future event timeline and due-drawn features.

## Architecture expectations

- UI components are presentation-only.
- Domain models live in a dedicated model layer.
- Storage services live in `src/storage` and are the only layer allowed to read/write browser storage.
- Calculation engines should not be created in this phase.
- The app shell should remain simple and responsive for desktop and mobile use.

## Working approach

- use minimal, reusable components
- keep the data model explicit and easy to extend
- validate required fields before saving
- save created cases locally and reopen them from storage
- keep future-event fields available without exposing them in the initial form

# UI and Responsive Design Rules

All PayCheck UI work must be designed for both desktop and mobile from the start.

## Responsive Design

* Every page and component must work correctly at mobile, tablet, laptop and desktop widths.
* Do not treat mobile as a reduced desktop layout. Reconsider spacing, stacking, controls and information density for smaller screens.
* Avoid fixed widths unless there is a clear reason.
* Prefer responsive layouts using flex/grid, wrapping, sensible max-widths and breakpoint-based changes.
* Prevent horizontal overflow.
* Tables must have an intentional mobile strategy such as horizontal scrolling, condensed columns, stacked rows or responsive cards depending on the content.
* Forms should normally become single-column on mobile and may use multiple columns on wider screens.
* Primary actions must remain visible and easy to reach on mobile.
* Do not hide essential functionality on mobile merely to simplify the layout.
* Touch targets should be comfortably sized and controls should not depend only on hover.
* Any hover-only desktop interaction must have an equivalent visible/tap interaction on touch devices.

## Visual Quality

The UI should look like a polished professional financial/government productivity application, not a prototype or generic admin template.

Prefer:

* restrained visual hierarchy;
* clean typography;
* consistent spacing;
* subtle borders and elevation;
* clear grouping of related information;
* professional cards, forms, tables and summaries;
* strong readability for numerical and financial data;
* sensible use of whitespace;
* consistent icon sizing and alignment.

Avoid:

* excessive gradients;
* oversized headings;
* decorative animation without functional value;
* excessive rounded cards;
* visually noisy dashboards;
* unnecessary colours;
* dense forms with weak grouping;
* components that look different without a functional reason.

## Components

* Reuse existing design patterns before creating new ones.
* Maintain consistent button, input, select, card, modal, badge, alert and table styles.
* Use clear visual distinction between primary, secondary and destructive actions.
* Keep labels visible; do not rely on placeholders as field labels.
* Provide clear validation and error states.
* Provide loading, empty and disabled states where relevant.
* Use icons only when they improve comprehension.
* Tooltips must supplement, not replace, important labels.

## Financial Data

* Financial figures should be easy to scan and compare.
* Use consistent Indian currency formatting.
* Align numerical values consistently in tables.
* Make Due, Drawn, Difference, Arrear and Recovery visually distinguishable without relying solely on colour.
* Important totals should have stronger hierarchy than supporting figures.
* Detailed calculations should remain accessible without overwhelming the default view.

## Accessibility

* Use semantic HTML wherever practical.
* Inputs must have associated labels.
* Buttons and interactive elements must be keyboard accessible.
* Maintain reasonable colour contrast.
* Do not communicate meaning using colour alone.
* Preserve visible focus states.
* Respect reduced-motion preferences where animation is used.

## Implementation Discipline

Before modifying UI:

1. inspect the existing component and layout conventions;
2. reuse existing reusable components where appropriate;
3. consider desktop and mobile behavior explicitly.

After modifying UI:

1. verify the page at narrow mobile width;
2. verify it at normal desktop width;
3. check for overflow, clipped text and overlapping controls;
4. verify touch interactions do not depend on hover;
5. verify forms and tables remain usable;
6. run the available build/lint checks.

Do not redesign unrelated parts of the application unless necessary for consistency.

When there is a choice between a visually impressive design and a simpler design that improves clarity, verification and usability, prefer clarity.
