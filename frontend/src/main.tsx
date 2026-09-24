import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { validateFrontendEnv } from './utils/envValidator'
import { soundService } from './services/soundService'

validateFrontendEnv()
soundService.unlockOnFirstInteraction()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
