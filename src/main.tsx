import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts (latin subset): work offline and keep the CSP free of third-party origins.
import './fonts.css'
import './index.css'
import App from './App.tsx'
import { applySkinToDocument, readInitialSkin } from './theme/skins.ts'

applySkinToDocument(readInitialSkin())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
