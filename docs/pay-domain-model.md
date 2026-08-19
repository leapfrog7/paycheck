# PayCheck — Pay Domain Model

> **Status:** Foundational architecture specification
> **Purpose:** Defines how PayCheck represents pay, service events, rules, options, calculations, and arrear reconstruction.
> **Audience:** Developers, GitHub Copilot, future maintainers, and domain reviewers.
> **Important:** This document defines the domain model. It does **not** itself establish legal entitlement. Calculation rules must come from `docs/pay-rules.md`.

---

## 1. Product Principle

PayCheck is not merely a calculator that accepts a Basic Pay and returns an arrear amount.

It is intended to reconstruct an employee's pay history through deterministic, traceable rules.

For any relevant date, the application should be capable of answering:

1. What pay structure applied?
2. What was the employee's pay position in that structure?
3. What event changed that position?
4. Which rule caused the change?
5. Was any employee option involved?
6. What became the next Date of Increment (DNI)?
7. Was the effect notional, monetary, or both?
8. What was actually drawn?
9. What should have been drawn?
10. How did the difference arise month by month?

The core conceptual flow is:

```text
PAY STATE
   ↓
SERVICE / PAY EVENT
   ↓
APPLICABLE RULE
   ↓
OPTION / CONDITIONS
   ↓
STATE TRANSFORMATION
   ↓
NEW PAY STATE
   ↓
MONTH-WISE DUE PAY
   ↓
COMPARE WITH DRAWN PAY
   ↓
ARREAR / RECOVERY
```

The calculation engine must remain deterministic and independent of AI.

## Due Pay and Drawn Pay

PayCheck keeps calculated entitlement separate from payment history:

- **Due Pay** is deterministic, rule-derived legal entitlement. It is derived data and changes when an opening pay state, service event, or applicable pay/allowance rule changes.
- **Drawn Pay** is user-entered historical fact: the gross salary actually paid for a calendar month. It is case input data and does not change when Due Pay is replayed or recalculated.

A Drawn Pay value is not validated against the Pay Matrix, Grade Pay, fixation rules, allowance rates, or Due Pay. Historically incorrect payments must remain recordable. Drawn records may contain complete components, partial known components, or gross salary only. Missing amounts are represented by `null`; they are never converted to zero because a recorded `0` is a distinct historical fact.

Drawn Pay supports Basic Pay, DA, HRA, Transport Allowance, and arbitrary historically named other allowances. These labels need not match Due Pay custom-allowance definitions. Deductions remain outside this model's current scope.

## Due–Drawn comparison

Monthly comparison consumes the existing Due Pay ledger and Drawn Pay history without mutating or reconstructing either source:

```text
Due Pay − Drawn Pay = signed difference

positive difference = ARREAR
negative difference = RECOVERY
zero difference     = NIL
```

Gross comparison is authoritative when both final Gross Due and recorded Gross Drawn are known. A gross-only Drawn record can therefore produce a resolved gross comparison, but it cannot produce component differences. Complete or partial component records compare only the system components actually entered: Basic Pay, DA, HRA, and Transport Allowance. Missing components are not zero. Due custom allowances and Drawn other allowances remain separate lists and are not automatically matched.

Missing Drawn Pay is not the same as explicitly recorded zero Drawn Pay. A missing record makes the month unresolved; recorded zero participates in normal arithmetic.

An unresolved or partially resolved Due month cannot produce a final arrear or recovery. Its reasons and known components remain visible for audit, but no partial total is presented as a final monthly difference.

Case totals separately retain total arrear, total recovery, and their net signed difference. When any month is unresolved, aggregates include resolved months only and must be labelled as partial rather than final case totals. Drawn Pay remains immutable historical case input throughout comparison and Due recalculation.

Allowance-domain contracts, independent rule timelines, location state, eligibility state, and system/custom provenance are specified in [`allowance-model.md`](./allowance-model.md).

Custom Allowances are case-owned, user-defined financial rules rather than Government entitlement rules. A stable series identity groups effective-dated versions while stable definition identities preserve version provenance. Same-series overlap is invalid; separate series may coexist. Deactivation retains the definition instead of deleting its audit data, and optional references remain user-supplied metadata.

---

# 2. Core Domain Layers

PayCheck should be understood as five linked layers.

## 2.1 Pay Structure

Defines the set of legally valid pay positions under a particular pay regime.

Examples:

```text
5th CPC
Pay Scale → Valid Monetary Stages

6th CPC
Pay Band + Grade Pay + Pay in Pay Band

7th CPC
Pay Level + Cell
```

Pay Structure is rule/data, not employee history.

---

## 2.2 Pay State

Represents the employee's financial pay position at a specific point in time.

A Pay State is always effective from a date and remains effective until superseded by another event/state.

### Example — 5th CPC

```js
{
  cpc: 5,
  effectiveFrom: "2005-03-01",
  payScaleId: "S5_6500_200_10500",
  payScaleLabel: "₹6500–200–10500",
  stageIndex: 3,
  basicPay: 6900,
  dni: "2005-09-01"
}
```

### Example — 6th CPC

```js
{
  cpc: 6,
  effectiveFrom: "2014-01-01",
  payBandCode: "PB2",
  payBandMin: 9300,
  payBandMax: 34800,
  payInBand: 13500,
  gradePay: 4200,
  basicPay: 17700,
  dni: "2014-07-01"
}
```

### Example — 7th CPC

```js
{
  cpc: 7,
  effectiveFrom: "2020-01-01",
  level: "6",
  cellIndex: 7,
  basicPay: 42300,
  dni: "2020-07-01"
}
```

---

## 2.3 Service / Pay Event

An Event is something that can alter one or more legally relevant employee states.

Examples:

- Annual Increment
- Promotion
- Ad hoc Promotion
- Regularisation
- ACP
- MACP
- NFSG/NFS
- NFU
- CPC Transition
- Pay Correction
- Retrospective Promotion
- Penalty
- Leave Without Pay
- Transfer
- Retirement

An Event is not the same thing as a formula.

For example:

```text
Event = Regular Promotion
```

does not itself establish whether fixation is under:

- FR 22(I)(a)(1)
- FR 22(I)(a)(2)
- Rule 13 of CCS (RP) Rules, 2016
- a cadre-specific rule
- a special order

The applicable rule must be resolved separately.

---

## 2.4 Rule

