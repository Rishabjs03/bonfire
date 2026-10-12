import { useGameStore } from '../store/gameStore'
import { hasPeople, presenceLabel } from './presenceLabel'

export function OnlineCounter() {
  const netStatus = useGameStore((s) => s.netStatus)
  const onlineCount = useGameStore((s) => s.onlineCount)
  const count = Math.max(1, onlineCount)
  return (
    <div className="panel pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full py-1.5 pl-3 pr-3.5 text-[12.5px] font-medium text-ink">
      {hasPeople(netStatus, count) && <span className="ember-dot" aria-hidden />}
      <span className="tabular">{presenceLabel(netStatus, count, true)}</span>
    </div>
  )
}
