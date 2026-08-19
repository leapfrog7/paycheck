# PayCheck — Pay Rules and Calculation Registry

> **Scope boundary:** These rules determine Due Pay (calculated entitlement). Drawn Pay is independent historical input and must not be derived from or validated against these rules. Recalculating Due Pay must never mutate Drawn Pay.

> **Status:** Foundational rule specification — Version 0.1
> **Purpose:** Records verified and provisional Central Government pay rules that PayCheck may encode.
> **Audience:** Domain reviewers, developers, GitHub Copilot, future maintainers.
> **Important:** Do not implement a rule merely because an event exists in `pay-domain-model.md`. Only rules marked sufficiently verified should be automated.

---

# 1. Rule Governance

This file is the authoritative calculation-specification layer for PayCheck.

The application must follow these principles:

1. Calculation rules are deterministic.
2. Rules must be traceable to Government authority.
3. React/UI components must not contain pay-rule logic.
4. A rule may be `VERIFIED`, `PROVISIONAL`, or `UNSUPPORTED`.
5. Copilot must not invent missing rules.
6. Edge cases must be explicitly added as rule branches.
7. A later clarification can create a new rule version.
8. Historical calculations must apply the rule/version relevant to the event.
9. Employee options must be stored as case data.
10. Every calculation must generate an explanation/audit record.

---

# 2. Implementation Status Definitions

## VERIFIED

The governing authority has been identified and the core algorithm is sufficiently clear for implementation and testing.

A `VERIFIED` rule may still have explicitly listed unsupported edge cases.

## PROVISIONAL

The broad treatment is understood, but one or more important details/edge cases require further verification.

Do not automatically calculate unless the user/domain owner specifically approves the implementation.

## UNSUPPORTED

Recognized by the domain model, but no automatic calculation should be performed.

---

# 3. Source Hierarchy

Use sources in this order:

1. Gazette-notified CCS (Revised Pay) Rules / Fundamental Rules
2. Department of Expenditure orders and clarifications
3. Department of Personnel & Training orders and consolidated information documents
4. Cadre-controlling Ministry/Department orders where a scheme is cadre-specific
5. Court orders only where their effect is intentionally being implemented
6. Secondary websites only for discovery, never as the authoritative rule source

For production rule metadata, store:

```js
{
  department,
  instrument,
  orderNumber,
  orderDate,
  ruleOrPara,
  sourceUrl,
  effectiveFrom,
  effectiveTo
}
```

---

# 4. Pay Commission Structural Model

## 4.1 Fifth CPC

### Status

`VERIFIED_CONCEPT`

Implementation status: `STANDARD_S_SERIES_DATA_IMPLEMENTED`.

### Core principle

Basic Pay is a prescribed monetary stage in the employee's applicable pay scale.

Example:

```text
Scale: 6500-200-10500

Valid stages:
6500
6700
6900
7100
...
10500
```

Some scales contain more than one increment segment.

Example pattern:

```text
3050-75-3950-80-4590
```

### Engine rule

The application must store a pay scale definition and generate the valid stages.

The user should select:

```text
Pay Scale
   ↓
Valid Basic Pay stage
```

Do not accept arbitrary calculated 5th CPC Basic Pay.

### Data requirement

The following controlled standard dataset is encoded from the supplied monetary structures:

| Code | Prescribed monetary scale |
|---|---|
| S-1 | ₹2550–55–2660–60–3200 |
| S-2 | ₹2610–60–3150–65–3540 |
| S-3 | ₹2650–65–3300–70–4000 |
| S-4 | ₹2750–70–3800–75–4400 |
| S-5 | ₹3050–75–3950–80–4590 |
| S-6 | ₹3200–85–4900 |
| S-7 | ₹4000–100–6000 |
| S-8 | ₹4500–125–7000 |
| S-9 | ₹5000–150–8000 |
| S-10 | ₹5500–175–9000 |
| S-11 | ₹6500–200–6900 |
| S-12 | ₹6500–200–10500 |
| S-13 | ₹7450–225–11500 |
| S-14 | ₹7500–250–12000 |
| S-15 | ₹8000–275–13500 |
| S-16 | ₹9000 FIXED |
| S-17 | ₹9000–275–9550 |
| S-18 | ₹10325–325–10975 |
| S-19 | ₹10000–325–15200 |
| S-20 | ₹10650–325–15850 |
| S-21 | ₹12000–375–16500 |
| S-22 | ₹12750–375–16500 |
| S-23 | ₹12000–375–18000 |
| S-24 | ₹14300–400–18300 |
| S-25 | ₹15100–400–18300 |
| S-26 | ₹16400–450–20000 |
| S-27 | ₹16400–450–20900 |
| S-28 | ₹14300–450–22400 |
| S-29 | ₹18400–500–22400 |
| S-30 | ₹22400–525–24500 |
| S-31 | ₹22400–600–26000 |
| S-32 | ₹24050–650–26000 |
| S-33 | ₹26000 FIXED |
| S-34 | ₹30000 FIXED |

S-1 through S-5 retain each supplied increment section and breakpoint; they are not flattened to one increment. Fixed scales contain one valid stage and therefore have no ordinary next-stage increment. The dataset records the source family as the Central Civil Services (Revised Pay) Rules, 1997, Government of India, Ministry of Finance, Department of Expenditure. It does not invent notification metadata or Efficiency Bar locations.

Canonical identifiers are `S5_S1` through `S5_S34`. Legacy persisted IDs for the earlier S-5 and S-12 examples are aliases and normalize to the canonical IDs. S-2A and non-standard/intermediate or special scales remain unsupported unless separately verified.

---

# 5. Fifth CPC Annual Increment

## Rule ID

`5CPC_ANNUAL_INCREMENT`

## Status

`VERIFIED_CONCEPT`

## Principle

The employee moves from the current valid stage to the next prescribed stage in the applicable scale on the applicable Date of Increment.

### Algorithm

```text
1. Identify selected 5th CPC pay scale.
2. Identify current stage index.
3. Verify DNI.
4. On DNI:
      newStageIndex = currentStageIndex + 1
      newBasicPay = scale.stages[newStageIndex]
5. Do not mathematically add a generic percentage.
```

### DNI

The 5th CPC did not use the later universal 1 July increment date.

The employee's individual increment date is a required opening fact unless it can be derived from prior service history.

### Edge cases

The final scale stage returns `NO_NEXT_STAGE_IN_PAY_SCALE`; an ordinary increment must not invent a stagnation stage. The scale schema can mark an Efficiency Bar crossing, but the ordinary engine returns `EFFICIENCY_BAR_CLEARANCE_REQUIRED` because clearance decision logic is not implemented.

Not yet encoded:

- stagnation increments;
- withheld increments;
- EOL/non-qualifying service;
- promotion near DNI;
- special revised-scale cases.

---

# 5A. Fifth CPC Regular Promotion — FR 22(I)(a)(1)

## Rule ID

`5CPC_REGULAR_PROMOTION_FR22`

## Implemented scope

Ordinary `REGULAR_PROMOTION` fixation `FROM_EVENT_DATE` is stage based. The event must explicitly supply a different target scale from the authoritative catalogue. The engine grants exactly one prescribed stage movement in the lower scale, then selects the equal or immediate next higher prescribed stage in the target scale. It never infers a target scale from designation or S-series order and never interpolates an off-scale value.

The transformation records source scale/stage, the lower-scale promotional increment and reference stage, target scale, `EXACT_STAGE` or `NEXT_HIGHER_STAGE`, selected target stage, final Basic Pay, career/pay effects, and DNI decision. Fixed scales and final source stages return `LOWER_SCALE_PROMOTIONAL_INCREMENT_NOT_AVAILABLE`; an encoded uncleared Efficiency Bar returns `EFFICIENCY_BAR_CLEARANCE_REQUIRED`; and an exhausted target scale returns `NO_SUITABLE_STAGE_IN_TARGET_SCALE`.

