import { useState, type FormEvent } from 'react'
import { useProgress } from '@react-three/drei'
import { audioEngine } from '../audio/audioEngine'
import { enabled } from '../lib/debug'
import { randomName } from '../lib/names'
import { PALETTE } from '../lib/palette'
import { LOOK_IDS, LOOKS } from '../player/people'
import { joinFire } from '../net/useMultiplayer'
import { MAX_NAME_LENGTH } from '../net/protocol'
import { useGameStore } from '../store/gameStore'
import { hasPeople, presenceLabel } from './presenceLabel'

const COLOR_NAMES: Record<string, string> = {
  '#7a1f1f': 'Oxblood',
  '#2f4a3a': 'Forest',
  '#1f2b45': 'Navy',
  '#b8862f': 'Ochre',
  '#3c3f44': 'Charcoal',
  '#a24a1f': 'Rust',
  '#2e5c63': 'Teal',
  '#4b2e45': 'Plum',
}

function Field({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-2.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="caption block">
          {label}
        </label>
      ) : (
        <div className="caption">{label}</div>
      )}
      {children}
    </div>
  )
}

export function JoinScreen() {
  const name = useGameStore((s) => s.name)
  const colors = useGameStore((s) => s.colors)
  const setColors = useGameStore((s) => s.setColors)
  const look = useGameStore((s) => s.look)
  const setLook = useGameStore((s) => s.setLook)
  const netStatus = useGameStore((s) => s.netStatus)
  const onlineCount = useGameStore((s) => s.onlineCount)
  const { active, progress } = useProgress()
  const [draft, setDraft] = useState(name)
  const ready = !active && progress >= 100

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    if (enabled('audio')) audioEngine.start() // inside the click: browsers only allow audio after a user gesture
    void joinFire(draft, colors, look)
  }

  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-[radial-gradient(ellipse_at_center,rgb(10_8_6/0.25),rgb(10_8_6/0.78)_75%)] sm:items-center">
      <form onSubmit={submit} className="w-full max-w-[22rem] px-6 pb-12 sm:pb-0">
        <header className="text-center">
          <p className="caption">Riffelalp · Zermatt · 2,110 m</p>
          <h1 className="mt-3 font-display text-[5rem] leading-[0.9] tracking-[-0.015em] text-ink">Bonfire</h1>
          <p className="mt-3 font-display text-[1.2rem] italic leading-snug text-ink-muted">
            A small fire in the Swiss Alps.
            <br />
            Come sit for a while.
          </p>
          <p className="mt-5 flex h-5 items-center justify-center gap-2 text-[13px] text-ink-muted" aria-live="polite">
            {hasPeople(netStatus, onlineCount) && <span className="ember-dot" aria-hidden />}
            <span className="tabular">{presenceLabel(netStatus, onlineCount, false)}</span>
          </p>
        </header>

        <div className="panel mt-8 space-y-5 rounded-2xl p-5">
          <Field label="Your name" htmlFor="name">
            <div className="flex items-center gap-2 border-b border-ink/15 pb-1.5 transition-colors focus-within:border-ember/70">
              <input
                id="name"
                value={draft}
                maxLength={MAX_NAME_LENGTH}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full bg-transparent text-[15px] font-medium text-ink outline-none placeholder:text-ink-faint"
                placeholder="What should we call you?"
              />
              <button
                type="button"
                onClick={() => setDraft(randomName())}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-faint transition hover:bg-ink/10 hover:text-ink"
                aria-label="Suggest another name"
                title="Suggest another name"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                  <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
                  <path d="M13.5 2.5v3h-3" />
                </svg>
              </button>
            </div>
          </Field>

          <Field label="Character">
            <div className="grid grid-cols-4 gap-1 rounded-full bg-ink/[0.06] p-1" role="radiogroup" aria-label="Character">
              {LOOK_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={look === id}
                  onClick={() => setLook(id)}
                  className={`rounded-full py-1.5 text-[13px] font-medium transition ${
                    look === id ? 'bg-ink text-night shadow-sm' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {LOOKS[id].label}
                </button>
              ))}
            </div>
          </Field>

          <Field label={`Jacket · ${COLOR_NAMES[colors.body] ?? ''}`}>
            <div className="flex justify-between" role="radiogroup" aria-label="Jacket colour">
              {PALETTE.map((p) => {
                const selected = p.body === colors.body
                return (
                  <button
                    key={p.body}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setColors(p)}
                    aria-label={`Jacket ${COLOR_NAMES[p.body] ?? p.body}`}
                    title={COLOR_NAMES[p.body]}
                    className={`h-7 w-7 rounded-full transition ${
                      selected ? 'ring-2 ring-ink ring-offset-2 ring-offset-[#1a1612]' : 'ring-1 ring-inset ring-white/10 hover:scale-110'
                    }`}
                    style={{ background: p.body }}
                  />
                )
              })}
            </div>
          </Field>
        </div>

        <button
          type="submit"
          disabled={!ready}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-ink text-[15px] font-semibold tracking-[0.01em] text-night shadow-[0_10px_30px_-10px_rgb(242_163_94/0.6)] transition hover:bg-white active:scale-[0.99] disabled:cursor-wait disabled:bg-ink/25 disabled:text-ink-muted disabled:shadow-none"
        >
          {ready ? 'Join the fire' : <span className="tabular">Gathering firewood · {Math.round(progress)}%</span>}
        </button>
      </form>
    </div>
  )
}
