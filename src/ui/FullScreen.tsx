export function FullScreen() {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-black/60 px-6 text-center">
      <div>
        <p className="font-display text-4xl text-ink">The fire is full right now.</p>
        <p className="mt-2 text-[14px] text-ink-muted">There’s a limit of fifty people around it. Try again in a little while.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-7 h-11 rounded-full bg-ink px-7 text-[14px] font-semibold text-night transition hover:bg-white"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
