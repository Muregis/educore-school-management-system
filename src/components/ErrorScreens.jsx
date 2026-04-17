import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// Theme colors matching EduCore
const COLORS = {
  bg: '#0B1120',
  accent: '#3B82F6',
  surface: '#1e2d47',
  textMuted: '#64748b',
  text: '#E2EAF8',
  border: '#1A2A42',
  card: '#0F1929',
  rose: '#F43F5E',
  amber: '#F59E0B',
  green: '#22C55E'
};

// Pulse animation keyframes
const pulseKeyframes = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

// Logo component
const Logo = () => (
  <div style={{
    width: 64,
    height: 64,
    borderRadius: 12,
    background: `linear-gradient(135deg, ${COLORS.accent}, #6366f1)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: 28,
    color: '#fff',
    letterSpacing: -1,
    marginBottom: 20
  }}>
    M
  </div>
);

// Status indicator with pulse
const StatusIndicator = ({ icon, label }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20
  }}>
    <div style={{
      width: 48,
      height: 48,
      borderRadius: '50%',
      background: `${COLORS.accent}22`,
      border: `2px solid ${COLORS.accent}44`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 24,
      animation: 'pulse 2s infinite'
    }}>
      {icon}
    </div>
    <div style={{
      color: COLORS.text,
      fontSize: 14,
      fontWeight: 600,
      textAlign: 'center'
    }}>
      {label}
    </div>
  </div>
);

StatusIndicator.propTypes = {
  icon: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired
};

// Contact info component
const ContactInfo = () => (
  <div style={{
    textAlign: 'center',
    marginTop: 20,
    padding: 16,
    background: COLORS.surface,
    borderRadius: 12,
    border: `1px solid ${COLORS.border}`
  }}>
    <div style={{
      color: COLORS.textMuted,
      fontSize: 12,
      marginBottom: 8,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 1
    }}>
      Contact Support
    </div>
    <div style={{
      color: COLORS.text,
      fontSize: 14,
      fontWeight: 500,
      marginBottom: 4
    }}>
      i.am.muregi@gmail.com
    </div>
    <div style={{
      color: COLORS.text,
      fontSize: 14,
      fontWeight: 500
    }}>
      +254 797846126
    </div>
  </div>
);

// Retry button
const RetryButton = () => (
  <button
    onClick={() => window.location.reload()}
    style={{
      background: COLORS.accent,
      color: '#fff',
      border: 'none',
      borderRadius: 10,
      padding: '12px 24px',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'background 0.15s',
      marginTop: 20
    }}
    onMouseOver={(e) => e.target.style.background = '#2563EB'}
    onMouseOut={(e) => e.target.style.background = COLORS.accent}
  >
    Try Again
  </button>
);

// Offline Screen
export const OfflineScreen = () => (
  <div style={{
    minHeight: '100vh',
    background: COLORS.bg,
    color: COLORS.text,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif"
  }}>
    <style>{pulseKeyframes}</style>
    <Logo />
    <StatusIndicator icon="📶" label="No Internet Connection" />
    <div style={{
      textAlign: 'center',
      maxWidth: 400,
      marginBottom: 20
    }}>
      <div style={{
        fontSize: 24,
        fontWeight: 800,
        color: COLORS.text,
        marginBottom: 12
      }}>
        You&apos;re Offline
      </div>
      <div style={{
        color: COLORS.textMuted,
        fontSize: 16,
        lineHeight: 1.5
      }}>
        Please check your internet connection and try again.
      </div>
    </div>
    <RetryButton />
    <ContactInfo />
  </div>
);

// Maintenance Screen
export const MaintenanceScreen = ({ showCountdown = false, minutesRemaining = 15 }) => {
  const [timeLeft, setTimeLeft] = useState(minutesRemaining * 60);

  useEffect(() => {
    if (showCountdown && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [showCountdown, timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: COLORS.bg,
      color: COLORS.text,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif"
    }}>
      <style>{pulseKeyframes}</style>
      <Logo />
      <StatusIndicator icon="🔧" label="Under Maintenance" />
      <div style={{
        textAlign: 'center',
        maxWidth: 400,
        marginBottom: 20
      }}>
        <div style={{
          fontSize: 24,
          fontWeight: 800,
          color: COLORS.text,
          marginBottom: 12
        }}>
          System Maintenance
        </div>
        <div style={{
          color: COLORS.textMuted,
          fontSize: 16,
          lineHeight: 1.5,
          marginBottom: showCountdown ? 20 : 0
        }}>
          We&apos;re performing scheduled maintenance to improve your experience.
        </div>
        {showCountdown && (
          <div style={{
            background: COLORS.surface,
            borderRadius: 12,
            padding: 16,
            border: `1px solid ${COLORS.border}`,
            marginBottom: 20
          }}>
            <div style={{
              color: COLORS.textMuted,
              fontSize: 12,
              marginBottom: 8,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 1
            }}>
              Estimated Time Remaining
            </div>
            <div style={{
              fontSize: 32,
              fontWeight: 800,
              color: COLORS.accent,
              fontFamily: 'monospace'
            }}>
              {formatTime(timeLeft)}
            </div>
          </div>
        )}
      </div>
      <RetryButton />
      <ContactInfo />
    </div>
  );
};

MaintenanceScreen.propTypes = {
  showCountdown: PropTypes.bool,
  minutesRemaining: PropTypes.number
};

// Server Error Screen
export const ServerErrorScreen = () => {
  const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  return (
    <div style={{
      minHeight: '100vh',
      background: COLORS.bg,
      color: COLORS.text,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif"
    }}>
      <style>{pulseKeyframes}</style>
      <Logo />
      <StatusIndicator icon="⚠️" label="Server Error" />
      <div style={{
        textAlign: 'center',
        maxWidth: 400,
        marginBottom: 20
      }}>
        <div style={{
          fontSize: 24,
          fontWeight: 800,
          color: COLORS.rose,
          marginBottom: 12
        }}>
          Something Went Wrong
        </div>
        <div style={{
          color: COLORS.textMuted,
          fontSize: 16,
          lineHeight: 1.5,
          marginBottom: 20
        }}>
          We&apos;re experiencing technical difficulties. Please try again later.
        </div>
        <div style={{
          background: COLORS.surface,
          borderRadius: 12,
          padding: 16,
          border: `1px solid ${COLORS.border}`,
          marginBottom: 20
        }}>
          <div style={{
            color: COLORS.textMuted,
            fontSize: 12,
            marginBottom: 8,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 1
          }}>
            Error ID
          </div>
          <div style={{
            fontSize: 14,
            fontWeight: 600,
            color: COLORS.text,
            fontFamily: 'monospace',
            wordBreak: 'break-all'
          }}>
            {errorId}
          </div>
        </div>
      </div>
      <RetryButton />
      <ContactInfo />
    </div>
  );
};

// Not Found Screen
export const NotFoundScreen = ({ onGoHome }) => (
  <div style={{
    minHeight: '100vh',
    background: COLORS.bg,
    color: COLORS.text,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif"
  }}>
    <style>{pulseKeyframes}</style>
    <Logo />
    <StatusIndicator icon="🔍" label="Page Not Found" />
    <div style={{
      textAlign: 'center',
      maxWidth: 400,
      marginBottom: 20
    }}>
      <div style={{
        fontSize: 24,
        fontWeight: 800,
        color: COLORS.amber,
        marginBottom: 12
      }}>
        Page Not Found
      </div>
      <div style={{
        color: COLORS.textMuted,
        fontSize: 16,
        lineHeight: 1.5,
        marginBottom: 20
      }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </div>
    </div>
    <div style={{ display: 'flex', gap: 12 }}>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: 'transparent',
          color: COLORS.text,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 10,
          padding: '12px 24px',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.15s'
        }}
        onMouseOver={(e) => e.target.style.background = COLORS.surface}
        onMouseOut={(e) => e.target.style.background = 'transparent'}
      >
        Try Again
      </button>
      {onGoHome && (
        <button
          onClick={onGoHome}
          style={{
            background: COLORS.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '12px 24px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.15s'
          }}
          onMouseOver={(e) => e.target.style.background = '#2563EB'}
          onMouseOut={(e) => e.target.style.background = COLORS.accent}
        >
          Go Home
        </button>
      )}
    </div>
    <ContactInfo />
  </div>
);

NotFoundScreen.propTypes = {
  onGoHome: PropTypes.func
};

// Slow Connection Screen
export const SlowConnectionScreen = () => (
  <div style={{
    minHeight: '100vh',
    background: COLORS.bg,
    color: COLORS.text,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif"
  }}>
    <style>{pulseKeyframes}</style>
    <Logo />
    <StatusIndicator icon="🐌" label="Slow Connection" />
    <div style={{
      textAlign: 'center',
      maxWidth: 400,
      marginBottom: 20
    }}>
      <div style={{
        fontSize: 24,
        fontWeight: 800,
        color: COLORS.amber,
        marginBottom: 12
      }}>
        Connection Timeout
      </div>
      <div style={{
        color: COLORS.textMuted,
        fontSize: 16,
        lineHeight: 1.5
      }}>
        The request is taking longer than expected. Please check your connection and try again.
      </div>
    </div>
    <RetryButton />
    <ContactInfo />
  </div>
);

// Error Boundary Component
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo
    });
    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ServerErrorScreen />;
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired
};

// App Error Handler Component
export const AppErrorHandler = ({ children, enableHealthCheck = false }) => {
  const [errorState, setErrorState] = useState({
    isOffline: false,
    isMaintenance: false,
    isSlowConnection: false,
    healthCheckFailures: 0 // Track consecutive failures
  });

  // Check online status
  useEffect(() => {
    const handleOnline = () => setErrorState(prev => ({
      ...prev,
      isOffline: false,
      isSlowConnection: false
    }));

    const handleOffline = () => setErrorState(prev => ({
      ...prev,
      isOffline: true,
      isSlowConnection: false
    }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setErrorState(prev => ({
      ...prev,
      isOffline: !navigator.onLine,
      isSlowConnection: false
    }));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Health check ping (only if enabled)
  useEffect(() => {
    if (!enableHealthCheck) return;

    const pingHealth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch('/api/health', {
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          setErrorState(prev => {
            const newFailures = prev.healthCheckFailures + 1;
            return {
              ...prev,
              healthCheckFailures: newFailures,
              isMaintenance: newFailures >= 3 // Only show maintenance after 3 consecutive failures
            };
          });
        } else {
          setErrorState(prev => ({
            ...prev,
            isMaintenance: false,
            healthCheckFailures: 0 // Reset on success
          }));
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          // Slow connection detected
          setErrorState(prev => ({ ...prev, isSlowConnection: true }));
        } else {
          // Network error, increment failure count
          console.error('Health check failed:', error.message);
          setErrorState(prev => {
            const newFailures = prev.healthCheckFailures + 1;
            return {
              ...prev,
              healthCheckFailures: newFailures,
              isMaintenance: newFailures >= 3 // Only show maintenance after 3 consecutive failures
            };
          });
        }
      }
    };

    // Initial ping
    pingHealth();

    // Ping every 60 seconds
    const interval = setInterval(pingHealth, 60000);

    return () => clearInterval(interval);
  }, [enableHealthCheck]);

  // API response interceptor for slow connections
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        setErrorState(prev => ({ ...prev, isSlowConnection: true }));
        controller.abort();
      }, 8000); // 8 seconds

      try {
        const [resource, config = {}] = args;
        const response = await originalFetch(resource, {
          ...config,
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        setErrorState(prev => ({ ...prev, isSlowConnection: false }));
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError' && navigator.onLine) {
          setErrorState(prev => ({ ...prev, isSlowConnection: true }));
        }
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Render appropriate error screen
  if (errorState.isOffline) {
    return <OfflineScreen />;
  }

  if (errorState.isMaintenance) {
    return <MaintenanceScreen showCountdown={false} />;
  }

  if (errorState.isSlowConnection) {
    return <SlowConnectionScreen />;
  }

  // Everything is fine, render children
  return children;
};

AppErrorHandler.propTypes = {
  children: PropTypes.node.isRequired,
  enableHealthCheck: PropTypes.bool
};