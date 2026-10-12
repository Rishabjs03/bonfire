import { EMOTES, useSocialStore } from '../store/socialStore'

/** Speech bubble and floating emote above one player's head. Rendered inside their name label. */
export function PlayerOverlays({ id }: { id: string }) {
  const bubble = useSocialStore((s) => s.bubbles[id])
  const emote = useSocialStore((s) => s.emotes[id])
  return (
    <>
      {emote && (
        <span key={emote.nonce} className="animate-emote text-2xl" aria-hidden>
          {EMOTES[emote.value].icon}
        </span>
      )}
      {bubble && (
        <div
          key={bubble.nonce}
          className="animate-bubble relative mb-1 w-max max-w-[220px] rounded-xl bg-[#0d0f14]/75 px-3 py-1.5 text-center font-serif text-[13px] leading-snug text-amber-50/90 shadow-[0_2px_12px_rgba(0,0,0,0.5)] backdrop-blur-[2px] break-words"
        >
          {bubble.value}
          <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#0d0f14]/75" />
        </div>
      )}
    </>
  )
}
