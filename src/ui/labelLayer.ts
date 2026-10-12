import { createRef } from 'react'

/**
 * DOM layer over the canvas that hosts every in-world label (names, chat bubbles, emotes).
 * drei's <Html> needs a stable portal target: its default target changes once R3F connects
 * events, which recreates its root without re-rendering the children.
 */
export const labelLayerRef = createRef<HTMLDivElement>()
