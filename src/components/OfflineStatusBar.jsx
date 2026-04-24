import { useState, useEffect, useCallback } from 'react';
import syncEngine from '../services/syncEngine';
import { C } from '../lib/theme';

/**
 * OfflineStatusBar - Persistent banner showing offline/sync status
 * Displays at top of page when offline or when sync is pending
 */
export default function OfflineStatusBar() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Update status
  const updateStatus = useCallback(async () => {
    setIsOnline(navigator.onLine);
    if (navigator.onLine) {
      const count = await syncEngine.getPendingCount();
      setPendingCount(count);
      const last = await syncEngine.getLastSync();
      setLastSync(last);
    }
  }, []);

  useEffect(() => {
    // Initial status check
    updateStatus();

    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      updateStatus();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for sync events
    const removeListener = syncEngine.onSync((event) => {
      if (event.type === 'sync_start') {
        setIsSyncing(true);
      } else if (event.type === 'sync_complete' || event.type === 'sync_error') {
        setIsSyncing(false);
        updateStatus();
      }
    });

    // Periodic status update
    const interval = setInterval(updateStatus, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      removeListener();
      clearInterval(interval);
    };
  }, [updateStatus]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncEngine.syncNow();
      if (result.status === 'success') {
        await updateStatus();
      }
    } catch (err) {
      console.error('Manual sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Don't show if everything is normal (online and no pending)
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

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

  const styles = {
    container: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      fontSize: 13,
      fontWeight: 500,
      backdropFilter: 'blur(8px)',
      transition: 'all 0.3s ease'
    },
    offline: {
      background: 'rgba(239, 68, 68, 0.95)',
      color: '#fff'
    },
    syncing: {
      background: 'rgba(59, 130, 246, 0.95)',
      color: '#fff'
    },
    pending: {
      background: 'rgba(245, 158, 11, 0.95)',
      color: '#fff'
    },
    icon: {
      fontSize: 16,
      marginRight: 4
    },
    syncButton: {
      padding: '4px 12px',
      borderRadius: 4,
      border: '1px solid rgba(255,255,255,0.5)',
      background: 'rgba(255,255,255,0.2)',
      color: '#fff',
      cursor: isSyncing ? 'default' : 'pointer',
      fontSize: 12,
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: 4
    },
    details: {
      position: 'absolute',
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#1e293b',
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: 12,
      marginTop: 8,
      minWidth: 250,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
    },
    detailRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '4px 0',
      fontSize: 12,
      color: C.textSub
    },
    spinner: {
      width: 12,
      height: 12,
      border: '2px solid transparent',
      borderTopColor: 'currentColor',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }
  };

  const getContainerStyle = () => {
    if (!isOnline) return { ...styles.container, ...styles.offline };
    if (isSyncing) return { ...styles.container, ...styles.syncing };
    return { ...styles.container, ...styles.pending };
  };

  return (
    <div style={getContainerStyle()}>
      {!isOnline ? (
        <>
          <span style={styles.icon}>📴</span>
          <span>Working offline - changes saved locally</span>
        </>
      ) : isSyncing ? (
        <>
          <span style={styles.icon}>🔄</span>
          <span>Syncing {pendingCount > 0 ? `${pendingCount} changes` : ''}...</span>
        </>
      ) : (
        <>
          <span style={styles.icon}>⏳</span>
          <span>{pendingCount} changes pending sync</span>
          <button
            style={styles.syncButton}
            onClick={handleManualSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <span style={styles.spinner} />
            ) : (
              <span>↻</span>
            )}
            Sync Now
          </button>
        </>
      )}

      {/* Last sync info */}
      <span
        style={{
          fontSize: 11,
          opacity: 0.8,
          cursor: 'pointer',
          marginLeft: 8
        }}
        onClick={() => setShowDetails(!showDetails)}
      >
        Last: {formatLastSync(lastSync)} ▼
      </span>

      {/* Details popup */}
      {showDetails && (
        <div style={styles.details}>
          <div style={styles.detailRow}>
            <span>Status:</span>
            <span style={{ color: isOnline ? '#22c55e' : '#ef4444' }}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <div style={styles.detailRow}>
            <span>Pending:</span>
            <span>{pendingCount} actions</span>
          </div>
          <div style={styles.detailRow}>
            <span>Last Sync:</span>
            <span>{formatLastSync(lastSync)}</span>
          </div>
          <div style={styles.detailRow}>
            <span>Device:</span>
            <span style={{ fontSize: 10, fontFamily: 'monospace' }}>
              {syncEngine.getDeviceId?.()?.slice(0, 8) || 'N/A'}
            </span>
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
