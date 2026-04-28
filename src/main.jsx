import './instrument'; // Sentry must be initialized first
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import './styles/mobile.css'
import './styles/mobile-modern.css'
import App from './App.jsx'
import { ErrorBoundary, AppErrorHandler } from './components/ErrorScreens.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AppErrorHandler enableHealthCheck={false}>
        <App />
      </AppErrorHandler>
    </ErrorBoundary>
  </StrictMode>,
)
