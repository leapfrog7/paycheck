export const WORKSPACE_STEP_IDS = Object.freeze([
  'overview',
  'basics',
  'history',
  'events',
  'allowances',
  'drawn',
  'result',
])

export function resolveWorkspaceStep(value, fallback = 'overview') {
  return WORKSPACE_STEP_IDS.includes(value) ? value : fallback
}

export function withWorkspaceStep(searchParams, step) {
  const next = new URLSearchParams(searchParams)
  next.set('step', resolveWorkspaceStep(step))
  return next
}
