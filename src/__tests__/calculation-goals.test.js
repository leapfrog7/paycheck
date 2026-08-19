import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CALCULATION_GOALS, getCalculationGoal } from '../data/calculationGoals'
import CalculationGoalDialog from '../features/cases/components/CalculationGoalDialog'
import { createEmptyPayCase, normalizeCaseInput } from '../features/cases/models/payCase'

describe('calculation goals', () => {
  it('offers distinct user intentions before collecting case data', () => {
    const markup = renderToStaticMarkup(createElement(CalculationGoalDialog, {
      onChoose: () => {}, onClose: () => {},
    }))

    expect(CALCULATION_GOALS).toHaveLength(4)
    expect(markup).toContain('What do you want to know?')
    expect(markup).toContain('Calculate arrears or recovery')
    expect(markup).toContain('Check promotion or MACP fixation')
  })

  it('persists the selected intention through normal case normalization', () => {
    const payCase = createEmptyPayCase({ calculationGoal: 'CHECK_CURRENT_PAY' })
    const normalized = normalizeCaseInput(payCase)

    expect(normalized.calculationGoal).toBe('CHECK_CURRENT_PAY')
    expect(getCalculationGoal(normalized.calculationGoal).workspaceStep).toBe('history')
  })
})
