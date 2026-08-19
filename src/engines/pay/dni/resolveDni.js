import { createResolvedDniDecision, createUnresolvedDniDecision, readDniDecision } from '../../../domain/pay/dni/dniDecision'
import { resolve5CpcDni } from './resolve5cpcDni'
import { resolve6CpcDni } from './resolve6cpcDni'
import { resolve7CpcDni } from './resolve7cpcDni'
import { dniTrigger } from './dniResolverUtils'

export function resolveDateOfNextIncrement(input = {}) {
  const { payState = {}, triggeringEvent = {}, context = {} } = input
  if (triggeringEvent.payFixationEffect === 'NO_FRESH_FIXATION' || context.payFixationEffect === 'NO_FRESH_FIXATION') {
    const existing = readDniDecision(payState)
    if (existing?.status === 'RESOLVED') {
      return createResolvedDniDecision({ ...existing, cpc: payState.cpc, date: existing.date, ruleId: 'DNI_EFFECT_NONE', trigger: dniTrigger(triggeringEvent), qualifyingService: existing.qualifyingService, explanation: 'No fresh fixation occurred, so the existing DNI is preserved.' })
    }
    return createUnresolvedDniDecision({ cpc: payState.cpc, ruleId: 'DNI_EFFECT_NONE', trigger: dniTrigger(triggeringEvent), reason: existing?.reason ?? 'EXISTING_DNI_UNRESOLVED', explanation: 'No fresh fixation occurred; the existing unresolved DNI is preserved.' })
  }
  if (Number(payState.cpc) === 5) return resolve5CpcDni(input)
  if (Number(payState.cpc) === 6) return resolve6CpcDni(input)
  if (Number(payState.cpc) === 7) return resolve7CpcDni(input)
  return createUnresolvedDniDecision({ cpc: payState.cpc, ruleId: 'DNI_RESOLVER', trigger: dniTrigger(triggeringEvent), reason: 'UNSUPPORTED_CPC_DNI_RULE', explanation: 'No DNI resolver exists for the supplied CPC.' })
}
