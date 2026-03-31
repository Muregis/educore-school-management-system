import * as Sentry from '@sentry/react';

/**
 * Test buttons to verify Sentry error tracking is working.
 * Add this to any page during development/testing.
 * 
 * Per Sentry React SDK Skill Guide:
 * - Test Error: throws uncaught error (caught by ErrorBoundary)
 * - Test Message: sends manual message to Sentry
 */
export default function ErrorButton() {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <button
        onClick={() => {
          throw new Error('Sentry React test error');
        }}
        style={{
          padding: '10px 16px',
          background: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        🐛 Test Error
      </button>
      
      <button
        onClick={() => {
          Sentry.captureMessage('Sentry test message', 'info');
          alert('Test message sent to Sentry!');
        }}
        style={{
          padding: '10px 16px',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        📤 Test Message
      </button>
    </div>
  );
}
