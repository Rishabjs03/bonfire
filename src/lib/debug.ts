/** Dev-only feature switches for profiling, e.g. `?off=fire,ao`. */
const off = new Set(
  import.meta.env.DEV ? (new URLSearchParams(window.location.search).get('off') ?? '').split(',') : [],
)
export const enabled = (feature: string) => !off.has(feature)
