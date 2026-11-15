import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Remove temporary Figma capture parameters while preserving unrelated URL state.
const captureParams = new URLSearchParams(window.location.hash.slice(1))
if (captureParams.has('figmacapture')) {
  for (const key of [...captureParams.keys()]) {
    if (key.startsWith('figma')) captureParams.delete(key)
  }
  const remainingHash = captureParams.toString()
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search + (remainingHash ? '#' + remainingHash : ''))
}
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
