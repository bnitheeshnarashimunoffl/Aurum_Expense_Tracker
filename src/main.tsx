import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
// Side-effect import, and it has to be this early: Chrome can fire
// `beforeinstallprompt` while the first paint is still happening, and the event
// is only useful if it was cancelled and kept. See src/lib/installPrompt.ts.
import './lib/installPrompt'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
