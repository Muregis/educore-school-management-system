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
  const [isMinimized, setIsMinimized] = useState(true); // Start minimized

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
      bottom: isMinimized ? '16px' : '16px',
      right: isMinimized ? '16px' : '16px',
      left: isMinimized ? 'auto' : '16px',
      top: 'auto',
      zIndex: 1000,
      padding: isMinimized ? '10px 14px' : '12px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: isMinimized ? 'center' : 'flex-start',
      gap: isMinimized ? 6 : 12,
      fontSize: isMinimized ? 12 : 13,
      fontWeight: 500,
      backdropFilter: 'blur(12px)',
      borderRadius: isMinimized ? '50%' : '8px',
      transition: 'all 0.3s ease',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      maxWidth: isMinimized ? '44px' : '400px',
      minHeight: isMinimized ? '44px' : 'auto',
      cursor: 'pointer'
    },
    offline: {
      background: 'rgba(239, 68, 68, 0.9)',
      color: '#fff'
    },
    syncing: {
      background: 'rgba(59, 130, 246, 0.9)',
      color: '#fff'
    },
    pending: {
      background: 'rgba(245, 158, 11, 0.9)',
      color: '#fff'
    },
    icon: {
      fontSize: isMinimized ? 18 : 16,
      marginRight: isMinimized ? 0 : 4,
      display: 'inline-flex'
    },
    minimizeBtn: {
      position: 'absolute',
      top: '-8px',
      right: '-8px',
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      background: 'rgba(0,0,0,0.5)',
      color: '#fff',
      border: 'none',
      fontSize: 12,
      cursor: 'pointer',
      display: isMinimized ? 'none' : 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0
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
      bottom: '100%',
      right: 0,
      marginBottom: '8px',
      background: '#1e293b',
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: 12,
      minWidth: 250,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      zIndex: 1001
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

  // Click handler - toggle minimize or show details
  const handleClick = () => {
    if (isMinimized) {
      setIsMinimized(false);
    }
  };

  // Close when clicking outside (handled by effect below)
  useEffect(() => {
    if (!isMinimized) {
      const handleClickOutside = (e) => {
        if (e.target.closest('.sync-status-bar')) return;
        setIsMinimized(true);
        setShowDetails(false);
      };
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isMinimized]);

  return (
    <div 
      className="sync-status-bar"
      style={getContainerStyle()}
      onClick={handleClick}
    >
      {/* Minimized view - just icon */}
      {isMinimized ? (
        <span style={styles.icon}>
          {!isOnline ? '📴' : isSyncing ? '🔄' : '⏳'}
        </span>
      ) : (
        <>
          {/* Expanded view */}
          {!isOnline ? (
            <>
              <span style={styles.icon}>📴</span>
              <span>Offline - changes saved locally</span>
            </>
          ) : isSyncing ? (
            <>
              <span style={styles.icon}>🔄</span>
              <span>Syncing {pendingCount > 0 ? `${pendingCount}...` : ''}</span>
            </>
          ) : (
            <>
              <span style={styles.icon}>⏳</span>
              <span>{pendingCount} pending</span>
              <button
                style={styles.syncButton}
                onClick={(e) => { e.stopPropagation(); handleManualSync(); }}
                disabled={isSyncing}
              >
                {isSyncing ? <span style={styles.spinner} /> : <span>↻</span>}
                Sync
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
            onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
          >
            Last: {formatLastSync(lastSync)} ▼
          </span>

          {/* Minimize button */}
          <button
            style={styles.minimizeBtn}
            onClick={(e) => { e.stopPropagation(); setIsMinimized(true); setShowDetails(false); }}
          >
            ×
          </button>

          {/* Details popup */}
          {showDetails && (
            <div style={styles.details} onClick={(e) => e.stopPropagation()}>
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
        </>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
