import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Attempt portrait lock — works on Chrome Android 111+, silently fails elsewhere
if (typeof screen !== 'undefined' && (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock) {
  (screen.orientation as unknown as { lock: (o: string) => Promise<void> }).lock('portrait-primary').catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
