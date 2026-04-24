/**
 * SyncEngine Service
 * Manages synchronization between offline IndexedDB and server
 * Handles conflict detection and retry logic
 */

import offlineDatabase from './offlineDatabase';
import { apiFetch } from '../lib/api';

class SyncEngine {
  constructor() {
    this.isSyncing = false;
    this.syncListeners = [];
    this.conflictListeners = [];
    this.abortController = null;

    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.onConnectionRestored());
      window.addEventListener('offline', () => this.onConnectionLost());
    }
  }

  /**
   * Initialize sync engine
   */
  async init() {
    await offlineDatabase.init();
    return this;
  }

  /**
   * Add listener for sync events
   */
  onSync(callback) {
    this.syncListeners.push(callback);
    return () => {
      this.syncListeners = this.syncListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Add listener for conflicts
   */
  onConflict(callback) {
    this.conflictListeners.push(callback);
    return () => {
      this.conflictListeners = this.conflictListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all sync listeners
   */
  notifySyncListeners(event) {
    this.syncListeners.forEach(callback => {
      try {
        callback(event);
      } catch (err) {
        console.error('Sync listener error:', err);
      }
    });
  }

  /**
   * Notify all conflict listeners
   */
  notifyConflictListeners(conflicts) {
    this.conflictListeners.forEach(callback => {
      try {
        callback(conflicts);
      } catch (err) {
        console.error('Conflict listener error:', err);
      }
    });
  }

  /**
   * Get current sync status
   */
  async getStatus() {
    const pendingCount = await offlineDatabase.getPendingCount();
    const lastSync = await offlineDatabase.getLastSyncTimestamp();
    const deviceId = await offlineDatabase.getDeviceId();
    const stats = await offlineDatabase.getSyncStats();

    return {
      isOnline: navigator.onLine,
      isSyncing: this.isSyncing,
      pendingCount,
      lastSync,
      deviceId,
      stats
    };
  }

  /**
   * Get count of pending actions
   */
  async getPendingCount() {
    return await offlineDatabase.getPendingCount();
  }

  /**
   * Get last sync timestamp
   */
  async getLastSync() {
    return await offlineDatabase.getLastSyncTimestamp();
  }

  /**
   * Manual sync trigger
   */
  async syncNow(options = {}) {
    if (this.isSyncing) {
      return { status: 'already_syncing', message: 'Sync already in progress' };
    }

    if (!navigator.onLine) {
      return { status: 'offline', message: 'Cannot sync while offline' };
    }

    this.isSyncing = true;
    this.abortController = new AbortController();

    this.notifySyncListeners({ type: 'sync_start' });

    try {
      // Get pending actions
      const pendingActions = await offlineDatabase.getPendingActions(100);

      if (pendingActions.length === 0) {
        this.isSyncing = false;
        this.notifySyncListeners({ type: 'sync_complete', synced: 0 });
        return { status: 'success', synced: 0, message: 'No pending actions' };
      }

      // Get device ID
      const deviceId = await offlineDatabase.getDeviceId();

      // Get last sync timestamp
      const lastSync = await offlineDatabase.getLastSyncTimestamp();

      // Get auth token
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Prepare batch
      const batch = pendingActions.map(action => ({
        local_id: action.local_id,
        type: action.type,
        payload: action.payload,
        local_timestamp: action.timestamp,
        checksum: action.checksum
      }));

      // Send to server
      const response = await fetch('/api/sync/batch-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Device-ID': deviceId,
          'X-Idempotency-Key': this.generateUUID()
        },
        body: JSON.stringify({
          device_id: deviceId,
          last_sync_timestamp: lastSync,
          actions: batch
        }),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Sync failed: ${response.status}`);
      }

      const result = await response.json();

      // Process results
      const conflicts = [];

      // Handle accepted actions
      for (const accepted of result.data.accepted) {
        await offlineDatabase.updateActionStatus(accepted.local_id, 'synced', {
          server_id: accepted.server_id,
          server_timestamp: accepted.server_timestamp
        });
      }

      // Handle rejected actions
      for (const rejected of result.data.rejected) {
        await offlineDatabase.updateActionStatus(rejected.local_id, 'failed', {
          error: rejected.error,
          retryable: rejected.retryable
        });
      }

      // Handle conflicts
      for (const conflict of result.data.conflicts) {
        await offlineDatabase.updateActionStatus(conflict.local_id, 'conflict', {
          conflict: conflict
        });
        conflicts.push(conflict);
      }

      // Update last sync timestamp
      await offlineDatabase.setLastSyncTimestamp();

      // Notify listeners
      this.notifySyncListeners({
        type: 'sync_complete',
        synced: result.data.accepted.length,
        rejected: result.data.rejected.length,
        conflicts: result.data.conflicts.length
      });

      // If there are conflicts, notify conflict listeners
      if (conflicts.length > 0) {
        this.notifyConflictListeners(conflicts);
      }

      return {
        status: 'success',
        synced: result.data.accepted.length,
        rejected: result.data.rejected.length,
        conflicts: result.data.conflicts.length,
        total: pendingActions.length,
        hasConflicts: conflicts.length > 0
      };

    } catch (error) {
      if (error.name === 'AbortError') {
        this.notifySyncListeners({ type: 'sync_aborted' });
        return { status: 'aborted', message: 'Sync was cancelled' };
      }

      console.error('Sync error:', error);
      this.notifySyncListeners({ type: 'sync_error', error: error.message });

      return {
        status: 'error',
        message: error.message,
        retryable: true
      };

    } finally {
      this.isSyncing = false;
      this.abortController = null;
    }
  }

  /**
   * Cancel current sync
   */
  cancelSync() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Background sync when connection restored
   */
  async onConnectionRestored() {
    console.log('Connection restored - checking for pending syncs');

    const pendingCount = await offlineDatabase.getPendingCount();
    if (pendingCount > 0) {
      // Auto-sync after a short delay (allow connection to stabilize)
      setTimeout(() => this.syncNow(), 2000);
    }
  }

  /**
   * Handle connection lost
   */
  onConnectionLost() {
    console.log('Connection lost - sync will resume when online');
    this.cancelSync();
    this.notifySyncListeners({ type: 'offline' });
  }

  /**
   * Queue an action for sync
   */
  async queueAction(type, payload, metadata = {}) {
    // Add to local database
    const localId = await offlineDatabase.queueAction(type, payload, metadata);

    // Try to sync immediately if online
    if (navigator.onLine && !this.isSyncing) {
      // Small delay to batch multiple rapid actions
      clearTimeout(this._syncTimeout);
      this._syncTimeout = setTimeout(() => this.syncNow(), 1000);
    }

    return localId;
  }

  /**
   * Resolve conflicts
   */
  async resolveConflicts(resolutions) {
    const token = this.getAuthToken();
    const deviceId = await offlineDatabase.getDeviceId();

    const response = await fetch('/api/sync/resolve-conflicts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Device-ID': deviceId
      },
      body: JSON.stringify({ resolutions })
    });

    if (!response.ok) {
      throw new Error('Failed to resolve conflicts');
    }

    const result = await response.json();

    // Update local status for resolved conflicts
    for (const res of result.data) {
      if (res.status === 'resolved') {
        await offlineDatabase.updateActionStatus(res.log_id, 'synced', {
          server_id: res.server_id
        });
      }
    }

    // Trigger another sync to upload resolved records
    await this.syncNow();

    return result.data;
  }

  /**
   * Get pending actions with full details
   */
  async getPendingActions() {
    return await offlineDatabase.getPendingActions(100);
  }

  /**
   * Export pending actions for backup
   */
  async exportPendingActions() {
    return await offlineDatabase.exportPendingActions();
  }

  /**
   * Import pending actions from backup
   */
  async importPendingActions(backup) {
    return await offlineDatabase.importPendingActions(backup);
  }

  /**
   * Get auth token from storage
   */
  getAuthToken() {
    // Try sessionStorage first, then localStorage
    return sessionStorage.getItem('token') ||
           sessionStorage.getItem('educore.auth')?.token ||
           localStorage.getItem('token');
  }

  /**
   * Generate UUID for idempotency
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Clear all sync data (for logout)
   */
  async clearAllData() {
    this.cancelSync();
    await offlineDatabase.clearAllData();
  }
}

// Singleton instance
const syncEngine = new SyncEngine();

export default syncEngine;
export { SyncEngine };
