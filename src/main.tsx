import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { loadWorldData } from './world/worldData'

// The terrain, ground heights and forest come from baked real-world data; load it
// before any module that places things on the ground is evaluated.
await loadWorldData()
const { default: App } = await import('./App.tsx')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
