/** Requests for a copy of the next rendered frame, served by <Capture /> inside the canvas. */
export interface PendingCapture {
  resolve: (frame: HTMLCanvasElement) => void
  reject: (e: Error) => void
}

export const captureQueue: PendingCapture[] = []
const listeners = new Set<() => void>()

export const notifyCapture = () => listeners.forEach((fn) => fn())

export function onCaptureChange(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Resolve with a copy of the next rendered frame (a 2D canvas the size of the drawing buffer). */
export function captureFrame(): Promise<HTMLCanvasElement> {
  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    captureQueue.push({ resolve, reject })
    notifyCapture()
  })
}
