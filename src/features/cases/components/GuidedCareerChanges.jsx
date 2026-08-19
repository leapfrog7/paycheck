import {
  ANNUAL_INCREMENT_TREATMENTS,
  OTHER_CHANGE_TYPES,
} from '../models/buildGuidedExpectedPay'

const incrementChoices = [
  { value: ANNUAL_INCREMENT_TREATMENTS.INCLUDE, icon: '📈', title: 'Yes, include routine increments', description: 'PayCheck will add yearly increments from the date you entered.' },
  { value: ANNUAL_INCREMENT_TREATMENTS.EXCLUDE, icon: '➖', title: 'No routine increments', description: 'Opening Basic Pay will continue unchanged unless another event is added.' },
  { value: ANNUAL_INCREMENT_TREATMENTS.UNSURE, icon: '🤔', title: 'I’m not sure', description: 'We’ll keep the estimate cautious and flag this for review.' },
]

const otherChoices = [
  { value: OTHER_CHANGE_TYPES.PROMOTION, icon: '🎖️', title: 'Promotion', description: 'A regular or ad-hoc promotion changed the pay position.' },
  { value: OTHER_CHANGE_TYPES.MACP_ACP, icon: '🪜', title: 'MACP / ACP', description: 'A financial upgradation occurred during this period.' },
  { value: OTHER_CHANGE_TYPES.PAY_REVISION, icon: '🔄', title: 'Pay revision', description: 'A CPC switch or another pay-structure change applied.' },
  { value: OTHER_CHANGE_TYPES.PAY_CORRECTION, icon: '✏️', title: 'Pay correction', description: 'Pay was refixed, corrected, or applied notionally.' },
  { value: OTHER_CHANGE_TYPES.NONE, icon: '✓', title: 'Nothing else changed', description: 'There were no other pay-changing events in this period.' },
  { value: OTHER_CHANGE_TYPES.UNSURE, icon: '💡', title: 'I’m not sure', description: 'Continue now and review possible changes in the workspace.' },
]

export default function GuidedCareerChanges({ value, onChange, error, errorId }) {
  const review = value ?? { annualIncrementTreatment: '', otherChanges: [] }

  function selectOther(change) {
    const exclusive = [OTHER_CHANGE_TYPES.NONE, OTHER_CHANGE_TYPES.UNSURE]
    if (exclusive.includes(change)) {
      onChange({ ...review, otherChanges: [change] })
      return
    }
    const current = review.otherChanges.filter((item) => !exclusive.includes(item))
    onChange({
      ...review,
      otherChanges: current.includes(change)
        ? current.filter((item) => item !== change)
        : [...current, change],
    })
  }

  return (
    <div className="career-review">
      <fieldset>
        <legend>Should routine annual increments be included?</legend>
        <p>Use the next increment date from the previous step to replay ordinary yearly progression.</p>
        <div className="career-choice-grid career-choice-grid--three">
          {incrementChoices.map((choice) => (
            <button
              key={choice.value}
              type="button"
              className={review.annualIncrementTreatment === choice.value ? 'selected' : ''}
              aria-pressed={review.annualIncrementTreatment === choice.value}
              onClick={() => onChange({ ...review, annualIncrementTreatment: choice.value })}
            >
              <span aria-hidden="true">{choice.icon}</span>
              <strong>{choice.title}</strong>
              <small>{choice.description}</small>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Did anything else change during this period?</legend>
        <p>Select all that apply. You’ll add the exact dates and fixation details next.</p>
        <div className="career-choice-grid">
          {otherChoices.map((choice) => {
            const selected = review.otherChanges.includes(choice.value)
            return (
              <button
                key={choice.value}
                type="button"
                className={selected ? 'selected' : ''}
                aria-pressed={selected}
                onClick={() => selectOther(choice.value)}
              >
                <span aria-hidden="true">{choice.icon}</span>
                <strong>{choice.title}</strong>
                <small>{choice.description}</small>
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="career-safety-note">
        <span aria-hidden="true">🛡️</span>
        <p><strong>No guessed fixation.</strong> PayCheck adds only confirmed routine increments here. Promotions, MACP, revisions, and corrections require their actual details.</p>
      </div>
      {error ? <p id={errorId} className="field-error" role="alert">{error}</p> : null}
    </div>
  )
}
