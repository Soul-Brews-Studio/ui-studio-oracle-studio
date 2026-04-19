import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { cacheBus } from './lib/cache'

// Listen for cache-invalidation events from other tabs (e.g. menu edit in tab A
// should bust the menu cache in tab B).
cacheBus.attachCrossTab()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