Post-promotion 5th CPC DNI remains `5CPC_POST_PROMOTION_DNI_NOT_IMPLEMENTED`. The monetary fixation may succeed, but later annual increment processing remains blocked until DNI is resolved.

`FROM_LOWER_POST_DNI` is recognized and validates resolved DNI, strict event-date ordering, target structure, and explicit adverse-service uncertainty. Exact 5th CPC interim and final treatment is not documented sufficiently, so it returns `5CPC_PROMOTION_FROM_DNI_INTERIM_RULE_NOT_IMPLEMENTED`. Its future state sequence uses the generic `BEFORE → INTERIM_PAY_STATE → FINAL_FIXATION_STATE` model; no 6th CPC Grade Pay or 7th CPC matrix rule is borrowed.

ACP, ad-hoc promotion, stagnation increments, EB clearance decisions, stepping up, and pay protection remain separate.

---

# 5B. ACP Scheme, 1999 — Confirmed Financial Upgradation Fixation

## Rule ID

`5CPC_ACP_SCHEME_1999_FIXATION`

ACP is a financial progression distinct from regular promotion and MACP. The fixation engine supports externally confirmed ACP 1 and ACP 2 events; it does not determine entitlement. Scheme metadata records the 12-year framework for ACP 1 and the 24-year/prescribed-progression framework for ACP 2, both subject to the scheme conditions that remain outside automatic calculation.

Every executable event must include a separate eligibility decision confirming admissibility externally. The verified lifecycle boundary is encoded by benefit effective date: normal ACP applies through 31 August 2008 and MACPS applies from 1 September 2008. A later `orderDate` does not change an ACP benefit whose `effectiveDate` falls before the cutoff.

The confirmed `targetPayScaleId` is mandatory because promotional hierarchy is cadre/post specific. For `FROM_EVENT_DATE`, the engine reuses the common 5th CPC stage primitive: move one prescribed stage in the source scale, then select the exact or immediate next higher stage in the confirmed ACP scale. It preserves `eventType: ACP`, `reachedBy: ACP`, `acpNumber`, `careerEffect: NONE`, and `financialProgressionEffect: ACP`.

Duplicate successful ACP 1 or ACP 2 events are rejected, and ACP 2 without prior successful ACP 1 remains unresolved unless a future explicit migration exception exists. This is a history-consistency guard, not a 12/24-year eligibility determination.

Post-ACP DNI remains `5CPC_POST_ACP_DNI_NOT_IMPLEMENTED`. `FROM_LOWER_POST_DNI` remains specifically unresolved as `5CPC_ACP_FROM_DNI_NOT_IMPLEMENTED`. Same-scale ACP, stagnation increments, Efficiency Bar decisions, hierarchy discovery, prior-promotion entitlement adjustment, promotion-after-ACP interaction, and adverse-service calculations are not implemented.

Future ACP eligibility may require direct-entry date, regular-service history, promotion and ACP history, dated hierarchy, residency, fitness/disciplinary conditions, and other scheme conditions. No ACP event is generated automatically from service length.

## ACP → MACPS lifecycle

ACP uses the cadre/post promotional hierarchy and may therefore target a confirmed non-adjacent S-scale. MACPS supersedes ACP for ordinary financial upgradations effective from 1 September 2008 and uses the immediate financial hierarchy instead. Supersession is a rule-timeline change, not a synthetic pay event; it does not itself change Basic Pay.

Under the controlled Sixth CPC hierarchy, ordinary MACP advances to the immediately following Pay Band/Grade Pay structure. Under Seventh CPC it advances to the immediately following Pay Matrix Level, including the controlled placement of Level 13A. Explicit legacy targets are accepted only when they match the controlled immediate target; hierarchy skips remain unresolved. MACP retains its three-upgradation 10/20/30-year framework as metadata, while automatic entitlement remains unimplemented.

---

# 6. Fifth CPC → Sixth CPC Transition

## Rule ID

`5CPC_TO_6CPC`

## Status

`VERIFIED_CORE_WITH_EXCEPTIONS`

Implementation status: `ORDINARY_GENERIC_RULE7_IMPLEMENTED` under engine rule ID `5CPC_TO_6CPC_RULE7`.

## Effective framework

CCS (Revised Pay) Rules, 2008.

## Core normal-fixation rule

For ordinary fixation in the revised pay structure:

```text
Existing 5th CPC Basic Pay
        × 1.86
        ↓
Round resultant figure to the next multiple of ₹10
        ↓
Pay in Pay Band
        +
Corresponding Grade Pay
        ↓
6th CPC Basic Pay
```

### Core algorithm

```js
fitmentValue = oldBasicPay * 1.86
roundedFitment = roundUpToNextTenAsSpecified(fitmentValue)
payInBand = max(roundedFitment, mappedPayBandMinimum)
gradePay = mappedGradePay
newBasicPay = payInBand + gradePay
```

### Important

The implemented ordinary transition supports only a normal switch on 01 January 2006 using the generic First Schedule replacement structure. Rule-7 rounding is a dedicated upward-to-next-₹10 operation; an amount already divisible by ₹10 remains unchanged. The Pay Band minimum applies to Pay in Pay Band before Grade Pay is added.

Generic supported mappings are S-4 through S-29 into the existing PB-1 through PB-4 + Grade Pay model. In particular:

```text
Generic S-12 → PB-2 + Grade Pay ₹4200
Generic S-13 → PB-2 + Grade Pay ₹4600
```

Post-specific upgrades must not replace the generic S-12 mapping silently.

The controlled unsupported outcomes are:

- S-1, S-2 and S-3: historical -1S structure is not implemented;
- S-30: GP ₹12000 is outside the current ordinary 6th CPC Pay State;
- S-31 and S-32: HAG+ structure is not implemented;
- S-33: Apex fixed structure is not implemented;
- S-34: Cabinet Secretary fixed structure is not implemented.

The transformation records `bunchingApplied: false` and `bunchingStatus: NOT_EVALUATED`; this does not decide entitlement to bunching. Post-transition DNI remains explicitly unresolved under `POST_6CPC_TRANSITION_DNI_NOT_IMPLEMENTED` rather than carrying forward the 5th CPC individual DNI or inventing 1 July.

Do not treat the ordinary result as the complete transition framework.

The 2008 rules contain protections/adjustments including:

- minimum of the applicable Pay Band/revised structure;
- Grade Pay mapping;
- scale mergers/upgradations;
- bunching;
- option to remain in existing scale until a permitted later event/date;
- special cases.

### Transition date model

Store separately:

```js
{
  statutoryEffectiveDate: "2006-01-01",
  employeeSwitchDate: "..."
}
```

Do not assume every employee necessarily switched on the statutory effective date.

Upgraded, merged, replacement, and post-specific revised structures return `STRUCTURAL_UPGRADATION_RULE_NOT_IMPLEMENTED` in this phase.

### 6CPC_DELAYED_SWITCH_OPTION

The statutory effective date remains 1 January 2006, while a confirmed employee option may establish a later `employeeSwitchDate`. Until that date, replay continues in the valid 5th CPC scale. Supported bases are the next or a subsequent old-scale increment, a supported promotion/ACP upgradation, or the recorded date of vacating or ceasing to draw pay in the old structure. Increment and promotion/upgradation bases require a referenced `triggerEventId`; replay orders that successful old-CPC event before the transition on the same date. The transition then reuses the ordinary controlled scale mapping, 1.86 fitment, Rule-7 upward-to-₹10 rounding, Pay Band minimum, and Grade Pay addition using the actual replayed 5th CPC Basic Pay. Its first 6th CPC DNI remains `DELAYED_6CPC_SWITCH_DNI_NOT_RESOLVED` where no implemented rule determines it.

### 7CPC_DELAYED_SWITCH_OPTION

