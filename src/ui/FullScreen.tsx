export function FullScreen() {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-black/60 px-6 text-center font-serif">
      <div>
        <p className="text-lg text-amber-50/85">the fire is full right now, try again in a bit</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-full border border-amber-100/30 px-6 py-2 text-xs tracking-[0.2em] text-amber-50/80 transition hover:bg-amber-50/10"
        >
          try again
        </button>
      </div>
    </div>
  )
}
