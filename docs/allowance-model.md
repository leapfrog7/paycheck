# PayCheck Allowance Model

> **Scope boundary:** This allowance model derives components of Due Pay. User-entered Drawn Pay components and other-allowance labels are historical facts; they do not have to correspond to these rule definitions and are not recalculated when allowance rules change.

## Status and boundary

This document establishes the allowance architecture. It does not establish complete historical entitlement and does not implement monthly gross pay, Due Pay, Drawn Pay, arrears, recovery, or salary proration.

```text
Pay History Segment
        ↓
Allowance Rule Resolution
        ↓
Allowance Calculation
        ↓
Allowance Result
```

Pay-event engines determine the legal Pay State. The Pay History engine determines the calendar dates on which that state applies. Allowance engines independently resolve the allowance rule, location, and eligibility applicable during those dates.

## Independent timelines

An allowance-rule timeline is not the CPC pay timeline. For example, 7th CPC pay fixation may apply from 01 January 2016 while revised HRA and Transport Allowance rules apply from a different notified date. A pay transformation must never implicitly activate an allowance rule.

Allowance processing will eventually intersect:

- Pay History Segment dates;
- allowance-rule effective dates;
- posting/location-state dates;
- allowance-eligibility dates; and
- custom-allowance definition dates.

No full intersection ledger is implemented in this foundation phase.

## Common Allowance Result

Every allowance engine returns the common shape created by `createAllowanceResult`:

```js
{
  allowanceCode,
  name,
  effectiveFrom,
  effectiveTo,
  calculationType,
  inputs,
  rate,
  amount,
  components,
  ruleId,
  status, // RESOLVED | PARTIALLY_RESOLVED | UNRESOLVED
  unresolvedReasons,
  provenance: {
    sourceType, // SYSTEM_RULE | USER_DEFINED
    authority,
    ruleEffectiveFrom,
    definitionId
  }
}
```

The contract supports fixed, percentage, rule/slab lookup, dependent, and user-defined calculations without requiring irrelevant fields. Missing classification, category, rate, or authority data must result in structured unresolved output.

## System rules and user-defined allowances

DA, HRA, and Transport Allowance are system-rule families. Their resolved results use `sourceType: SYSTEM_RULE` and must cite verified rule provenance.

Custom allowances always use `sourceType: USER_DEFINED`. They may be fixed monthly, percentage of Basic Pay, percentage of Basic Pay plus DA, or a manual monthly amount. They must never be presented as verified Government rules. Future calculation modes are represented by extensible constants rather than changing the result contract.

### Custom Allowance definitions and versions

A Pay Case stores zero or more effective-dated Custom Allowance definitions:

```js
{
  id,                 // stable definition/version identity
  seriesId,           // logical allowance identity across versions
  name,
  sourceType: "USER_DEFINED",
  calculationType,
  amount,
  rate,
  effectiveFrom,
  effectiveTo,
  status: "ACTIVE" | "INACTIVE",
  metadata: { description, note, reference }
}
```

Rate or amount changes are separate definitions sharing a `seriesId`. Inclusive date ranges in the same series must not overlap; `CUSTOM_ALLOWANCE_DATE_RANGE_OVERLAP` is returned instead of selecting a version arbitrarily. Different allowance series may overlap normally.

Implemented calculation modes are:

- `FIXED_MONTHLY`: the entered amount applies unchanged throughout the definition range;
- `PERCENTAGE_OF_BASIC`: the rounded percentage of segment Basic Pay;
- `PERCENTAGE_OF_BASIC_PLUS_DA`: the rounded percentage of Basic Pay plus DA obtained from the existing central DA lookup/calculator;
- `MANUAL_MONTHLY_AMOUNT`: an explicit amount for its dated period, allowing separate monthly entries including zero.

If DA cannot be resolved, the Basic-plus-DA mode is unresolved and never falls back to Basic Pay alone. Negative values, non-finite values, missing dates, invalid ranges, unsupported modes, and percentage precision beyond two decimal places are rejected. Zero is valid.

Every result retains `definitionId`, `allowanceSeriesId`, user metadata, and `sourceType: USER_DEFINED`; Government authority is always null. User-entered references remain unverified user metadata. Out-of-range and inactive definitions return `NOT_APPLICABLE`, not a calculated zero or an invented error amount.

Future extension constants include `SLAB_BASED`, `PER_DAY`, and `PERCENTAGE_OF_CUSTOM_BASE`, but these modes and formula scripting are not executable.

## Dearness Allowance

DA is a notified, CPC-specific effective-date series. Lookup keys are both `date` and `cpc`; there is no “latest rate” fallback and rates are never generated, interpolated, or carried across CPC series.

