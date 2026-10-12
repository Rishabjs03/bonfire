import { useGameStore } from '../store/gameStore'

export function HUD() {
  const sitting = useGameStore((s) => s.sitting)
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center">
      <p
        className={`font-serif text-sm tracking-wide text-amber-100/70 transition-opacity duration-1000 ${
          sitting ? 'opacity-100' : 'opacity-0'
        }`}
      >
        you're warm now ✦
      </p>
    </div>
  )
}