A Rule defines the legal/calculation transformation that applies to an Event under specified conditions.

Examples:

```text
5CPC_ANNUAL_INCREMENT
6CPC_ANNUAL_INCREMENT
7CPC_ANNUAL_INCREMENT
5CPC_TO_6CPC_TRANSITION
6CPC_TO_7CPC_TRANSITION
FR22_I_A_1_6CPC_PROMOTION
RULE13_7CPC_PROMOTION
MACP_6CPC
MACP_7CPC
CSS_SO_NFS
```

Rules should be defined in a registry and not embedded inside React components.

---

## 2.5 Calculation Option / Decision

Some events allow the employee to choose how fixation is effected.

Example:

```text
Promotion under an applicable FR 22(I)(a)(1) case:

Option A — fixation from date of promotion
Option B — fixation from Date of Next Increment in lower post
```

Such options must be stored as historical data because they can materially affect subsequent pay progression.

---

# 3. Pay Structure Definitions

## 3.1 Fifth CPC

The 5th CPC uses prescribed pay scales containing valid monetary stages.

Example:

```text
6500-200-10500
```

Meaning:

```text
6500
6700
6900
7100
...
10500
```

Some scales may have more than one increment segment.

Example pattern:

```text
3050-75-3950-80-4590
```

This must be represented as generated valid stages, not an unrestricted number field.

### UI invariant

When a user selects a 5th CPC pay scale:

```text
Pay Scale
   ↓
Populate only valid Basic Pay stages
   ↓
User selects one stage
```

A calculated 5th CPC Basic Pay must never be a random number outside the selected scale unless the user is entering historical **Drawn Pay**.

### Implemented foundation and data boundary

A 5th CPC pay position is jointly identified by stable `payScaleId` and one-based `stageIndex`; `basicPay` must equal that stage's prescribed value. The opening UI therefore selects a verified scale and then a stage, and does not expose unrestricted Basic Pay entry.

The scale schema supports explicitly encoded stage sequences, multiple increment sections, and guarded Efficiency Bar transitions. A transition marked as requiring Efficiency Bar clearance is not crossed by the ordinary increment engine; it remains unresolved until a separate verified clearance rule/decision exists.

The controlled static dataset contains the 34 supplied standard S-series scales, with canonical IDs `S5_S1` through `S5_S34`. The former IDs `S5_3050_75_3950_80_4590` and `S5_6500_200_10500` resolve to `S5_S5` and `S5_S12` so persisted cases remain compatible.

Each scale retains its standard code, monetary notation, minimum, maximum, explicit increment sections, generated valid stages, fixed-scale flag, and verified source-family metadata. S-16, S-33, and S-34 are one-stage fixed scales. No supplied monetary scale establishes an Efficiency Bar, so none is inferred. Non-standard, intermediate, or special scales remain unsupported until separately verified.

---

## 3.2 Sixth CPC

The principal 6th CPC structure is:

```text
Pay Band + Grade Pay
```

The employee's Basic Pay for relevant calculations is:

```text
Basic Pay = Pay in Pay Band + Grade Pay
```

PayCheck must store the components separately.

Do not store only:

```js
{ basicPay: 17700 }
```

Prefer:

```js
{
  payBandCode: "PB2",
  payInBand: 13500,
  gradePay: 4200,
  basicPay: 17700
}
```

This is necessary because later fixation can alter Pay in Pay Band and Grade Pay differently.

---

## 3.3 Seventh CPC

The 7th CPC uses the Pay Matrix.

A pay position is:

```text
Level + Cell
```

Example:

```js
{
  level: "7",
  cellIndex: 6,
  basicPay: 52000
}
```

### UI invariant

A calculated 7th CPC Basic Pay must be an actual Cell value in the applicable Level.

The UI should preferably select:

```text
Level
   ↓
Basic Pay / Cell
```

rather than accept unrestricted Basic Pay input.

---

# 4. Employee Financial State

A Pay State alone will eventually be insufficient.

The engine may need a broader Employee Financial State:

```js
{
  effectiveFrom: "2020-06-01",

  pay: {
    cpc: 7,
    level: "7",
    cellIndex: 1,
    basicPay: 44900
  },

  career: {
    substantivePostId: null,
    currentPostId: null,
    appointmentNature: "REGULAR",
    financialUpgradationHistory: []
  },

  increment: {
    dni: "2021-01-01",
    dniBasis: "POST_PROMOTION",
    withheld: false
  },

  location: {
    cityCode: null,
    hraClass: "X"
  },

  accommodation: {
    governmentAccommodation: false
  },

  serviceStatus: {
    active: true,
    suspended: false,
    nonQualifyingService: false
  }
}
```

Not every field needs to be implemented in the MVP.

The schema should nevertheless permit later extension.

---

# 5. Date Concepts

Government pay cases frequently contain several different dates.

They must not be collapsed into one generic `date`.

## 5.1 Effective Date

The date from which an event legally operates.

```js
effectiveDate
```

---

## 5.2 Order Date

The date on which the administrative order was issued.

```js
orderDate
```

A retrospective event can have:

```text
Effective Date: 01.06.2014
Order Date:     15.03.2026
```

---

## 5.3 Fixation Date

The date from which the employee's pay is actually fixed under the selected option/rule.

```js
fixationDate
```

This can differ from the event effective date.

---

## 5.4 Monetary Benefit From

The date from which actual financial payment/recovery becomes admissible.

```js
monetaryBenefitFrom
```

Example:

```text
Promotion notionally effective: 01.01.2014
Actual monetary benefit from:   01.01.2018
```

---

## 5.5 Statutory CPC Effective Date

The date from which a Pay Commission's revised structure takes effect generally.

Example:

```js
statutoryEffectiveDate: "2016-01-01"
```

---

## 5.6 Employee CPC Switch Date

The date from which the employee actually comes over to the revised pay structure under the applicable option.

```js
employeeSwitchDate
```

Never assume:

```text
CPC Effective Date = Employee Switch Date
```

The three dates remain independent domain facts:

```text
STATUTORY_EFFECTIVE_DATE != EMPLOYEE_SWITCH_DATE != ORDER_DATE
```

A delayed CPC switch retains the old CPC as the employee's legal Pay State until the confirmed switch trigger/date, then transforms the actual replayed old-CPC state. It is distinct from notional fixation in the revised structure with monetary benefit deferred; the latter changes the legal/notional Pay State earlier and only delays payment.