The statutory effective date remains 1 January 2016, while a confirmed employee option may establish a later `employeeSwitchDate`. The employee remains in the 6th CPC Pay Band/Grade Pay structure until that date. A referenced next/subsequent increment or supported promotion/MACP trigger is replayed once before the same-date transition. Later fixation reuses the ordinary 2.57 arithmetic, nearest-rupee rounding, controlled Level mapping, and exact/next-higher Cell lookup using the actual replayed 6th CPC Basic Pay. The special normal-transition DNI of 1 July 2016 applies only to a 1 January 2016 switch; delayed-switch DNI remains `DELAYED_7CPC_SWITCH_DNI_NOT_IMPLEMENTED`.

For both options, `statutoryEffectiveDate` is provenance while `employeeSwitchDate` is the Pay State and financial effective date. Random unconfirmed later dates, pre-statutory dates, established post-effective-date first appointees, unresolved triggers, identified transfer-appointment adjudication, and multiple retained structures produce structured unresolved results. Administrative filing deadlines, revision entitlement, and automatic best-option selection are deferred. A delayed CPC switch is not notional revised fixation with delayed monetary benefit.

## PAY_REFIXATION / correction policy

PayCheck applies verified rule engines by default but does not adjudicate every exceptional administrative cause. When the confirmed outcome of a penalty, audit, court, stepping-up, protection, clerical, service-book, or other administrative process is known, the user may insert one canonical `PAY_REFIXATION`. This records the result, not the substantive entitlement analysis. The corrected state replaces Due Pay state from its effective date and all later increments, promotions, ACP/MACP, CPC transitions, allowances, and comparisons consume the replayed replacement state without changing their formulas.

Two modes are supported. `STRUCTURED_CORRECTION` must conform to the existing CPC Pay State validator. `MANUAL_HISTORICAL_STATE` requires CPC identity, a valid effective date, and finite non-negative monetary values, but permits confirmed off-stage/off-matrix or unusual historical values. Manual overrides, unusual structures, inconsistent entered 6th CPC components, and missing references emit advisory warnings; they do not silently repair data or block an otherwise sane historical record. All corrections retain `USER_CONFIRMED` provenance, before/after states, changed fields, and separate unparsed user notes.

Non-standard state is not universal permission for future formulas. Fifth CPC stage movement and Seventh CPC Cell movement require standard structures and return `NON_STANDARD_PAY_STATE_REQUIRES_REFIXATION`. Sixth CPC rules may proceed only when the existing validator establishes complete, internally consistent Pay Band, Pay in Band, Grade Pay, Basic Pay, and DNI inputs. A later structured `PAY_REFIXATION` restores normal processing.

`DNI_ADJUSTMENT` changes only DNI and records a resolved `USER_CONFIRMED` decision with no Rule-10 attribution. Future increments use that adjusted date until another event changes it. `NOTIONAL_REFIXATION` changes the Pay State trajectory at `effectiveDate`, but financial segments remain `NOTIONAL_ONLY` until `monetaryBenefitFrom`; no Gross Due or arrear is generated solely for that earlier period. A mid-month monetary boundary retains the existing `MONTHLY_PRORATION_RULE_NOT_IMPLEMENTED` limitation.

A confirmed refixation can restore certainty after an unresolved earlier event. Earlier uncertainty remains auditable, but it does not permanently contaminate the trajectory after the explicit correction boundary. Same-date interaction requires `BEFORE_EVENT` or `AFTER_EVENT` plus `relatedEventId`; absent that relation, replay returns `SAME_DATE_CORRECTION_ORDER_UNRESOLVED`. Drawn Pay remains independent historical input and is never mutated by correction replay.

## CONTROLLED_PARTIAL_MONTH_PRORATION

PayCheck does not assume a universal Central Government salary-proration method, divisor, working-day convention, or monetary rounding rule. A single full-month financial segment continues to calculate automatically and unchanged. A component applicable for less than the whole month is calculated only when a verified `SYSTEM_RULE` or explicit `USER_CONFIRMED` decision selects its method; otherwise it remains `PRORATION_BASIS_NOT_CONFIRMED` and Gross Due is null.

The engine first obtains the full monthly Basic Pay or allowance from the existing formula, then prorates that final component. It does not recalculate DA/HRA from prorated Basic Pay, and it treats Transport Allowance plus DA-on-TA as one final TA component to avoid double proration. Financial segments are clipped to calendar months, counted inclusively, kept continuous and non-overlapping, calculated independently, and aggregated only after every required monetary component resolves.

Explicit methods are calendar days in the month, fixed divisor 30, manual factor between zero and one, manual segment amount including zero, and explicit full monthly amount. Fixed-30 factors above one are anomalous and unresolved rather than capped. A non-integral raw result remains `PRORATION_ROUNDING_NOT_CONFIRMED` until a specific rounding decision exists. Audit output retains full monthly amount, eligible days, divisor, factor, raw amount, rounding decision, and final amount.

Specific component/segment/month decisions override month policies; month policies override the case policy. User decisions emit `USER_CONFIRMED_PRORATION`, and missing user references emit advisory `PRORATION_WITHOUT_REFERENCE`. Custom allowances may explicitly declare full-month treatment or use case decisions; definitions without a usable policy remain `CUSTOM_ALLOWANCE_PRORATION_NOT_CONFIRMED` for partial periods. A `NOTIONAL_REFIXATION` monetary boundary uses this same framework, with the earlier segment remaining `NOTIONAL_ONLY`.

---

# 7. Sixth CPC Pay Identity

## Rule ID

`6CPC_BASIC_PAY_IDENTITY`

## Status

`VERIFIED`

For the ordinary Pay Band + Grade Pay system:

```text
Basic Pay = Pay in Pay Band + Grade Pay
```

Store all three values:

```js
{
  payInBand,
  gradePay,
  basicPay
}
```

Do not store only the total Basic Pay.

---

# 8. Sixth CPC Pay Band / Grade Pay → Seventh CPC Level Mapping

## Rule ID

`6CPC_TO_7CPC_LEVEL_MAP`

## Status

`DOMAIN_VERIFIED_PENDING_DATA_TABLE_VALIDATION`

The mapping must use **Pay Band + Grade Pay**, not Grade Pay alone.

Reason:

```text
Grade Pay ₹5400 existed in more than one Pay Band.
```

Therefore:

```js
mapKey = {
  payBand,
  gradePay
}
```

not:

```js
mapKey = gradePay
```

### Working mapping supplied for PayCheck

| 7th CPC Level | 6th CPC Pay Band / Scale | Grade Pay |
|---|---|---:|
| Level 1 | PB-1 ₹5200–20200 | ₹1800 |
| Level 2 | PB-1 ₹5200–20200 | ₹1900 |
| Level 3 | PB-1 ₹5200–20200 | ₹2000 |
| Level 4 | PB-1 ₹5200–20200 | ₹2400 |
| Level 5 | PB-1 ₹5200–20200 | ₹2800 |
| Level 6 | PB-2 ₹9300–34800 | ₹4200 |
| Level 7 | PB-2 ₹9300–34800 | ₹4600 |
| Level 8 | PB-2 ₹9300–34800 | ₹4800 |
| Level 9 | PB-2 ₹9300–34800 | ₹5400 |
| Level 10 | PB-3 ₹15600–39100 | ₹5400 |
| Level 11 | PB-3 ₹15600–39100 | ₹6600 |
| Level 12 | PB-3 ₹15600–39100 | ₹7600 |
| Level 13 | PB-4 ₹37400–67000 | ₹8700 |
| Level 13A | PB-4 ₹37400–67000 | ₹8900 |
| Level 14 | PB-4 ₹37400–67000 | ₹10000 |
| Level 15 | pre-revised higher scale | no Grade Pay |
| Level 16 | pre-revised higher scale | no Grade Pay |
| Level 17 | fixed/apex structure | no Grade Pay |
| Level 18 | fixed/apex structure | no Grade Pay |

### Required action before coding

