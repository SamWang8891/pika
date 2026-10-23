import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '@fontsource/bricolage-grotesque/400.css'
import '@fontsource/bricolage-grotesque/600.css'
import '@fontsource/bricolage-grotesque/700.css'
import '@fontsource/bricolage-grotesque/800.css'
import '@fontsource/outfit/300.css'
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/500.css'
import '@fontsource/outfit/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import App from './App'
import { BackendProvider } from './backend'
import { ToastProvider } from './components/Toast'
import { ThemeProvider } from './theme'
// The web app's design system, shared as-is; popup.css only adapts it to the popup.
import '../../src/client/style.css'
import './popup.css'

// MemoryRouter: a popup has no address bar, and it reopens fresh on every click.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter>
      <ThemeProvider>
        <ToastProvider>
          <BackendProvider>
            <App />
          </BackendProvider>
        </ToastProvider>
      </ThemeProvider>
    </MemoryRouter>
  </StrictMode>,
)