## User-confirmed pay corrections

PayCheck distinguishes three sources of financial fact:

```text
NORMAL RULE-DERIVED PAY STATE   → SYSTEM_DERIVED
USER-CONFIRMED CORRECTED STATE → USER_CONFIRMED
HISTORICAL DRAWN PAY           → USER_ENTERED_HISTORICAL
```

`PAY_REFIXATION` is the canonical state-replacement event. From its `effectiveDate`, `correctedPayState` replaces—not derives from—the active Pay State, and ordinary downstream events replay from that new state. `STRUCTURED_CORRECTION` must satisfy the existing validator for its CPC. `MANUAL_HISTORICAL_STATE` accepts a sane, non-negative confirmed value even where it is off-stage, off-matrix, or otherwise non-standard; it is marked `NON_STANDARD_CONFIRMED` and is never silently snapped or repaired. A later structured refixation can normalize the state and restore ordinary calculations.

Every refixation retains immutable `before` and `after` states, a structured changed-field diff, `USER_CONFIRMED` provenance, user-supplied reason/reference/note metadata, and advisory warnings. Missing reference and departure from rule-derived structure are warnings rather than legal adjudications. A correction changes the Due Pay trajectory; an incorrect amount actually paid belongs in Drawn Pay instead.

`DNI_ADJUSTMENT` replaces DNI alone. Its resolved DNI decision has `sourceType: USER_CONFIRMED`, no Government rule ID, and the correction event identity. Basic Pay and all CPC structural fields remain unchanged until another legal event transforms them.

`NOTIONAL_REFIXATION` is a state replacement with distinct `effectiveDate` and `monetaryBenefitFrom`. The corrected state is active for Pay History and downstream fixation from the first date. Financial segments before the second date are `NOTIONAL_ONLY` and do not emit Gross Due or arrears; monetary Due begins at the separate boundary. Drawn Pay remains immutable.

Same-date correction ordering is explicit. `correctionBasis: BEFORE_EVENT` or `AFTER_EVENT` must reference `relatedEventId`; otherwise a materially interacting event returns `SAME_DATE_CORRECTION_ORDER_UNRESOLVED`. A successful refixation also establishes a certainty boundary: earlier unresolved history remains visible before it, while supported later rules can resolve from the confirmed replacement state.

## Full-month and controlled partial-month entitlement

Full-month entitlement remains the ordinary output of the existing Pay State and allowance engines. Partial-month monetary entitlement is a separate composition layer:

```text
Pay History
→ clipped financial segment
→ full monthly component entitlement
→ component proration decision
→ raw segment amount
→ explicit rounding decision when required
→ final segment amount
→ monthly aggregation
```

Proration decisions are case input/rule data, not Pay State and not calculated Due. They retain stable identity, scope, method, source, reference, note, authority date, warnings, eligible days, divisor/factor, raw amount, rounding, and final amount. A user-confirmed decision remains `USER_CONFIRMED`; a future verified selector can use `SYSTEM_RULE` with a rule ID without changing the model.

Decision precedence is deterministic: an explicit component/segment/month decision overrides a month policy, which overrides the case policy; future verified system decisions are fallback rule data. Components are independent: Basic Pay, DA, HRA, final Transport Allowance including DA-on-TA, and each custom allowance may resolve, remain non-payable, or remain unresolved separately. Missing input produces `PRORATION_BASIS_NOT_CONFIRMED`, never zero.

Supported explicit methods are `CALENDAR_DAYS_IN_MONTH`, `FIXED_30_DAY_DIVISOR`, `MANUAL_FACTOR`, `MANUAL_SEGMENT_AMOUNT`, and `NO_PRORATION_FULL_AMOUNT`. Their availability does not make any method legally automatic. Non-integral raw values require an explicit rounding decision such as nearest rupee, the confirmed 50-paise convention, floor rupee, or manual final amount. No rounding method is universal in this phase.

---

# 6. DNI as First-Class State

Date of Next Increment must not be treated merely as a UI field.

It is:

- initially entered or derived;
- modified by events;
- used by later events;
- part of the calculation audit trail.

Recommended structure:

```js
{
  date: "2021-01-01",
  basis: "POST_PROMOTION_RULE",
  derivedFromEventId: "evt_123",
  status: "DERIVED"
}
```

Events that may affect DNI include:

- appointment;
- promotion;
- MACP;
- fixation option;
- non-qualifying service;
- withholding of increment;
- penalty;
- special rule/clarification.

---

# 7. Event Vocabulary

Events should be grouped by domain meaning.

---

## 7.1 Entry Events

### INITIAL_APPOINTMENT

Creates an opening pay state.

```js
{
  type: "INITIAL_APPOINTMENT",
  effectiveDate,
  appointmentType,
  postId,
  payStructure,
  initialPay,
  ruleId
}
```

Potential appointment types:

```text
DIRECT_RECRUITMENT
ABSORPTION
REEMPLOYMENT
TRANSFER_APPOINTMENT
OTHER
```

Do not assume the same fixation logic for all appointment types.

---

# 8. Progression Events

## 8.1 ANNUAL_INCREMENT

```js
{
  type: "ANNUAL_INCREMENT",
  effectiveDate,
  generatedAutomatically: true,
  qualifyingServiceSatisfied: true,
  granted: true,
  ruleId
}
```

Rule implementation differs by CPC.

### 5th CPC

```text
Current valid stage → next valid stage
```

### 6th CPC

Rule-specific percentage increment applied under the 6th CPC methodology.

### 7th CPC

```text
Current Cell → next vertical Cell in same Level
```

---

## 8.2 STAGNATION_INCREMENT

```js
{
  type: "STAGNATION_INCREMENT",
  effectiveDate,
  incrementNumber,
  ruleId,
  sourceOrder
}
```

Recognize in schema even if initially unsupported.

---

## 8.3 ADVANCE_INCREMENT

```js
{
  type: "ADVANCE_INCREMENT",
  effectiveDate,
  numberOfIncrements,
  reason,
  ruleId,
  affectsDni
}
```

Advance increments must not automatically inherit promotion fixation options.

---

# 9. Career Advancement Events

## 9.1 REGULAR_PROMOTION

