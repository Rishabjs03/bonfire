import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import './index.css'
import { loadWorldData } from './world/worldData'

// Vercel Web Analytics (page views only, no cookies). Needs Analytics enabled on the Vercel project.
inject({ mode: import.meta.env.DEV ? 'development' : 'production' })

// The terrain, ground heights and forest come from baked real-world data; load it
// before any module that places things on the ground is evaluated.
await loadWorldData()
const { default: App } = await import('./App.tsx')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