Validate the complete mapping table, including Level 15–18 pre-revised scale nomenclature, against the First Schedule / official Pay Matrix source.

---

# 9. Sixth CPC Annual Increment

## Rule ID

`6CPC_ANNUAL_INCREMENT`

## Status

`VERIFIED_CORE — ROUNDING IMPLEMENTATION TO BE UNIT-TESTED`

## Authority

CCS (Revised Pay) Rules, 2008, Rule 9 and Department of Expenditure clarifications.

## Core principle

Annual increment is calculated at 3% of:

```text
Pay in Pay Band + Grade Pay
```

The increment amount is then added to **Pay in Pay Band**.

Grade Pay ordinarily remains unchanged.

### Core sequence

```text
Pay in Pay Band
        +
Grade Pay
        ↓
Increment Base
        × 3%
        ↓
Apply prescribed 6th CPC rounding
        ↓
Increment Amount
        ↓
Add to Pay in Pay Band
        ↓
Grade Pay unchanged
        ↓
New Basic Pay
```

### Example

```text
Pay in Band: ₹10,000
Grade Pay:   ₹4,200
Basic Pay:   ₹14,200

3% = ₹426

Prescribed rounded increment = ₹430

New Pay in Band = ₹10,430
Grade Pay       = ₹4,200
New Basic Pay   = ₹14,630
```

---

# 10. Sixth CPC Increment Rounding

## Rule ID

`6CPC_INCREMENT_ROUNDING`

## Status

`PROVISIONAL_IMPLEMENTATION_DETAIL — DOMAIN OWNER CONFIRMED, PRIMARY TEXT TO BE PINNED`

### Working understanding

Do **not** implement a generic `Math.ceil(value / 10) * 10` on the raw 3% decimal.

The intended treatment must reproduce cases such as:

```text
Calculated amount = ₹400.30
→ ₹400
```

while a value that becomes ₹401 or more at the relevant rupee stage moves to:

```text
₹410
```

### Implementation warning

Do not code this rule until the exact official rounding instruction/illustration has been pinned to the rule test cases.

Create a dedicated function:

```js
roundSixthCpcIncrement(value)
```

Do not reuse generic currency rounding utilities.

### Required tests

At minimum, test values around boundaries:

```text
₹400.00
₹400.30
₹400.49
₹400.50
₹400.99
₹401.00
₹409.xx
₹410.00
```

The expected result for each must be confirmed from the governing instruction before implementation is considered `VERIFIED`.

---

# 11. Sixth CPC Normal DNI

## Rule ID

`6CPC_DNI`

## Status

`VERIFIED_CORE`

The 6th CPC introduced a common annual increment date of:

```text
1 July
```

Eligibility is subject to the applicable qualifying-service rule.

### Engine requirement

DNI must be stored as state.

Do not simply calculate `next July` without considering:

- promotion;
- MACP;
- fixation option;
- qualifying service;
- EOL/non-qualifying service;
- withheld increment.

---

# 12. Sixth CPC Regular Promotion — FR 22(I)(a)(1)

## Rule ID

`6CPC_PROMOTION_FR22_I_A_1`

## Status

`VERIFIED_CORE_WITH_EDGE_CASES`

## Concept

Where promotion is covered by FR 22(I)(a)(1), pay fixation can involve the prescribed promotional increment and higher Grade Pay/pay structure.

Where the option is admissible, the employee may choose fixation:

```text
A. From date of promotion
or
B. From Date of Next Increment in the lower post
```

### Required event data

```js
{
  effectiveDate,
  fromPayInBand,
  fromGradePay,
  targetGradePay,
  lowerPostDni,
  fixationOption
}
```

---

# 13. Sixth CPC Promotion — Fixation from Promotion Date

## Rule ID

`6CPC_PROMOTION_FROM_EVENT_DATE`

## Status

`VERIFIED_CORE`

Working sequence:

```text
Existing Pay in Band + Existing Grade Pay
        ↓
Promotion increment under applicable rule
        ↓
Increment added to Pay in Band
        ↓
Substitute higher Grade Pay
        ↓
New Basic Pay
        ↓
Determine consequential DNI
```

### Example

```text
Pay in Band = ₹13,500
Grade Pay   = ₹4,200
Basic       = ₹17,700

Promotion to GP ₹4,600 on 01.06.2014

3% of ₹17,700 = ₹531
Prescribed increment = ₹540

New Pay in Band = ₹14,040
New Grade Pay   = ₹4,600
New Basic Pay   = ₹18,640
```

### DNI consequence

The engine must determine whether the employee qualifies for the immediately following common increment date.

Do not automatically retain the old DNI.

---

# 14. Sixth CPC Promotion — Fixation from Lower-Post DNI

## Rule ID

`6CPC_PROMOTION_FROM_DNI`

## Status

`VERIFIED_CONCEPT — INTERIM-PERIOD DETAILS MUST BE TESTED`

This is a multi-stage event.

### Conceptual sequence

```text
Promotion effective date
        ↓
Interim treatment until lower-post DNI
        ↓
On lower-post DNI:
    grant normal lower-post increment
        ↓
    apply promotion fixation
        ↓
    move to higher Grade Pay
        ↓
derive new DNI
```

### Architectural requirement

The event processor must be able to create:

```text
State A
→ Interim State A1
→ Final State B
```

rather than one direct state change.

### Interim period

The exact 6th CPC treatment for the higher Grade Pay/difference during the period between promotion and opted fixation date must be captured from the governing order and verified with official illustrations before production implementation.

---

# 15. Seventh CPC Pay Matrix

## Rule ID

`7CPC_PAY_MATRIX`

## Status

`VERIFIED_STRUCTURE`

A valid 7th CPC pay position is:

```text
Level + Cell
```

The Basic Pay equals the monetary value of the selected Cell.

### Invariant

```text
Calculated Basic Pay must exist in the selected Level.
```

The Pay Matrix table should be stored as structured application data.

Suggested structure:

```js
{
  "6": [35400, 36500, 37600, ...],
  "7": [44900, 46200, 47600, ...]
}
```

Cell indexes should be explicit and stable.

---

# 16. Sixth CPC → Seventh CPC Transition

## Rule ID

`6CPC_TO_7CPC`

## Status

`VERIFIED_CORE_WITH_EXCEPTIONS`

## Effective framework

CCS (Revised Pay) Rules, 2016.

### Core normal-fixation sequence

```text
6th CPC Basic Pay
(Pay in Pay Band + Grade Pay)
        × 2.57
        ↓
Round as prescribed
        ↓
Identify corresponding 7th CPC Level
        ↓
Search only within that Level
        ↓
Equal Cell, if available
otherwise immediate next higher Cell
        ↓
7th CPC Basic Pay
```

### Example

```text
Pay in Band = ₹10,160
Grade Pay   = ₹2,400
Basic Pay   = ₹12,560

₹12,560 × 2.57 = ₹32,279.20

Prescribed result = ₹32,279

Mapped Level = Level 4

Next equal/higher Cell in Level 4 = ₹32,300

New Basic Pay = ₹32,300
```

### Critical invariant

Never search the entire Pay Matrix.

Search only the Level mapped from the employee's pre-revised pay structure.

### Exceptions / branches to support later

- bunching;
- revised option;
- upgraded/merged posts;
- minimum-cell cases;
- special higher scales;
- employee switch date different from statutory effective date.

---

# 17. Seventh CPC Annual Increment

## Rule ID

`7CPC_ANNUAL_INCREMENT`

## Status

`VERIFIED`

### Rule

Annual increment is movement to the next vertical Cell in the same Level.

```text
Current Cell Index = n
New Cell Index     = n + 1
New Basic Pay      = Level.cells[n + 1]
```

### Important

Do not compute:

```text
basicPay × 1.03
```

for the employee's operational increment.

The matrix already embodies the prescribed progression.

---

# 18. Seventh CPC DNI