```js
{
  type: "REGULAR_PROMOTION",

  effectiveDate,
  orderDate,
  assumptionOfChargeDate,
  monetaryBenefitFrom,

  fromPostId,
  toPostId,

  fromPayStructure,
  targetPayStructure,

  ruleId,

  fixationOption: {
    permitted: true,
    selected: "FROM_EVENT_DATE"
  },

  sourceOrder
}
```

Possible option selections:

```text
FROM_EVENT_DATE
FROM_LOWER_POST_DNI
NOT_APPLICABLE
UNRESOLVED
```

Do not equate `REGULAR_PROMOTION` with one universal formula.

---

## 9.2 AD_HOC_PROMOTION

```js
{
  type: "AD_HOC_PROMOTION",

  effectiveDate,
  orderDate,

  fromPostId,
  toPostId,

  targetPayStructure,
  ruleId,

  sourceOrder
}
```

Ad hoc promotion must never be silently converted into regular promotion.

---

## 9.3 REGULARISATION

Links a later regular appointment/promotion to an earlier ad hoc event.

```js
{
  type: "REGULARISATION",

  effectiveDate,
  orderDate,

  relatesToEventId: "evt_adhoc_123",

  regularisationDate,
  deemedRegularFrom,
  continuousWithoutBreak,

  fixationOptionAvailable: null,

  ruleId,
  sourceOrder
}
```

`null` means unresolved, not false.

The exact effect of ad hoc service followed by regular promotion must be determined from the applicable rule/order.

---

## 9.4 OFFICIATING_APPOINTMENT

Reserved event type for cases where officiating appointment has distinct pay consequences.

```js
{
  type: "OFFICIATING_APPOINTMENT",
  effectiveDate,
  endDate,
  targetPostId,
  targetPayStructure,
  ruleId
}
```

---

# 10. Financial Upgradation Events

## 10.1 ACP

```js
{
  type: "ACP",
  effectiveDate,
  upgradationNumber,
  fromPayStructure,
  targetPayStructure,
  governingSchemeId,
  ruleId,
  sourceOrder
}
```

ACP and MACP must remain distinct.

---

## 10.2 MACP

```js
{
  type: "MACP",

  effectiveDate,
  orderDate,
  monetaryBenefitFrom,

  macpNumber,

  fromPayStructure,
  targetPayStructure,

  governingSchemeId: "MACPS",

  ruleId,

  fixationOption: {
    permitted: true,
    selected: "FROM_EVENT_DATE"
  },

  sourceOrder
}
```

### Critical semantic distinction

MACP is a financial upgradation.

It is **not** regular promotion.

Therefore the event history must preserve:

```text
Reached Level/Grade through MACP
```

because a later regular promotion to the same financial Level/Grade may not produce a fresh fixation benefit under the applicable rules.

---

## 10.3 NON_FUNCTIONAL_UPGRADATION

Generic parent event for schemes such as NFSG/NFS/NFU.

```js
{
  type: "NON_FUNCTIONAL_UPGRADATION",

  subtype: "NFSG",

  schemeCode,
  effectiveDate,

  fromPayStructure,
  targetPayStructure,

  ruleId,
  sourceOrder
}
```

Possible subtypes:

```text
NFSG
NFS
NFU
OTHER
```

### Critical invariant

There must not be one universal `calculateNFSG()` rule.

The scheme/cadre must be identified before automatic fixation.

---

# 11. Structural Pay Events

## 11.1 CPC_TRANSITION

```js
{
  type: "CPC_TRANSITION",

  fromCpc: 6,
  toCpc: 7,

  statutoryEffectiveDate: "2016-01-01",
  employeeSwitchDate: "2016-01-01",

  optionExercised: null,

  ruleId: "6CPC_TO_7CPC",

  sourceOrder
}
```

The ordinary 5th→6th transition is a distinct `CPC_TRANSITION` transformation under the CCS (Revised Pay) Rules, 2008. For a supported generic S-series replacement on 01 January 2006 it consumes the validated 5th CPC scale/stage state, applies factor 1.86, rounds upward to the next ₹10 under the dedicated Rule-7 helper, applies the mapped Pay Band minimum, and then adds Grade Pay. It emits a normal 6th CPC Pay Band + Grade Pay state; it does not calculate allowances.

The generic scale mapping is independent controlled data. S-4 through S-29 are supported, with generic S-12 explicitly mapping to PB-2 + GP ₹4200. S-1–S-3, S-30, and S-31–S-34 retain explicit unsupported high/special-structure reasons and never fall back to another mapping.

Bunching is recorded as not evaluated, and post-transition DNI is unresolved. Delayed switching, upgraded/merged scales, post-specific Grade Pay, -1S, HAG+, Apex, and Cabinet Secretary structures require later rules; a failed transition does not mutate the active Pay State.

---

## 11.2 STRUCTURAL_PAY_REVISION

Used where Government revises/merges/upgrades a pay structure without this being a personal promotion.

```js
{
  type: "STRUCTURAL_PAY_REVISION",

  effectiveDate,

  reason: "SCALE_MERGER",

  fromPayStructure,
  targetPayStructure,

  ruleId,
  sourceOrder
}
```

Possible reasons:

```text
SCALE_MERGER
GRADE_PAY_UPGRADE
LEVEL_REVISION
REPLACEMENT_SCALE
SPECIAL_REVISION
```

This avoids recording structural CPC changes as career promotions.

---

# 12. Correction and Retrospective Events

## 12.1 PAY_CORRECTION

```js
{
  type: "PAY_CORRECTION",

  effectiveDate,
  discoveredDate,
  orderDate,

  fieldCorrected: "basicPay",

  previousValue,
  correctedValue,

  reason: "WRONG_FIXATION",

  sourceOrder
}
```

### Critical engine behavior

A historical correction invalidates downstream derived states.

The engine should:

```text
Apply corrected historical fact
        ↓
Invalidate subsequent derived states
        ↓
Replay all later events chronologically
        ↓
Generate corrected Due Pay history
```

Never manually patch all later Basic Pay values.

---

## 12.2 RETROSPECTIVE_PROMOTION

```js
{
  type: "RETROSPECTIVE_PROMOTION",

  effectiveDate,
  orderDate,
  fixationDate,
  monetaryBenefitFrom,

  fromPostId,
  toPostId,

  targetPayStructure,
  ruleId,
  fixationOption,

  notionalPeriod: {
    from,
    to
  },

  sourceOrder
}
```

---

## 12.3 NOTIONAL_FIXATION

