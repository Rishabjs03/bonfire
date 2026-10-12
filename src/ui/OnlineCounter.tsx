import { useGameStore } from '../store/gameStore'
import { presenceLabel } from './presenceLabel'

export function OnlineCounter() {
  const netStatus = useGameStore((s) => s.netStatus)
  const onlineCount = useGameStore((s) => s.onlineCount)
  return (
    <div className="pointer-events-none absolute left-4 top-4 font-serif text-xs tracking-wide text-amber-100/60 [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">
      {presenceLabel(netStatus, Math.max(1, onlineCount), true)}
    </div>
  )
}
