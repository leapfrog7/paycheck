import { SEVENTH_CPC_LEVELS } from '../../../data/pay/7cpcPayMatrix'

export default function SeventhCpcLevelOptions({ levels = SEVENTH_CPC_LEVELS }) {
  return levels.map(({ level }) => <option key={level} value={level}>Level {level}</option>)
}
