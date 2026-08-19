export const CALCULATION_GOALS = Object.freeze([
  Object.freeze({
    id: 'ARREARS_RECOVERY',
    title: 'Calculate arrears or recovery',
    description: 'Compare the salary you should have received with what you were actually paid.',
    reassurance: 'Start with your period and opening pay. Drawn Pay comes later.',
    icon: 'calculator',
    finalAction: 'Build Expected Pay',
    workspaceStep: 'history',
    recommended: true,
  }),
  Object.freeze({
    id: 'CHECK_CURRENT_PAY',
    title: 'Check my correct pay',
    description: 'Reconstruct your pay history and see the Basic Pay that applies now.',
    reassurance: 'You do not need Drawn Pay for this check.',
    icon: 'check',
    finalAction: 'Check My Pay',
    workspaceStep: 'history',
  }),
  Object.freeze({
    id: 'CHECK_FIXATION',
    title: 'Check promotion or MACP fixation',
    description: 'Review how a promotion or financial upgradation changes your pay.',
    reassurance: 'Add the change after confirming your opening pay.',
    icon: 'history',
    finalAction: 'Continue to Career Changes',
    workspaceStep: 'events',
  }),
  Object.freeze({
    id: 'BUILD_PAY_HISTORY',
    title: 'Build my pay history',
    description: 'Create a month-wise record across increments, revisions and career changes.',
    reassurance: 'Build the timeline gradually and save it for later.',
    icon: 'document',
    finalAction: 'Build Pay History',
    workspaceStep: 'history',
  }),
])

export function getCalculationGoal(goalId) {
  return CALCULATION_GOALS.find(({ id }) => id === goalId) ?? CALCULATION_GOALS[0]
}
