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
          className="animate-bubble relative mb-1.5 w-max max-w-[230px] rounded-2xl bg-[#f4ede3] px-3.5 py-2 text-center text-[13.5px] font-medium leading-snug text-[#1c1612] shadow-[0_8px_24px_-8px_rgb(0_0_0/0.6)] break-words"
        >
          {bubble.value}
          <span className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-[#f4ede3]" />
        </div>
      )}
    </>
  )
}
