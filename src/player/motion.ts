/** What a character is doing; written by the owner each frame, read by the animation. */
export interface MotionState {
  speed: number // 0..1, fraction of walk speed
  sitting: boolean
  warmth: number // 0..1, fire glow tint
}

export const createMotionState = (): MotionState => ({ speed: 0, sitting: false, warmth: 0 })