## Rule ID

`7CPC_DNI_RULE10`

## Status

`VERIFIED_CORE_WITH_CLARIFICATIONS`

The revised structure provides two possible annual increment dates:

```text
1 January
1 July
```

Only one normal annual increment is granted in the relevant annual cycle.

DNI depends on appointment/promotion/MACP/fixation circumstances and subsequent clarifications.

### Core date grouping

Working rule from the revised-pay framework:

```text
Appointment / promotion / financial upgradation
between 2 January and 1 July
→ relevant DNI = 1 January

between 2 July and 1 January
→ relevant DNI = 1 July
```

### Important

Do not implement DNI solely from this simplified table.

Rule 10 and subsequent Department of Expenditure clarifications must be encoded as explicit test scenarios.

DNI must be recalculated after pay-fixation events.

---

# 19. Seventh CPC Regular Promotion — Rule 13

## Rule ID

`7CPC_PROMOTION_RULE13`

## Status

`VERIFIED_CORE`

### Core sequence

```text
Current Basic in lower Level
        ↓
Grant one increment in lower Level
(move to next vertical Cell)
        ↓
Take resulting amount
        ↓
Search target/higher Level
        ↓
Equal Cell, if available,
otherwise next higher Cell
        ↓
New Basic Pay
```

### Example

```text
Current:
Level 6
Basic ₹41,100

Step 1:
Next Cell in Level 6 = ₹42,300

Step 2:
Search Level 7

First equal/next higher Cell = ₹44,900

Result:
Level 7
Basic ₹44,900
```

---

# 20. Seventh CPC Promotion — Fixation Option

## Rule ID

`7CPC_PROMOTION_FIXATION_OPTION`

## Status

`VERIFIED_CORE_WITH_DNI_EDGE_CASES`

Where the applicable rule permits, the employee may elect fixation:

```text
FROM_EVENT_DATE
or
FROM_LOWER_POST_DNI
```

### Architectural effect

A DNI-option case can create an interim state before final fixation.

Do not assume that both options produce different Basic Pay; due to matrix matching, alternative paths can sometimes converge to the same Cell while producing different DNI/timing consequences.

---

# 21. Seventh CPC Promotion from Event Date

## Rule ID

`7CPC_PROMOTION_FROM_EVENT_DATE`

## Status

`VERIFIED_CORE`

Sequence:

```text
Current lower-Level Cell
        ↓
one vertical increment in lower Level
        ↓
target Level lookup
        ↓
equal / next higher Cell
        ↓
new Basic Pay
        ↓
derive new DNI
```

---

# 22. Seventh CPC Promotion from Lower-Post DNI

## Rule ID

`7CPC_PROMOTION_FROM_DNI`

## Status

`VERIFIED_CONCEPT — INTERIM TREATMENT/DNI TEST MATRIX REQUIRED`

Conceptual sequence:

```text
Promotion effective
        ↓
interim promoted-state treatment
        ↓
lower-post DNI arrives
        ↓
lower-post annual increment
        ↓
promotion fixation increment
        ↓
target-Level lookup
        ↓
final promoted pay
        ↓
derive consequential DNI
```

### Requirement before implementation

Create official worked examples for:

- promotion just before 1 July;
- promotion just before 1 January;
- both fixation options;
- cases where matrix result converges;
- DNI following each option.

---

# 23. MACP — Domain Identity

## Rule ID

`MACP_EVENT_IDENTITY`

## Status

`VERIFIED`

MACP is a **financial upgradation**, not regular promotion.

The employee's career post may remain unchanged while the financial pay structure changes.

The event history must preserve:

```js
{
  reachedBy: "MACP"
}
```

This matters when a later regular promotion occurs.

---

# 24. Sixth CPC MACP Fixation

## Rule ID

`6CPC_MACP_FIXATION`

## Status

`VERIFIED_CORE_WITH_OPTION_CASES`

Working treatment follows the applicable MACPS fixation framework.

The core numerical effect under the 6th CPC generally resembles promotion fixation:

```text
Pay in Pay Band + Grade Pay
        ↓
applicable fixation increment
        ↓
higher financial Grade Pay
```

### Example structure

```text
PB-2
Pay in Band = ₹13,500
GP          = ₹4,200
Basic       = ₹17,700

MACP to GP ₹4,600

Applicable fixation increment
        ↓
new Pay in Band
        +
GP ₹4,600
```

### Option

DoPT clarifications recognize availability/revision of fixation option in applicable MACP cases.

Store the selected option explicitly.

---

# 25. Seventh CPC MACP Fixation

## Rule ID

`7CPC_MACP_FIXATION`

## Status

`VERIFIED_CORE`

MACP financial upgradation under the 7th CPC generally moves the employee to the applicable next financial Level under the governing scheme.

Core fixation pattern:

```text
Current Level
        ↓
one increment in current Level
        ↓
target financial Level
        ↓
equal / next higher Cell
```

### Example

```text
Level 6
Basic ₹42,300

Increment in Level 6
→ ₹43,600

MACP target Level 7

Equal / next higher Cell
→ ₹44,900

Result:
Level 7
₹44,900
```

The exact target Level must be derived from the applicable MACPS rule, not guessed from post hierarchy.

---

# 26. Regular Promotion After MACP

## Rule ID

`PROMOTION_AFTER_MACP`

## Status

`VERIFIED_CORE`

A later regular promotion does not automatically generate a second fixation benefit where the employee has already obtained the corresponding financial Grade Pay/Level and fixation benefit under MACPS, in the cases covered by the applicable DoPT instructions.

### Required decision logic

```text
Regular promotion occurs
        ↓
Was equivalent financial benefit already obtained under MACP?
        ↓
No → apply normal applicable promotion rule

Yes
        ↓
Is promotional Grade Pay/Level the same/equivalent one already granted?
        ↓
Yes → do not automatically grant duplicate fixation
```

### Preserve career event

Even when fresh fixation is suppressed:

```js
{
  careerEffect: "PROMOTED",
  payFixationEffect: "NO_FRESH_FIXATION"
}
```

### Narrow supported interaction

Rule ID:

`PROMOTION_AFTER_MACP_SAME_FINANCIAL_STRUCTURE`

Automatic suppression is limited to a regular promotion whose target financial
structure is exactly the same structure previously granted through a confirmed,
earlier MACP transformation:

- 6th CPC: same Pay Band and Grade Pay;
- 7th CPC: same Level.

Basic Pay equality alone is not evidence of this interaction. The calculation
must retain the matched MACP event ID/number and preserve the current pay and DNI.

An ordinary same-structure promotion without matching MACP history remains
invalid under the ordinary promotion-fixation rule. Cross-CPC equivalence must
remain `UNRESOLVED` unless explicit provenance establishes the equivalence.

---

# 27. NFSG / NFS / NFU

## Rule ID

`NON_FUNCTIONAL_UPGRADATION`

## Status

`PROVISIONAL_SCHEME_SPECIFIC`

### Principle

There is no safe universal NFSG/NFS/NFU calculation rule.

The event must specify:

```js
{
  subtype,
  schemeCode,
  cadre,
  ruleId
}
```

### Example

DoPT's material for the Non-Functional Selection Grade of Section Officers of CSS discusses its specific pay-fixation treatment and historical changes.

Therefore:

```text
NFSG
≠ automatically FR 22(I)(a)(1)
≠ automatically 3% promotion increment
```

### Invariant

If scheme is unknown:

```text
status = UNRESOLVED
```

Do not calculate.

---

# 28. MACP + Later NFSG / Promotion Interaction

## Rule ID

`MACP_DOUBLE_FIXATION_GUARD`

## Status

`VERIFIED_PRINCIPLE`

Before granting a fixation increment for a later NFSG/regular-promotion event:

```text
Check whether equivalent financial benefit/fixation
has already been granted through MACP.
```

Do not automatically grant a second increment merely because another career/status event occurs.