```js
{
  type: "NOTIONAL_FIXATION",

  effectiveDate,

  monetaryBenefit: false,

  reason,
  ruleId,
  sourceOrder
}
```

Notional progression must still affect later actual pay where the rules require it.

---

## 12.4 STEPPING_UP

```js
{
  type: "STEPPING_UP",

  effectiveDate,

  comparisonEmployeeReference,
  previousBasicPay,
  revisedBasicPay,

  ruleId,
  sourceOrder
}
```

Stepping-up should be an auditable event, not a silent manual override.

---

## 12.5 PAY_PROTECTION

```js
{
  type: "PAY_PROTECTION",

  effectiveDate,
  protectedPay,
  reason,
  ruleId,
  sourceOrder
}
```

---

# 13. Adverse Pay Events

## 13.1 PENALTY_REDUCTION

```js
{
  type: "PENALTY_REDUCTION",

  effectiveFrom,
  effectiveTo,

  reductionMode,
  originalPay,
  reducedPay,

  cumulativeEffect,
  affectsFutureIncrements,

  ruleId,
  sourceOrder
}
```

A reduction penalty must retain enough information to determine restoration and downstream progression.

---

## 13.2 WITHHELD_INCREMENT

```js
{
  type: "WITHHELD_INCREMENT",

  dueDate,
  withholdingPeriod,

  cumulativeEffect,
  restorationDate,

  ruleId,
  sourceOrder
}
```

---

# 14. Service Status Events

## 14.1 NON_QUALIFYING_SERVICE

```js
{
  type: "NON_QUALIFYING_SERVICE",

  subtype: "EOL",

  startDate,
  endDate,

  countsForIncrement,
  countsForFinancialUpgradation,

  ruleId,
  sourceOrder
}
```

---

## 14.2 SUSPENSION

```js
{
  type: "SUSPENSION",

  startDate,
  endDate,

  treatmentOnFinalisation,
  qualifyingServiceTreatment,

  ruleId,
  sourceOrder
}
```

Suspension calculation should initially be treated as an advanced/unsupported domain unless explicitly implemented.

---

## 14.3 BREAK_IN_SERVICE

```js
{
  type: "BREAK_IN_SERVICE",

  startDate,
  endDate,

  condoned,

  effectOnIncrement,
  effectOnFinancialUpgradation,

  ruleId,
  sourceOrder
}
```

---

# 15. Allowance / Location Events

Not every event changes Basic Pay.

## 15.1 TRANSFER

```js
{
  type: "TRANSFER",

  effectiveDate,

  fromLocation,
  toLocation,

  affects: [
    "HRA",
    "TRANSPORT_ALLOWANCE"
  ]
}
```

---

## 15.2 HRA_CLASS_CHANGE

```js
{
  type: "HRA_CLASS_CHANGE",
  effectiveDate,
  fromClass,
  toClass,
  ruleId
}
```

---

## 15.3 GOVERNMENT_ACCOMMODATION

```js
{
  type: "GOVERNMENT_ACCOMMODATION",
  action: "START",
  effectiveDate,
  ruleId
}
```

Actions:

```text
START
END
```

---

## 15.4 CUSTOM_ALLOWANCE

```js
{
  type: "CUSTOM_ALLOWANCE",
  action: "START",
  effectiveDate,
  endDate,
  allowanceDefinition
}
```

---

# 16. Terminal Events

## 16.1 RETIREMENT

```js
{
  type: "RETIREMENT",
  effectiveDate,
  retirementType
}
```

This event ends ordinary salary progression but can become the anchor for retirement-benefit calculators.

---

## 16.2 DEATH_IN_SERVICE

Reserved for later family pension / death benefit calculations.

---

# 17. Event Effects Are Multidimensional

An Event may affect:

```js
effects: {
  career: false,
  basicPay: false,
  payStructure: false,
  dni: false,
  allowances: false,
  location: false,
  serviceStatus: false,
  qualifyingService: false
}
```

Examples:

### MACP

```js
effects: {
  career: false,
  basicPay: true,
  payStructure: true,
  dni: true
}
```

### Regular Promotion after equivalent MACP benefit

```js
effects: {
  career: true,
  basicPay: false,
  payStructure: false,
  dni: false
}
```

### Transfer

```js
effects: {
  career: false,
  basicPay: false,
  allowances: true,
  location: true
}
```

This distinction is critical.

---

# 18. Event Relationships

Events need stable IDs because later events can depend on earlier events.

Examples:

```text
AD_HOC_PROMOTION evt_100
           ↑
           │
REGULARISATION evt_150
relatesToEventId = evt_100
```

and:

```text
MACP evt_200
     ↑
     │
REGULAR_PROMOTION evt_250
checks financial benefit already granted
```

Recommended structure:

```js
relations: {
  relatesToEventIds: [],
  supersedesEventId: null,
  derivedFromEventId: null
}
```

---

# 19. Event Interaction Rules

A later event can exist but have its financial effect suppressed.

Example:

```text
MACP → employee reaches Level 7 with fixation benefit
later Regular Promotion → same Level 7
```

Possible result:

```js
{
  careerEffect: "PROMOTED",
  payFixationEffect: "NO_FRESH_FIXATION",
  reason: "TARGET_STRUCTURE_ALREADY_GRANTED_THROUGH_MACP",
  matchedMacpEventId: "evt_200",
  dniEffect: "NONE"
}
```

Do not delete or hide the regular promotion.

Career effect and financial effect are separate.

The interaction must be resolved from prior event/transformation provenance,
not merely from current Basic Pay or a transient `reachedBy` field. Only MACP
events effective before the promotion may be considered. Where the earlier MACP
belongs to another CPC and no explicit equivalence link exists, the result must
remain unresolved.

---

# 20. Fixation Option Model

Recommended canonical structure:

```js
fixationOption: {
  permitted: true,

  authorityRuleId: "FR22_I_A_1",

  choices: [
    "FROM_EVENT_DATE",
    "FROM_LOWER_POST_DNI"
  ],

  selected: "FROM_LOWER_POST_DNI",

  relevantDni: "2014-07-01",

  exercisedOn: "2014-06-15",

  originalSelection: null,

  revised: false,

  revisionAuthority: null,

  status: "CONFIRMED"
}
```

Options must be historized because later Government orders may permit revision/re-exercise in some cases.

---

# 21. Interim Pay States

An Event may produce more than one state.

Example:

