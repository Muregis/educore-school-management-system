import { useState, useEffect, useCallback } from 'react';
import syncEngine from '../services/syncEngine';
import { C } from '../lib/theme';
import Btn from './Btn';

/**
 * ManualSyncButton - Standalone button for manual sync trigger
 * Shows sync status and results
 */
export default function ManualSyncButton({ 
  variant = 'secondary',
  size = 'small',
  showCount = true,
  onSyncComplete,
  onSyncError
}) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [showResult, setShowResult] = useState(false);

  const updateStatus = useCallback(async () => {
    const count = await syncEngine.getPendingCount();
    const last = await syncEngine.getLastSync();
    setPendingCount(count);
    setLastSync(last);
  }, []);

  useEffect(() => {
    updateStatus();

    // Listen for sync events
    const removeListener = syncEngine.onSync((event) => {
      if (event.type === 'sync_complete') {
        updateStatus();
        setLastResult({
          synced: event.synced,
          rejected: event.rejected,
          conflicts: event.conflicts,
          timestamp: new Date().toISOString()
        });
        setShowResult(true);
        setTimeout(() => setShowResult(false), 5000);
        onSyncComplete?.(event);
      } else if (event.type === 'sync_error') {
        onSyncError?.(event.error);
      }
    });

    // Periodic updates
    const interval = setInterval(updateStatus, 10000);

    return () => {
      removeListener();
      clearInterval(interval);
    };
  }, [updateStatus, onSyncComplete, onSyncError]);

  const handleSync = async () => {
    if (isSyncing || !navigator.onLine) return;

    setIsSyncing(true);
    setShowResult(false);

    try {
      const result = await syncEngine.syncNow();
      
      if (result.status === 'success') {
        setLastResult({
          synced: result.synced,
          rejected: result.rejected,
          conflicts: result.conflicts,
          timestamp: new Date().toISOString()
        });
        setShowResult(true);
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  // If no pending and synced recently, show minimal indicator
  if (pendingCount === 0 && lastSync) {
    const lastSyncDate = new Date(lastSync);
    const minutesSince = (Date.now() - lastSyncDate) / 60000;
    
    if (minutesSince < 5) {
      return (
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: 6,
          color: '#22c55e',
          fontSize: 12
        }}>
          <span>✓</span>
          <span>Up to date</span>
        </div>
      );
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <Btn
        variant={variant}
        size={size}
        onClick={handleSync}
        disabled={isSyncing || !navigator.onLine || pendingCount === 0}
      >
        {isSyncing ? (
          <>
            <span style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              border: '2px solid transparent',
              borderTopColor: 'currentColor',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginRight: 6,
              verticalAlign: 'middle'
            }} />
            Syncing...
          </>
        ) : (
          <>
            <span style={{ marginRight: 6 }}>↻</span>
            Sync
            {showCount && pendingCount > 0 && (
              <span style={{
                marginLeft: 6,
                padding: '2px 6px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: 10,
                fontSize: 10,
                fontWeight: 700
              }}>
                {pendingCount}
              </span>
            )}
          </>
        )}
      </Btn>

      {/* Last sync info */}
      <div style={{
        fontSize: 10,
        color: C.textMuted,
        marginTop: 2,
        textAlign: 'center'
      }}>
        {navigator.onLine 
          ? `Last: ${formatLastSync(lastSync)}`
          : 'Offline'
        }
      </div>

      {/* Success notification */}
      {showResult && lastResult && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 8,
          padding: 10,
          background: '#1e293b',
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 50,
          fontSize: 12,
          color: C.text
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: '#22c55e' }}>
            ✓ Sync Complete
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ color: '#22c55e' }}>
              {lastResult.synced} synced
            </span>
            {lastResult.rejected > 0 && (
              <span style={{ color: '#ef4444' }}>
                {lastResult.rejected} failed
              </span>
            )}
            {lastResult.conflicts > 0 && (
              <span style={{ color: '#f97316' }}>
                {lastResult.conflicts} conflicts
              </span>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