The precise application remains scheme-specific.

---

# 29. Ad Hoc Promotion

## Rule ID

`AD_HOC_PROMOTION`

## Status

`PROVISIONAL`

PayCheck must recognize ad hoc promotion as separate from regular promotion.

Do not automatically expose the same fixation options as regular promotion without a verified rule.

---

# 30. Ad Hoc Promotion Followed by Regular Promotion

## Rule ID

`AD_HOC_TO_REGULAR`

## Status

`PROVISIONAL — DO NOT AUTO-CALCULATE RETROSPECTIVE OPTION`

### Known domain principle

An earlier ad hoc spell and a later regular promotion/appointment to the same post without break can be legally linked and may affect pay protection/fixation depending on the governing order.

### Required event relationship

```js
{
  type: "REGULARISATION",
  relatesToEventId: "earlier_ad_hoc_event",
  continuousWithoutBreak: true
}
```

### Critical warning

Do not implement a universal rule that automatically grants retrospective exercise of fixation option from the original ad hoc promotion date until this treatment has been verified against authoritative instructions for the relevant factual pattern.

---

# 31. Pay Correction

## Rule ID

`PAY_CORRECTION_REPLAY`

## Status

`VERIFIED_ARCHITECTURAL_RULE`

This is primarily an engine rule.

If a historical pay fact is corrected:

```text
Correct opening/intermediate state
        ↓
invalidate all later derived states
        ↓
replay later events
        ↓
recalculate Due Pay
```

Do not add the monetary difference as a simple flat adjustment.

The corrected Basic Pay can alter:

- future increments;
- CPC transition fixation;
- promotion fixation;
- MACP fixation;
- DA;
- HRA;
- TA;
- retirement pay-derived benefits.

---

# 32. Notional Fixation

## Rule ID

`NOTIONAL_PROGRESSION`

## Status

`VERIFIED_DOMAIN_PRINCIPLE`

A period can affect pay progression without giving immediate monetary benefit.

The engine must separate:

```text
Pay fixation/progression
```

from:

```text
Monetary entitlement
```

Recommended flags:

```js
{
  notional: true,
  monetaryBenefit: false
}
```

Later actual pay may depend on the notionally progressed pay state.

---

# 33. Drawn Pay Rule

## Rule ID

`DRAWN_PAY_IS_HISTORICAL_FACT`

## Status

`VERIFIED_ARCHITECTURAL_RULE`

Drawn Pay must not be forced to conform to the legal Pay Structure.

If payroll historically paid an invalid amount, the app must permit the entry.

Structural validation applies to **Due Pay**, not to historical Drawn Pay.

---

# 34. Due–Drawn Rule

## Rule ID

`MONTHLY_DUE_DRAWN`

## Status

`VERIFIED_ARCHITECTURAL_RULE`

For each month:

```text
Difference = Due - Drawn
```

At component level:

```text
Basic difference
DA difference
HRA difference
TA difference
Other allowance difference
Gross difference
```

Positive:

```text
Arrear
```

Negative:

```text
Recovery
```

---

# 35. Allowance Rule Separation

Allowance logic must be independent from Basic Pay fixation.

The executable allowance foundation and unresolved-data boundaries are defined in [`allowance-model.md`](./allowance-model.md). Allowance-rule effective dates must be resolved independently from CPC Pay State dates. System rules require verified Government-rule provenance; user-defined allowances must retain `USER_DEFINED` provenance.

## 35.1 Dearness Allowance

Historical DA is notified data and must not be generated, interpolated, or selected by date without CPC context. Fifth, Sixth, and Seventh CPC payable series reset independently, including 0% reset records. A CPC transition never carries the previous series percentage forward.

For supported ordinary periods:

```text
DA raw amount = Basic Pay × applicable CPC-specific rate ÷ 100
```

Fractions of 50 paise or more round to the next higher rupee; fractions below 50 paise are ignored. This rounding is performed by dedicated integer-fraction logic.

The Fifth CPC Dearness Pay merger from 01 April 2004 is a structural break. Its residual DA rates are verified data, but monetary calculation remains unresolved until the Basic Pay/Dearness Pay calculation base is separately verified and implemented.

For payable Seventh CPC salary history, the 17% record continues through 30 June 2021 during the COVID freeze. Theoretical withheld instalments are not payable DA records. Payable DA becomes 31% from 01 July 2021.

## 35.2 House Rent Allowance

HRA is resolved independently by Pay History Segment date, CPC, dated HRA location class, dated eligibility, and—under revised Seventh CPC rules—the central DA lookup.

Supported rate families are:

```text
5th CPC: A-1 30%; A/B-1/B-2 15%; C 7.5%; UNCLASSIFIED 5%
6th CPC: X 30%; Y 20%; Z 10%
7th CPC from 01.07.2017:
  DA below 25%     → X/Y/Z 24/16/8
  DA at least 25%  → X/Y/Z 27/18/9
  DA at least 50%  → X/Y/Z 30/20/10
```

Revised Seventh CPC HRA must not be applied before 01 July 2017. The period from 01 January 2016 through 30 June 2017 remains unresolved until its continuation rule is verified.

The revised Seventh CPC monthly minimums are X ₹5,400, Y ₹3,600, and Z ₹1,800. The final result is the greater of the rounded percentage amount and applicable minimum, and the audit result records both branches.

No city name implies a class. HRA scheme/class must be explicitly supplied through dated location state, independently from Transport Allowance category. Explicit ineligibility or Government accommodation produces a resolved zero HRA result; detailed accommodation exceptions remain unsupported.

## 35.3 Transport Allowance

Transport Allowance is always auditable as:

```text
Base Transport Allowance
+ centrally resolved DA on Base Transport Allowance
= Total Transport Allowance
```

The supported Sixth CPC monetary brackets use Grade Pay and Pay in Pay Band. Grade Pay ₹5,400 and above receives the ₹3,200/₹1,600 bracket; Grade Pay ₹4,200/₹4,600/₹4,800 and lower Grade Pay with Pay in Pay Band at least ₹7,440 receive ₹1,600/₹800; lower Grade Pay below the ₹7,440 Pay-in-Band boundary receives ₹600/₹400. Rates are higher-rate-city/other-place pairs.

Revised Seventh CPC TA applies from 01 July 2017. Level 9 and above receives ₹7,200/₹3,600; Levels 3–8 receive ₹3,600/₹1,800; Levels 1–2 receive ₹1,350/₹900. A Level 1 or 2 employee with Basic Pay of at least ₹24,200 receives the Levels 3–8 rate. The revised table must not be applied before its effective date.

DA on TA always uses the employee Pay State's CPC-specific central DA rule. Raw DA-on-TA, rounded DA-on-TA, rounding operation, Base TA, and total remain separate result fields. HRA class never determines the TA city category.

Explicit ineligibility or Government transport resolves to zero. Fifth CPC TA, disability double rates, official-car options, and other special exclusion periods are not implemented.

Do not put DA/HRA/TA arithmetic inside:

```text
promotion()
increment()
cpcTransition()
```

Instead:

```text
Pay State
   ↓
Month Generator
   ↓
Allowance Engine
   ↓
Monthly Due Pay
```

The month generator is the Basic Pay history applicability layer. Event engines decide the legal Pay State and return auditable transformations; the history engine decides the inclusive calendar dates on which each successful replayed state applies. Future salary engines—not the history engine—will decide monetary entitlement or proration for those dates.

Accordingly, a month may contain multiple Basic Pay segments without calculating part-month salary. Unresolved events preserve the last known state while marking downstream periods as partially resolved, and no-fresh-fixation career events are retained as provenance without creating a financial segment.

This allows Basic Pay history to be tested independently.

---

# 36. Rule Interaction Priority

## Status

`PROVISIONAL_FRAMEWORK`

Same-date events must be processed in the legally required sequence.

Example:

```text
01.07
Annual increment in lower post
then promotion fixation from DNI
```

