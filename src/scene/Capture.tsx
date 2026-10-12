import { useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { captureQueue, notifyCapture, onCaptureChange } from '../lib/captureQueue'
import { enabled } from '../lib/debug'

/**
 * Snapshots the WebGL canvas right after the post-processing composer has drawn to screen,
 * inside the same animation frame, so no preserveDrawingBuffer is needed. The frame
 * subscriber only exists while a capture is pending: a high-priority useFrame would
 * otherwise switch off React Three Fiber's automatic render when post-processing is off.
 */
export function Capture() {
  const [active, setActive] = useState(captureQueue.length > 0)
  useEffect(() => onCaptureChange(() => setActive(captureQueue.length > 0)), [])
  return active ? <CaptureFrame /> : null
}

function CaptureFrame() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    if (captureQueue.length === 0) return
    const batch = captureQueue.splice(0)
    try {
      // Without the composer nothing has rendered yet this frame (our subscriber replaced the auto render).
      if (!enabled('post')) gl.render(scene, camera)
      const src = gl.domElement
      const copy = document.createElement('canvas')
      copy.width = src.width
      copy.height = src.height
      const ctx = copy.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      ctx.drawImage(src, 0, 0)
      for (const p of batch) p.resolve(copy)
    } catch (e) {
      for (const p of batch) p.reject(e instanceof Error ? e : new Error(String(e)))
    } finally {
      notifyCapture()
    }
  }, 100)
  return null
}