```text
Promotion effective 01 June
Employee opts for final fixation from 01 July DNI
```

The engine may need:

```text
State A — before promotion
   ↓
State A1 — interim promotional treatment
   ↓
State B — final fixation from DNI
```

Therefore an event processor must be capable of returning multiple dated state transitions.

---

# 22. Same-Date Event Ordering

Two events can occur on the same date.

Example:

```text
01.07.2014
Annual Increment
+
Promotion fixation from lower-post DNI
```

Sequence matters.

The engine must not rely merely on insertion order or timestamp sorting.

Rule definitions should be able to specify prerequisites or processing order.

Example:

```js
{
  eventId: "promotion_123",
  requiresSameDateProcessingAfter: [
    "ANNUAL_INCREMENT"
  ]
}
```

The exact universal same-day precedence order should not be hard-coded until verified.

---

# 23. Due Pay vs Drawn Pay

These are separate histories.

## 23.1 Due Pay

The pay legally/calculatively due according to the corrected Pay State and verified rules.

Due Pay must obey structural validation.

Examples:

- 5th CPC Basic must be a valid scale stage.
- 7th CPC Basic must be a valid Matrix Cell.

---

## 23.2 Drawn Pay

The pay actually drawn historically.

Drawn Pay is evidence, not a legal conclusion.

It may contain values that are not legally valid.

Example:

```text
Applicable Level 6 has no Basic Pay of ₹43,000
but payroll actually paid ₹43,000.
```

The application must permit:

```js
drawnBasicPay: 43000
```

because the purpose is to measure the error.

Never validate Drawn Pay against the Due Pay structure in a way that prevents historical entry.

---

# 24. Month-Wise Due–Drawn Model

Each month should eventually support:

```js
{
  month: "2020-06",

  due: {
    basicPay,
    da,
    hra,
    transportAllowance,
    otherAllowances,
    gross
  },

  drawn: {
    basicPay,
    da,
    hra,
    transportAllowance,
    otherAllowances,
    gross
  },

  difference: {
    basicPay,
    da,
    hra,
    transportAllowance,
    otherAllowances,
    gross
  }
}
```

Monthly difference:

```text
Due - Drawn
```

Positive result:

```text
Arrear
```

Negative result:

```text
Recovery
```

---

# 25. Event Replay

Event replay is the core of retrospective recalculation.

Example original history:

```text
2005 Opening Basic
↓
2005 Increment
↓
2006 CPC Transition
↓
2006 Increment
↓
Promotion
↓
MACP
↓
2016 CPC Transition
↓
7th CPC increments
↓
Retirement
```

A correction to the 2005 Basic must trigger:

```text
Correct historical state
        ↓
Invalidate downstream derived states
        ↓
Replay every later event
        ↓
Recalculate CPC transitions
        ↓
Recalculate increments
        ↓
Recalculate promotion/MACP consequences
        ↓
Generate corrected Due Pay
```

No manual cascading edits.

---

# 26. Hypothetical Branches

The engine should eventually support alternative legal calculation branches.

Example:

```text
Promotion Option A
Fixation from promotion date

Promotion Option B
Fixation from lower-post DNI
```

Both can be calculated independently and compared.

Possible output:

```text
Option A:
Final Basic = ₹X
Gross Arrear = ₹Y

Option B:
Final Basic = ₹X2
Gross Arrear = ₹Y2
```

The application should state the computed consequence, not automatically advise legal entitlement to exercise an option.

---

# 27. Data Provenance

Important data should carry provenance.

Recommended statuses:

```text
CONFIRMED
DERIVED
ASSUMED
UNRESOLVED
```

## CONFIRMED

Entered by the user or supported by an order/document.

## DERIVED

Calculated deterministically from confirmed facts.

## ASSUMED

Used to allow an estimate where information is incomplete.

## UNRESOLVED

The application cannot safely determine the applicable legal/calculation treatment.

Example:

```js
{
  value: "2014-07-01",
  status: "DERIVED",
  sourceEventId: "evt_123",
  ruleId: "..."
}
```

---

# 28. Manual Corrections Must Be Auditable

Avoid generic silent overrides.

If a user changes a calculated value, create an auditable correction:

```js
{
  type: "MANUAL_PAY_CORRECTION",
  effectiveDate,
  previousCalculatedValue,
  replacementValue,
  reason,
  note,
  status: "CONFIRMED"
}
```

The original derived result must remain traceable.

---

# 29. Rule Registry

Rules should be registered as data/configuration plus deterministic calculation code.

Suggested metadata:

```js
{
  id: "7CPC_RULE13_PROMOTION",

  title: "Fixation on Promotion",

  authority: {
    department: "Department of Expenditure",
    instrument: "CCS (Revised Pay) Rules, 2016",
    rule: "Rule 13"
  },

  effectiveFrom: "2016-01-01",
  effectiveTo: null,

  implementationStatus: "VERIFIED",

  sourceReferences: [],

  logicVersion: 1
}
```

---

# 30. Rule Implementation Status

Every rule should have one of these statuses.

## VERIFIED

Primary authority identified and algorithm sufficiently specified for implementation/testing.

## PROVISIONAL

Rule/event understood conceptually but edge cases or source interpretation still require validation.

## UNSUPPORTED

Event is recognized by the domain model, but PayCheck must not calculate it automatically.

### Invariant

Copilot must never invent calculation logic for `PROVISIONAL` or `UNSUPPORTED` rules.

---

# 31. Rule Versioning

Rules and clarifications change over time.

A rule should support:

```js
{
  ruleId: "MACP_FIXATION",
  version: "2020-09-08",
  effectiveFrom,
  effectiveTo
}
```

Rule version and applicability date are separate from the employee's event date.

---

# 32. Transformation Record

Every automatic calculation should produce a Transformation Record.

Example:

```js
{
  eventId: "evt_123",
  ruleId: "7CPC_RULE13_PROMOTION",

  before: {
    level: "6",
    cellIndex: 6,
    basicPay: 41100
  },

  steps: [
    {
      operation: "LOWER_LEVEL_INCREMENT",
      from: 41100,
      to: 42300
    },
    {
      operation: "TARGET_LEVEL_LOOKUP",
      targetLevel: "7",
      referenceAmount: 42300,
      matchedCell: 44900
    }
  ],

  after: {
    level: "7",
    cellIndex: 1,
    basicPay: 44900
  },

  explanation:
    "One increment was granted in the lower Level and pay was placed at the equal or next higher Cell in the promoted Level."
}
```