may require a different result from:

```text
Promotion fixation
then annual increment
```

Do not define a universal hard-coded order until the relevant rules are captured.

Each rule may declare:

```js
{
  sameDatePrerequisites: [],
  sameDatePriority: null
}
```

---

# 37. Hypothetical Fixation Comparison

## Rule ID

`OPTION_BRANCH_CALCULATION`

## Status

`VERIFIED_ARCHITECTURAL_RULE`

Where more than one legally available fixation option exists, PayCheck may calculate alternative branches.

Example:

```text
Branch A — fixation from promotion date
Branch B — fixation from DNI
```

Each branch should produce:

- pay trajectory;
- DNI trajectory;
- month-wise arrear/recovery;
- final Basic Pay;
- assumptions;
- applied rules.

PayCheck may state which branch produces a higher calculated amount.

It must not automatically state that an employee is legally entitled to revise/exercise an option unless the case facts support that entitlement.

---

# 38. Rule Registry — Initial IDs

Suggested initial rule IDs:

```text
5CPC_ANNUAL_INCREMENT
5CPC_TO_6CPC

6CPC_BASIC_PAY_IDENTITY
6CPC_ANNUAL_INCREMENT
6CPC_INCREMENT_ROUNDING
6CPC_DNI
6CPC_PROMOTION_FR22_I_A_1
6CPC_PROMOTION_FROM_EVENT_DATE
6CPC_PROMOTION_FROM_DNI
6CPC_MACP_FIXATION

6CPC_TO_7CPC_LEVEL_MAP
6CPC_TO_7CPC

7CPC_PAY_MATRIX
7CPC_ANNUAL_INCREMENT
7CPC_DNI_RULE10
7CPC_PROMOTION_RULE13
7CPC_PROMOTION_FROM_EVENT_DATE
7CPC_PROMOTION_FROM_DNI
7CPC_MACP_FIXATION

PROMOTION_AFTER_MACP
MACP_DOUBLE_FIXATION_GUARD

NON_FUNCTIONAL_UPGRADATION
AD_HOC_PROMOTION
AD_HOC_TO_REGULAR

PAY_CORRECTION_REPLAY
NOTIONAL_PROGRESSION
DRAWN_PAY_IS_HISTORICAL_FACT
MONTHLY_DUE_DRAWN
OPTION_BRANCH_CALCULATION
```

---

# 39. Required Rule Test Style

Every implemented calculation rule should have:

1. normal case;
2. lower boundary;
3. upper boundary;
4. rounding boundary;
5. same-date event case where relevant;
6. option A;
7. option B;
8. invalid input;
9. unresolved/unsupported case;
10. official worked example where available.

Example:

```js
describe("7CPC_PROMOTION_RULE13", () => {
  it("moves one cell in lower level then finds equal/next higher cell in target level");
  it("uses equal cell when exact value exists");
  it("uses next higher cell when exact value does not exist");
  it("rejects an invalid starting cell");
  it("does not search another level");
});
```

---

# 40. Rule Metadata Example

```js
{
  id: "7CPC_PROMOTION_RULE13",

  title: "Fixation of Pay on Promotion in Revised Pay Structure",

  implementationStatus: "VERIFIED",

  authority: {
    department: "Department of Expenditure",
    instrument: "CCS (Revised Pay) Rules, 2016",
    rule: "Rule 13"
  },

  effectiveFrom: "2016-01-01",
  effectiveTo: null,

  sourceReferences: [
    {
      title: "CCS (Revised Pay) Rules, 2016",
      url: "OFFICIAL_URL"
    }
  ],

  logicVersion: 1
}
```

---

# 41. Initial Official Source Register

The following official sources should be retained in the project source registry and pinned to individual rules as implementation proceeds.

## Department of Expenditure — 6th CPC

### CCS (Revised Pay) Rules, 2008

Official landing page:

https://doe.gov.in/ccs-revised-pay-rules-2008

Use for:

- revised pay structure;
- 5th → 6th CPC fixation;
- increment framework;
- DNI;
- First Schedule / pay structure.

### Fixation of Pay and Grant of Increments in Revised Pay Structure — 29.01.2009

https://doe.gov.in/files/pay_related_matters_documents/29_01_2009.pdf

Use for:

- 6th CPC increment;
- promotion fixation examples/clarifications.

### Clarifications on CCS (RP) Rules, 2008 — 13.09.2008

https://doe.gov.in/files/pay_related_matters_documents/13_09_2008.pdf

Use for:

- DNI transition questions and revised-pay clarifications.

### 1.86 Fitment Clarification / Order — 13.10.2008

https://doe.gov.in/files/pay_related_matters_documents/13_10_2008_0.pdf

Use for:

- 1.86 fixation treatment.

---

## Department of Expenditure — 7th CPC

### Seventh CPC / Revised Pay Order repository

https://doe.gov.in/order-central-pay-commission/16

Use to locate:

- CCS (Revised Pay) Rules, 2016;
- bunching;
- allowance orders;
- later clarifications.

### Fixation of Pay and Grant of Increment in Revised Pay Structure

https://doe.gov.in/files/cenetral-pay_document/7thCPC_PayFixation_revisedpaystructure.pdf

Use for:

- promotion fixation;
- Rule 10/Rule 13 related clarification.

### Rule 10 DNI clarifications

Department of Expenditure archive:

https://doe.gov.in/archive/pay-related-matters/93

Use for:

- DNI after appointment/promotion/financial upgradation;
- later Rule 10 clarifications.

---

## Department of Personnel & Training — Pay Fixation

### Pay Fixation on Promotion and Availability of Option

https://dopt.gov.in/sites/default/files/Pay%20Fixation%20-%20Information%20document_1.pdf

Use for:

- FR 22(I)(a)(1);
- fixation from promotion date vs DNI;
- option/revised option issues.

### Fundamental Rules compilation

https://dopt.gov.in/sites/default/files/Compilation_FR_SR_English.pdf

Use for:

- authoritative FR structure and cross-checking.

---

## Department of Personnel & Training — MACP

### MACP FAQ / Scheme Information

https://dopt.gov.in/sites/default/files/FAQMACPS_Estt_D.pdf

Use for:

- MACPS identity and scheme concepts.

### Regular Promotion after MACP — 08.09.2020

https://dopt.gov.in/sites/default/files/08092020macp.pdf

Use for:

- interaction between earlier MACP benefit and later regular promotion;
- prevention of duplicate fixation in covered cases.

---

## Department of Personnel & Training — NFS/NFSG

### Section Officer NFS Information Document

https://dopt.gov.in/sites/default/files/SO_NFS_Information_Document_061022.pdf

Use for:

- proof that NFS/NFSG treatment is scheme/cadre-specific;
- CSS Section Officer NFS history and fixation treatment.

---

## Department of Personnel & Training — Increment

### Increment Information Document

https://dopt.gov.in/sites/default/files/Increment%20-%20Information%20document.pdf

Use for:

- increment-related consolidated guidance;
- advance-increment cases where DNI option is not automatically available.

---

# 42. Items Requiring Explicit Domain Verification Before Coding

The following should remain open TODOs.

## TODO-R1 — Sixth CPC increment rounding

Pin the exact primary-text rounding mechanism and create boundary-value test cases.

Do not implement from informal recollection alone.

---

## TODO-R2 — Additional 5th CPC scale data

Add non-standard, intermediate, or special scales only when separately verified. The standard S-1 through S-34 dataset is implemented; it must not be extrapolated to unsupported scales.

---

## TODO-R3 — Complete 6th CPC → 7th CPC mapping

Validate all Levels, especially Levels 15–18 and non-Grade-Pay structures.

---

## Implemented-R4 — Sixth CPC promotion/MACP from DNI

