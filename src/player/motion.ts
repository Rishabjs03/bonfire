/** What a character is doing; written by the owner each frame, read by the animation. */
export interface MotionState {
  speed: number // metres per second over the ground
  sitting: boolean
}

export const createMotionState = (): MotionState => ({ speed: 0, sitting: false })