Transformation Records should power:

- result explanation;
- audit trail;
- PDF report;
- debugging;
- unit tests;
- due–drawn statement explanation.

## 32.1 Basic Pay history ledger

Basic Pay history is derived in four separate stages:

```text
Pay State
  → Transformation Record
  → Pay History Segment
  → Monthly Pay Period
```

- A **Pay State** is the legal financial position at a point in the event replay.
- A **Transformation Record** explains which event and rule produced the next state.
- A **Pay History Segment** applies one replayed state over an inclusive calendar-date range. A mid-month transformation starts a new segment on its actual financial effective date.
- A **Monthly Pay Period** is the intersection of those segments with one calendar month and the Pay Case boundaries.

The history ledger consumes the chronological event replay; it does not recalculate increments, promotions, MACP, or CPC transitions. Multiple same-date events therefore use replay order and produce only the final successful financial state for that date. A successful career event with no fresh pay fixation remains visible in period provenance without creating a false pay-change segment.

Unresolved transformations never invent a replacement Pay State. The last known state continues with `PARTIALLY_RESOLVED` status and the unresolved event identifiers needed for audit. If an event has no placeable financial effective date, history generation itself is `UNRESOLVED`.

Each segment retains compact provenance references to the opening state, latest applied event, rule, and transformation. Full calculation steps remain in the replay Transformation Record instead of being duplicated in every month.

This ledger records Basic Pay applicability only. Segment dates do not imply proportionate salary and no allowance, deduction, due/drawn, arrear, or recovery arithmetic belongs in this layer.

---

# 33. Canonical Event Schema

Recommended generic event shape:

```js
{
  id: "evt_...",

  type: "REGULAR_PROMOTION",
  subtype: null,

  effectiveDate: "2020-06-01",
  orderDate: "2020-05-20",
  fixationDate: null,
  monetaryBenefitFrom: "2020-06-01",

  status: "CONFIRMED",

  from: {
    postId: null,
    payStructure: {}
  },

  to: {
    postId: null,
    payStructure: {}
  },

  rule: {
    id: "FR22_I_A_1_7CPC",
    status: "VERIFIED"
  },

  fixationOption: {
    permitted: true,
    selected: "FROM_LOWER_POST_DNI",
    relevantDni: "2020-07-01"
  },

  relations: {
    relatesToEventIds: [],
    supersedesEventId: null,
    derivedFromEventId: null
  },

  effects: {
    career: true,
    basicPay: true,
    payStructure: true,
    dni: true,
    allowances: false,
    location: false,
    serviceStatus: false,
    qualifyingService: false
  },

  source: {
    type: "USER_ENTRY",
    orderReference: null
  },

  notes: null
}
```

Not every event will use every field.

---

# 34. Suggested Case Schema

Conceptual structure:

```js
{
  case: {
    id,
    title,
    employeeName,
    calculationStartDate,
    calculationEndDate,
    createdAt,
    updatedAt
  },

  openingState: {},

  dueTimeline: {
    events: []
  },

  drawnTimeline: {
    entries: []
  },

  assumptions: [],

  unresolvedIssues: [],

  transformationRecords: [],

  result: {
    monthlyRows: [],
    totals: {}
  }
}
```

---

# 35. Domain Invariants

These are mandatory architectural rules.

1. A calculated 5th CPC Basic Pay must be a valid stage in the applicable pay scale.
2. A calculated 7th CPC Basic Pay must be a valid Cell in the applicable Level.
3. A 6th CPC Grade Pay must be valid for the relevant pay structure/date.
4. 6th CPC Pay in Pay Band and Grade Pay must be stored separately.
5. Derived pay values must not be silently overwritten.
6. Every pay-changing transformation must identify the rule that produced it.
7. Every derived Pay State must retain its source event.
8. DNI is first-class state and can change after events.
9. A historical correction must replay all subsequent derived events.
10. Drawn Pay records historical fact and need not be structurally valid.
11. Notional progression must be capable of continuing even where monetary benefit is restricted.
12. MACP and regular promotion are different events even when numerical fixation appears similar.
13. The engine must check relevant earlier financial upgradations before granting another fixation benefit.
14. NFSG/NFS/NFU must be scheme-specific.
15. Ad hoc promotion and regular promotion must never be silently merged.
16. Unknown legal treatment must produce `UNRESOLVED`, not an invented assumption.
17. CPC statutory effective date and employee switch date are different concepts.
18. Effective date, fixation date, order date and monetary-benefit date may differ.
19. Same-date events must be processed in the legally required sequence.
20. Every assumption used in a calculation must be visible to the user.
21. Every final amount must be reproducible from saved case data.
22. Calculation logic must not live inside React UI components.
23. Rate/rule tables must not be hard-coded inside UI components.
24. AI must never generate authoritative calculation values.
25. `PROVISIONAL` and `UNSUPPORTED` rules must not be auto-calculated.

---

# 36. Initial Rule Support Boundary

The domain model is intentionally broader than the MVP.

## Target for early verified automation

- 5th CPC valid pay-scale stages
- 5th CPC annual increment
- 5th → 6th CPC transition
- 6th CPC annual increment
- verified 6th CPC promotion fixation cases
- verified 6th CPC MACP fixation cases
- 6th → 7th CPC transition
- 7th CPC annual increment
- verified 7th CPC promotion fixation cases
- verified 7th CPC MACP fixation cases
- pay correction
- notional progression
- due–drawn comparison

## Recognize but do not initially automate without verified rules

- ad hoc → regular retrospective fixation
- ACP
- cadre-specific NFSG/NFS/NFU
- stepping-up
- complex pay protection
- penalty reductions
- withholding with cumulative effects
- suspension
- complex EOL/non-qualifying service consequences

---

# 37. Simple Mode vs Advanced Mode

The complexity in this document is an internal model.

Ordinary users should not be required to understand it.

### Simple Mode example

```text
What happened to your pay?

[ Increment ]
[ Promotion ]
[ MACP ]
[ Pay correction ]
[ Pay Commission change ]
[ Something else ]
```

The application should ask only rule-relevant questions.

### Advanced Mode

May expose:

- pay scale / Pay Band / Grade Pay / Level / Cell;
- FR 22 fixation rule;
- DNI;
- event timeline;
- calculation steps;
- source authority;
- manual correction;
- drawn-pay rows.