For an ordinary supported same-Pay-Band case, interim Pay in Pay Band remains unchanged and the target Grade Pay applies from the promotion/MACP date through the day before lower-post DNI. On DNI, the engine calculates the lower-post annual increment from the pre-event Basic Pay, adds it to lower Pay in Pay Band, then calculates the promotion/MACP increment sequentially from the resulting lower-post Basic Pay. Only then is target Grade Pay substituted. Both increments use the existing Sixth CPC rounding helper.

Cross-Pay-Band interim treatment remains unresolved because an unchanged lower Pay in Pay Band is not forced into a different band without a verified adjustment rule. The subsequent 1 July candidate is resolved only with explicit qualifying-service evidence.

---

## Implemented-R5 — Seventh CPC promotion/MACP from DNI

Interim placement searches the target Level using the unchanged lower-Level Basic Pay, selecting an exact Cell or immediate next higher Cell without first granting a lower-Level increment. On lower-post DNI, the engine returns to the original lower-Level trajectory, moves exactly two Cells—annual increment first and promotion/MACP increment second—and searches the target Level again using the resulting reference amount.

The regression Level 4 ₹29,600 → interim Level 5 ₹30,100 → lower-Level ₹30,500 → ₹31,400 → final Level 5 ₹31,900 is executable without changing Pay Matrix data. Final fixation on 1 July produces a 1 January candidate; fixation on 1 January produces a 1 July candidate, subject to qualifying service.

---

## TODO-R6 — Ad hoc → regular promotion

Research and formalize:

- when option becomes available;
- whether it can relate back to ad hoc promotion date;
- pay protection;
- effect of break/non-break;
- difference between confirmation, regularisation and regular promotion.

Until resolved:

```text
PROVISIONAL
```

---

## Implemented-R7 — Confirmed 5th CPC ACP fixation

ACP 1/2 pay fixation is implemented for externally confirmed events with confirmed target scales. Automatic eligibility, service-length determination, and hierarchy discovery remain open.

---

## TODO-R8 — NFSG / NFS / NFU

Implement only scheme-specific modules.

First possible module:

```text
CSS Section Officer NFS
```

after full rule verification.

---

## TODO-R9 — Penalty / withholding / EOL

These events should remain unsupported for automatic calculation until detailed rule matrices are created.

---

# 43. Copilot Guardrail

The following instruction should accompany future coding prompts:

> Read `docs/pay-domain-model.md` and `docs/pay-rules.md` before modifying any calculation code. Do not create or infer Government pay rules that are absent from `pay-rules.md`. If a required rule is marked PROVISIONAL or UNSUPPORTED, stop at the domain/UI representation and do not invent a calculation formula.

---

# 44. Current Rule Confidence Summary

| Rule area | Status |
|---|---|
| 5th CPC valid-stage concept | Verified concept |
| 5th CPC increment progression | Verified concept |
| 5th CPC regular promotion from event date | Implemented ordinary stage-based scope |
| 5th CPC regular promotion from lower-post DNI | Recognized; interim/final rule unresolved |
| 5th CPC confirmed ACP 1/2 fixation | Implemented; eligibility externally confirmed |
| ACP normal applicability through 31.08.2008 | Verified lifecycle boundary |
| MACPS applicability from 01.09.2008 | Verified lifecycle boundary |
| 6th/7th CPC immediate MACP target validation | Implemented controlled hierarchy |
| Automatic ACP entitlement | Not implemented |
| 5th → 6th normal fitment | Verified core |
| 6th CPC Basic Pay identity | Verified |
| 6th CPC annual increment | Verified core |
| 6th CPC increment rounding boundaries | **Needs exact test specification** |
| 6th CPC common DNI | Verified core |
| FR 22(I)(a)(1) promotion option | Verified core |
| 6th CPC promotion from event date | Verified core |
| 6th CPC promotion/MACP from DNI | Implemented ordinary same-band scope |
| 6th → 7th normal fitment | Verified core |
| 7th CPC Pay Matrix increment | Verified |
| 7th CPC Rule 10 DNI | Verified core; clarifications required |
| 7th CPC Rule 13 promotion fixation | Verified core |
| 7th CPC promotion/MACP from DNI | Implemented ordinary supported scope |
| MACP identity | Verified |
| 6th CPC MACP fixation | Verified core |
| 7th CPC MACP fixation | Verified core |
| Promotion after equivalent MACP | Verified core |
| NFSG/NFS/NFU | Scheme-specific / provisional |
| Ad hoc → regular retrospective option | **Provisional** |
| Historical pay correction replay | Verified architectural rule |
| Notional progression | Verified domain principle |
| Due–drawn comparison | Verified architectural rule |

---

# 45. Final Rule Principle

PayCheck must prefer:

```text
UNRESOLVED
```

over:

```text
plausible but unverified calculation
```

The value of the application depends on the ability to explain and reproduce every result.

A smaller set of thoroughly verified rules is preferable to broad but unreliable automation.

---

# 46. Due Pay monthly aggregation boundary

Due Pay may aggregate Basic Pay and resolved allowances for a complete calendar month only when the month contains one financial segment. If the calculation period covers only part of a month, or a pay, location, eligibility, allowance-rate, or Custom Allowance boundary splits the month, the result must be:

```text
PARTIALLY_RESOLVED
MONTHLY_PRORATION_RULE_NOT_IMPLEMENTED
```

No daily-rate or day-count divisor is currently verified. Therefore the engine must retain the segment calculations for audit but must not publish a final monthly Gross Due. Unresolved pay or allowance components similarly prevent final aggregation and must never be treated as zero.

---

# 47. Executable shared DNI rules

The shared DNI resolver implements only the documented boundaries below:

- 5th CPC ordinary annual increment preserves the confirmed individual DNI month and day in the following year. An invalid preserved date, including 29 February followed by a non-leap year, remains unresolved.
- 6th CPC ordinary DNI is 1 July. Promotion, MACP, and initial-appointment candidates may be identified, but become resolved only when qualifying service is explicitly established.
- 7th CPC Rule 10 maps 1 January to 1 July of the same year; 2 January through 1 July to 1 January of the following year; and 2 July through 31 December to 1 July of the following year.
- Normal 7th CPC transition on 1 January 2016 resolves the first DNI as 1 July 2016. A delayed switch remains unresolved.
- A successful ordinary increment continues on the same January or July annual branch and no second ordinary increment is granted in the same year/cycle.
- A promotion after equivalent MACP with no fresh fixation preserves the existing DNI.
- Fixation from the lower-post DNI remains recognized but unresolved.
- Explicit EOL, non-qualifying service, withheld increment, penalty reduction, break in service, or suspension does not trigger an inferred result; eligibility remains unresolved until a verified rule is implemented.
- An annual increment and promotion/MACP on the same date remain unresolved because no event-ordering rule is documented.

Every decision exposes rule provenance, candidate date, eligibility assessment, final date or unresolved reason, and explanation. These rules select dates only; they do not alter the existing monetary fixation, matrix placement, allowance, or ledger formulas.

---

# 48. Deferred fixation from lower-post DNI

`6CPC_PROMOTION_FROM_DNI`, `6CPC_MACP_FROM_DNI`, `7CPC_PROMOTION_FROM_DNI`, and `7CPC_MACP_FROM_DNI` are implemented for ordinary supported cases. One event produces an interim state on the career/upgradation date and a final state on the resolved lower-post DNI. MACP identity, number, and `reachedBy` provenance remain distinct from regular promotion.

The lower-post annual increment is an atomic step inside final fixation and is recorded as consumed. A separate user annual-increment event on the same date cannot grant it again. Promotion after equivalent MACP with `NO_FRESH_FIXATION` continues to take precedence and preserves DNI.

Missing or unresolved lower-post DNI, event dates on/after that DNI, insufficient lower-Level Cells, invalid targets, unsupported adverse service conditions, and Sixth CPC cross-band interim cases remain structured unresolved results. Ad-hoc promotion, automatic option selection, EOL/penalty computation, and salary proration remain outside scope.
