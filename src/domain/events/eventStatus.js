export const EVENT_STATUS = {
  DRAFT: 'DRAFT',
  PLANNED: 'PLANNED',
  CONFIRMED: 'CONFIRMED',
  PROVISIONAL: 'PROVISIONAL',
  UNRESOLVED: 'UNRESOLVED',
  CANCELLED: 'CANCELLED',
}

export const DATA_PROVENANCE_STATUS = {
  CONFIRMED: 'CONFIRMED',
  DERIVED: 'DERIVED',
  ASSUMED: 'ASSUMED',
  UNRESOLVED: 'UNRESOLVED',
}

export const EVENT_STATUS_OPTIONS = [
  { value: EVENT_STATUS.PLANNED, label: 'Planned' },
  { value: EVENT_STATUS.CONFIRMED, label: 'Confirmed' },
  { value: EVENT_STATUS.PROVISIONAL, label: 'Provisional' },
  { value: EVENT_STATUS.UNRESOLVED, label: 'Unresolved' },
  { value: EVENT_STATUS.CANCELLED, label: 'Cancelled' },
]

export const DATA_PROVENANCE_OPTIONS = [
  { value: DATA_PROVENANCE_STATUS.CONFIRMED, label: 'Confirmed' },
  { value: DATA_PROVENANCE_STATUS.DERIVED, label: 'Derived' },
  { value: DATA_PROVENANCE_STATUS.ASSUMED, label: 'Assumed' },
  { value: DATA_PROVENANCE_STATUS.UNRESOLVED, label: 'Unresolved' },
]
