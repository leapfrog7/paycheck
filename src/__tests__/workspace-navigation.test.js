import { describe, expect, it } from 'vitest'
import {
  resolveWorkspaceStep,
  withWorkspaceStep,
  WORKSPACE_STEP_IDS,
} from '../features/cases/models/workspaceNavigation'

describe('workspace navigation', () => {
  it('accepts every supported section and rejects unknown values', () => {
    for (const step of WORKSPACE_STEP_IDS) expect(resolveWorkspaceStep(step)).toBe(step)
    expect(resolveWorkspaceStep('technical-internals')).toBe('overview')
  })

  it('preserves unrelated query parameters when changing section', () => {
    const next = withWorkspaceStep(new URLSearchParams('mode=audit&step=history'), 'drawn')

    expect(next.get('step')).toBe('drawn')
    expect(next.get('mode')).toBe('audit')
  })
})
