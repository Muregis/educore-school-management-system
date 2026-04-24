import { useState } from 'react';
import { C } from '../lib/theme';

/**
 * SyncStatusIndicator - Shows sync status for individual records
 * Use inline next to records that were created/modified offline
 */
export default function SyncStatusIndicator({ 
  status,  // 'synced', 'pending', 'failed', 'conflict'
  error,
  onRetry,
  onResolve,
  size = 'small' // 'small', 'medium'
} ) {
  const [showTooltip, setShowTooltip] = useState(false);

  const config = {
    synced: {
      icon: '✓',
      color: '#22c55e',
      bgColor: 'rgba(34, 197, 94, 0.1)',
      label: 'Synced',
      description: 'Successfully synced to server'
    },
    pending: {
      icon: '⏳',
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.1)',
      label: 'Pending',
      description: 'Waiting to sync when online'
    },
    syncing: {
      icon: '↻',
      color: '#3b82f6',
      bgColor: 'rgba(59, 130, 246, 0.1)',
      label: 'Syncing',
      description: 'Currently syncing...'
    },
    failed: {
      icon: '✗',
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.1)',
      label: 'Failed',
      description: error || 'Sync failed - will retry'
    },
    conflict: {
      icon: '⚠',
      color: '#f97316',
      bgColor: 'rgba(249, 115, 22, 0.1)',
      label: 'Conflict',
      description: 'Conflict detected - needs resolution'
    }
  };

  const current = config[status] || config.pending;
  const isSmall = size === 'small';

  const styles = {
    container: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: isSmall ? '2px 6px' : '4px 10px',
      borderRadius: 4,
      background: current.bgColor,
      color: current.color,
      fontSize: isSmall ? 11 : 13,
      fontWeight: 500,
      cursor: (onRetry || onResolve) ? 'pointer' : 'default',
      position: 'relative',
      whiteSpace: 'nowrap'
    },
    icon: {
      fontSize: isSmall ? 10 : 12,
      display: 'inline-flex'
    },
    label: {
      display: isSmall ? 'none' : 'inline'
    },
    tooltip: {
      position: 'absolute',
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginBottom: 6,
      padding: '6px 10px',
      background: '#1e293b',
      color: C.text,
      fontSize: 11,
      borderRadius: 6,
      border: `1px solid ${C.border}`,
      whiteSpace: 'nowrap',
      zIndex: 100,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    },
    arrow: {
      position: 'absolute',
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      border: '4px solid transparent',
      borderTopColor: '#1e293b'
    },
    actions: {
      display: 'flex',
      gap: 4,
      marginTop: 4,
      paddingTop: 4,
      borderTop: `1px solid ${C.border}`
    },
    actionBtn: {
      padding: '2px 6px',
      fontSize: 10,
      borderRadius: 3,
      border: 'none',
      cursor: 'pointer',
      fontWeight: 600
    }
  };

  const handleClick = () => {
    if (status === 'failed' && onRetry) {
      onRetry();
    } else if (status === 'conflict' && onResolve) {
      onResolve();
    }
  };

  return (
    <span
      style={styles.container}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={handleClick}
    >
      <span style={styles.icon}>{current.icon}</span>
      <span style={styles.label}>{current.label}</span>

      {showTooltip && (
        <div style={styles.tooltip}>
          <div>{current.description}</div>
          
          {/* Action buttons in tooltip */}
          {(status === 'failed' || status === 'conflict') && (onRetry || onResolve) && (
            <div style={styles.actions}>
              {status === 'failed' && onRetry && (
                <button
                  style={{...styles.actionBtn, background: current.color, color: '#fff'}}
                  onClick={(e) => { e.stopPropagation(); onRetry(); }}
                >
                  Retry
                </button>
              )}
              {status === 'conflict' && onResolve && (
                <button
                  style={{...styles.actionBtn, background: current.color, color: '#fff'}}
                  onClick={(e) => { e.stopPropagation(); onResolve(); }}
                >
                  Resolve
                </button>
              )}
            </div>
          )}
          
          <div style={styles.arrow} />
        </div>
      )}
    </span>
  );
}

/**
 * SyncStatusBadge - Simpler version for table cells
 */
export function SyncStatusBadge({ status }) {
  const styles = {
    synced: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', icon: '●' },
    pending: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', icon: '○' },
    failed: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', icon: '○' },
    conflict: { bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316', icon: '○' }
  };

  const style = styles[status] || styles.pending;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: style.color,
        fontSize: 8,
        color: '#fff'
      }}
      title={`Status: ${status}`}
    >
      {style.icon}
    </span>
  );
}