The production table contains the domain-owner-supplied mainline payable rates: 21 Fifth CPC records, 21 Sixth CPC records, and 18 Seventh CPC records. Rates are literal notified-data entries; they are never generated or interpolated. The schema supports:

- exceptional periods of any duration;
- open or explicit `effectiveTo` boundaries;
- CPC-specific resets;
- authority and rule identifiers;
- `DA` versus `DEARNESS_PAY`; and
- Basic Pay or Basic Pay-plus-Dearness-Pay calculation bases.

Each CPC series resets independently: Fifth CPC on 01 January 1996, Sixth CPC on 01 January 2006, and Seventh CPC on 01 January 2016. A lookup always requires both date and CPC. The final supplied Fifth and Sixth CPC mainline records have explicit dataset coverage ends so they cannot become fabricated legacy-continuation rates. The current Seventh CPC record remains open until superseded by verified data.

Record `effectiveTo` is derived from the day before the next supplied effective date. During the COVID freeze, the payable 17% record beginning 01 July 2019 therefore continues through 30 June 2021; theoretical withheld instalments are not payable-rate records. The next payable record begins at 31% on 01 July 2021.

The 01 April 2004 Fifth CPC record is a structural Dearness Pay merger marker with residual DA of 11%. Its rate is verified, but its executable calculation basis is `PROVISIONAL`. Lookup may return it; monetary calculation returns `5CPC_DEARNESS_PAY_CALCULATION_BASE_NOT_IMPLEMENTED`. This demonstrates that verified rate data and verified calculation basis are separate statuses.

For verified ordinary Fifth CPC pre-merger, Sixth CPC, and Seventh CPC records, DA uses Basic Pay as its base. Monetary results use integer fraction arithmetic: a fraction of 50 paise or more rounds to the next rupee and a smaller fraction is ignored.

Dataset-level authority is recorded as Government of India, Ministry of Finance, Department of Expenditure. Individual references remain `RATE_VERIFIED_REFERENCE_PENDING`; no OM identifiers or dates have been invented.

## House Rent Allowance

HRA classifications belong to their period scheme:

- 5th CPC: A-1, A, B-1, B-2, C, UNCLASSIFIED;
- 6th CPC: X, Y, Z;
- 7th CPC: X, Y, Z.

The supplied rate families are executable verified rule data with Department of Expenditure family-level provenance. Historical city mappings remain unpopulated: the applicable dated location state must explicitly supply both the scheme and HRA class. The Transport Allowance category is a separate value and is never used to infer HRA classification.

The supported mainline scheme timelines are:

- Fifth CPC classification rates from 01 January 1996 through 31 December 2005: A-1 30%, A/B-1/B-2 15%, C 7.5%, and UNCLASSIFIED 5%;
- Sixth CPC rates from 01 January 2006 through 31 December 2015: X 30%, Y 20%, and Z 10%;
- revised Seventh CPC HRA from 01 July 2017: X/Y/Z at 24/16/8 below 25% DA, 27/18/9 from 25% DA, and 30/20/10 from 50% DA.

Seventh CPC threshold selection calls the central CPC-specific DA lookup. No DA rates or threshold calendar dates are duplicated inside HRA. A Seventh CPC Pay State between 01 January 2016 and 30 June 2017 returns `7CPC_PRE_JULY_2017_HRA_RULE_NOT_IMPLEMENTED` because the continuation rule is not yet verified in this repository.

For revised Seventh CPC HRA, percentage calculation is compared explicitly with monthly floors of ₹5,400 for X, ₹3,600 for Y, and ₹1,800 for Z. Results retain percentage amount, minimum amount, whether the floor applied, and final amount. The common monetary convention is reused: fractions below 50 paise are ignored and 50 paise or more round upward.

HRA eligibility is dated and explicit. `eligible: false` or `governmentAccommodation: true` produces a resolved zero result with the eligibility reason. Missing eligibility or HRA location data remains unresolved. Detailed accommodation exceptions are outside this phase.

## Location history

Location is dated state, not one case-wide city class:

```js
{
  city,
  effectiveFrom,
  effectiveTo,
  hra: { scheme, class },
  transport: { category },
  source: "EXPLICIT_SELECTION"
}
```

`hra.class` and `transport.category` are separate because their classifications are different rule systems. Transfers can later add location-history entries without embedding allowance calculations in the transfer event.

## Transport Allowance

Transport Allowance output must preserve two components:

```text
Base Transport Allowance
+ DA on Transport Allowance
= Total Transport Allowance
```

TA references the central DA lookup; it must not derive its own DA rate.

The ordinary Transport Allowance engine is implemented for the verified Sixth CPC table from 01 September 2008 through the pre-revised-7th-CPC period ending 30 June 2017, and for revised Seventh CPC TA from 01 July 2017. City-list versions and historical city mappings are not encoded; dated location state must explicitly provide `HIGHER_RATE_CITY` or `OTHER_PLACE` independently from the HRA class.