The same domain engine must power both modes.

---

# 38. Architectural Summary

PayCheck should ultimately operate as:

```text
                    ┌────────────────────┐
                    │    RULE REGISTRY   │
                    │ CPC / FR / MACP... │
                    └─────────┬──────────┘
                              │
                              ▼
┌─────────────────┐    ┌─────────────────┐
│ OPENING PAY     │───▶│  EVENT ENGINE   │
│ STATE           │    └────────┬────────┘
└─────────────────┘             │
                                ▼
                        ┌─────────────────┐
                        │ NEW PAY STATE   │
                        └────────┬────────┘
                                 │
                         next chronological
                               event
                                 │
                                 ▼
                              REPLAY
                                 │
                                 ▼
                         MONTH-WISE DUE PAY
                                 │
                                 │
DRAWN PAY ───────────────────────┤
                                 ▼
                           DUE - DRAWN
                                 │
                                 ▼
                         ARREAR / RECOVERY
```

The user interface, exports and reports are consumers of this engine.

The rule engine is the product's foundation.
# Due Pay composition

The executable financial flow is:

```text
Opening Pay State
→ deterministic event replay
→ Pay History
→ effective-date financial segments
→ existing allowance engines
→ segment Due Pay
→ monthly Due Pay summary
```

Financial segments are interval records rather than daily salary rows. They preserve inclusive dates, Pay State, dated location and eligibility states, applicable Custom Allowance definitions, rule provenance, and unresolved-event IDs. A month may be finalized only when a single resolved segment covers that whole calendar month. This keeps later proration and due-drawn work separate from the verified composition implemented here.

# Date of Next Increment decision

DNI is a first-class engine decision, not an incidental string calculated by a fixation function. A resolved or unresolved decision records the CPC, triggering event, rule ID, candidate DNI, qualifying-service assessment, final status, date, reason, and human-readable explanation. Pay States retain the legacy `dni` value for compatibility and also carry `dniDecision` as the audit record.

Candidate-date selection and increment eligibility are separate. A known candidate does not become a resolved DNI when qualifying service is unverified or an adverse service event requires a rule that has not been implemented. A prior unresolved DNI-affecting event contaminates later increment processing rather than allowing replay to silently continue.

The pure resolver is shared by annual increments, promotion, MACP, CPC transition, and no-fresh-fixation interaction handling. Financial placement remains the responsibility of the existing CPC-specific engines.

# Multi-stage Pay State transformations

A single confirmed event may produce more than one effective-dated financial state. Fixation from lower-post DNI uses this reusable transformation contract:

```text
BEFORE
→ INTERIM_PAY_STATE on promotion/MACP date
→ FINAL_FIXATION_STATE on lower-post DNI
```

The transformation retains one originating event ID, event type, rule ID, fixation option, lower-post DNI, interim range and steps, final fixation steps, consumed annual-increment provenance, and subsequent DNI decision. Its immediate `after` state is the interim state; the final transition is scheduled by generic chronological replay.

Pay History consumes both replayed transitions and does not recalculate either state. Financial segmentation therefore sees both boundaries naturally, allowing allowance engines to consume the correct Basic Pay inputs while existing monthly-proration safeguards remain unchanged. The final transition is derived state, not a fake user-entered annual-increment event.

# Fifth CPC career progression

Ordinary 5th CPC regular promotion is a career event distinct from ACP, CPC transition, and pay correction:

```text
Scale A / Stage N
→ REGULAR_PROMOTION
→ one prescribed movement in Scale A
→ fixation reference amount
→ equal or next higher prescribed stage in confirmed Scale B
```

The target scale is explicit event data, not inferred hierarchy. A successful immediate promotion produces `careerEffect: PROMOTED` and `payFixationEffect: FRESH_FIXATION`, retains complete source/target-stage provenance, and carries an explicit unresolved post-promotion DNI decision where no verified DNI rule exists. Pay History consumes the promoted scale and stage directly, including as the source of a later 5th→6th CPC transition.

The domain can represent a deferred 5th CPC promotion through the generic multi-stage contract, but no interim or final Pay State is generated until the exact lower-post-DNI rule is verified.

# ACP financial-progression identity

The three event families remain separate even where fixation arithmetic resembles another rule:

```text
REGULAR_PROMOTION = career event + financial fixation
ACP               = confirmed financial progression under ACP Scheme, 1999
MACP              = later financial progression under MACPS
```

ACP uses its own event type, rule ID, number, eligibility decision, and provenance. A successful 5th CPC ACP state carries `reachedBy: ACP` and `acpNumber`, while its transformation uses `careerEffect: NONE`, `financialProgressionEffect: ACP`, and `payFixationEffect: FRESH_FIXATION`. It is never synthesized as regular promotion or MACP.

The ACP eligibility decision is separate from pay fixation:

```js
{
  scheme: "ACP_1999",
  requestedBenefit: 1,
  status: "CONFIRMED_EXTERNALLY",
  schemeApplicabilityStatus: "CONFIRMED_EXTERNALLY",
  automaticServiceEligibilityEvaluated: false
}
```

Chronological replay retains ACP 1/2 events and their target-scale provenance for later eligibility, MACP continuity, audit, and interaction rules. Pay History consumes the resulting scale/stage state directly, and a later CPC transition uses that current ACP-derived state. Automatic 12/24-year entitlement and promotional-hierarchy resolution do not belong in the fixation engine.

# ACP → MACPS lifecycle and history

Career-progression scheme classification uses the benefit `effectiveDate`, never the administrative `orderDate`:

```text
through 2008-08-31 → ACP_1999
from    2008-09-01 → MACPS
```

A retrospective ACP order issued after the boundary remains ACP when its benefit effective date is pre-cutoff. No `ACP_TO_MACP_TRANSITION` financial event is generated.

The target models are deliberately different:

```text
ACP  → externally confirmed cadre promotional scale, which may skip S-scales
MACP → immediate controlled financial Grade Pay/Level only
```

Successful event history can be normalized into derived financial-progression records containing scheme, number, effective date, event identity, and reached financial structure. This derived view does not duplicate or replace the underlying events and is reserved for future ACP/MACP entitlement analysis. ACP retains its 12/24-year metadata and MACP its 10/20/30-year metadata; neither automatically creates events or establishes eligibility.
