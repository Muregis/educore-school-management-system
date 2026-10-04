import './instrument'; // Sentry must be initialized first
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import './styles/design-system.css'
import './styles/mobile.css'
import './styles/mobile-modern.css'
import './styles/layout-foundation.css'
import App from './App.jsx'

// Kill any legacy service workers (old PWA builds) so deploys are not stuck on phones
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations?.().then((regs) => {
    regs.forEach((reg) => reg.unregister().catch(() => {}));
  }).catch(() => {});
}
if (typeof caches !== 'undefined' && caches.keys) {
  caches.keys().then((keys) => {
    keys.forEach((k) => caches.delete(k).catch(() => {}));
  }).catch(() => {});
}

// Prune stale IndexedDB entity caches when online (keep pending offline queues)
if (typeof navigator !== 'undefined' && navigator.onLine) {
  import('./services/offlineDatabase.js')
    .then((m) => m.default?.pruneStaleCaches?.())
    .catch(() => {});
}

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