Sixth CPC Base TA resolution uses the actual Pay Band, Grade Pay, and Pay in Pay Band:

- Grade Pay ₹5,400 and above: ₹3,200 / ₹1,600;
- Grade Pay ₹4,200, ₹4,600, or ₹4,800: ₹1,600 / ₹800;
- Grade Pay below ₹4,200 with Pay in Pay Band at least ₹7,440: ₹1,600 / ₹800;
- Grade Pay below ₹4,200 with Pay in Pay Band below ₹7,440: ₹600 / ₹400.

The ₹7,440 boundary applies to Pay in Pay Band, never Basic Pay. PB-2 and PB-3 Grade Pay ₹5,400 states retain their Pay Band provenance while resolving through the same Grade Pay threshold.

Revised Seventh CPC Base TA uses Level brackets:

- Level 9 and above: ₹7,200 / ₹3,600;
- Levels 3–8: ₹3,600 / ₹1,800;
- Levels 1–2: ₹1,350 / ₹900;
- Levels 1–2 with Basic Pay at least ₹24,200: enhanced ₹3,600 / ₹1,800.

In each pair the first amount is for a higher-rate city and the second for another place. The ₹24,200 test uses Basic Pay directly and applies only with the revised table from 01 July 2017. A Seventh CPC segment before that date returns `7CPC_PRE_JULY_2017_TRANSPORT_ALLOWANCE_RULE_NOT_IMPLEMENTED`.

Every resolved result retains Base TA and DA on TA separately. DA is obtained from the central CPC-specific DA lookup, rounded with the shared monetary helper, and then added to Base TA. Thus the Base TA rule timeline and DA timeline remain independent.

Explicit ineligibility or Government transport produces resolved zero components. Missing dated eligibility or TA category is unresolved. Double-rate disability rules, official-car options, whole-month leave/tour/training/deputation exclusions, and Fifth CPC TA remain separate deferred rule families; explicit special-condition data produces unresolved output rather than ordinary TA.

## Eligibility history

Eligibility is also dated. Each allowance has an `eligible` value and an extensible `conditions` object. Initial condition slots include Government accommodation and Government transport. Future leave, suspension, deputation, or non-admissible-period facts can be added without replacing the dated-state model.

## Registry and engine contract

The allowance registry maps allowance codes to independent engine descriptors. Calculators will eventually consume:

```js
{
  payHistorySegment,
  applicableLocationState,
  applicableEligibilityState,
  allowanceRuleData,
  customAllowanceDefinitions
}
```

The registry marks DA, HRA, Transport Allowance, and Custom Allowance as `IMPLEMENTED`. No React state is part of the calculation contract.

## Due Pay ledger

The first Due Pay ledger is a deterministic composition layer. It replays the Opening Pay State and service events into Pay History, then splits each month at every effective-date boundary that can alter money: pay, DA, HRA scheme, Transport Allowance rule, location, eligibility, and active Custom Allowance versions. Duplicate boundaries are collapsed and the resulting inclusive segments must cover the case period without gaps or overlaps.

Each financial segment carries the applicable Pay State, location state, eligibility state, custom definitions, unresolved-event contamination, and source/rule provenance. The existing allowance registry calculators are then invoked independently. Basic Pay is included exactly once; a resolved zero allowance remains distinct from an unresolved allowance.

A full-month aggregate remains automatic when one resolved segment covers the complete calendar month. Partial segments now pass each full monthly component through the controlled proration layer. No divisor or method is implicit: without an applicable system/user decision the component returns `PRORATION_BASIS_NOT_CONFIRMED`, the month remains `PARTIALLY_RESOLVED`, and Gross Due is null. Unknown values are never converted to zero.

Proration operates after each existing allowance formula. DA and HRA therefore use their ordinary full-month bases before their final amounts are prorated. Transport Allowance is atomic at its existing final Base TA plus DA-on-TA amount and is prorated once. Custom definitions may optionally carry `prorationPolicy`; existing definitions without that field remain backward-compatible and require an applicable case/month/component decision for partial periods. Supported explicit definition policy `FULL_MONTH` is user-confirmed full-amount treatment, while missing or unusable custom policy remains `CUSTOM_ALLOWANCE_PRORATION_NOT_CONFIRMED`.

User-confirmed proration decisions are case input and retain their source, reference, note, warnings, and stable IDs. Due Pay remains derived and recalculates when pay, events, allowance inputs, or proration policy changes. Drawn Pay remains independent historical fact, so the existing comparison engine needs no proration-specific arithmetic.

Current output is Due Pay only. Drawn Pay, deductions, due-drawn comparison, arrears/recovery, and export remain outside this phase.
