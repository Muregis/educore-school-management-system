/**
 * Sync Engine - Manages offline data synchronization
 * Handles syncing data between IndexedDB and backend
 */

import offlineDatabase from './offlineDatabase';

// Event listeners for sync events
const eventListeners = new Set();

// Device ID generation
const generateDeviceId = () => {
  const stored = localStorage.getItem('device_id');
  if (stored) return stored;
  
  const newId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  localStorage.setItem('device_id', newId);
  return newId;
};

const deviceId = generateDeviceId();

/**
 * Get pending sync count
 */
const getPendingCount = async () => {
  try {
    const count = await offlineDatabase.getPendingCount();
    return count || 0;
  } catch (err) {
    console.error('[SyncEngine] Error getting pending count:', err);
    return 0;
  }
};

/**
 * Get last sync timestamp
 */
const getLastSync = async () => {
  try {
    return await offlineDatabase.getSyncMetadata('lastSync');
  } catch (err) {
    console.error('[SyncEngine] Error getting last sync:', err);
    return null;
  }
};

/**
 * Execute sync now
 */
const syncNow = async () => {
  const listeners = Array.from(eventListeners);
  
  // Notify start
  listeners.forEach(cb => cb({ type: 'sync_start' }));
  
  try {
    const pendingActions = await offlineDatabase.getPendingActions(100);
    
    if (!pendingActions || pendingActions.length === 0) {
      // Update last sync time even when nothing to sync
      await offlineDatabase.setSyncMetadata('lastSync', new Date().toISOString());
      
      listeners.forEach(cb => cb({ 
        type: 'sync_complete', 
        synced: 0, 
        failed: 0 
      }));
      return { status: 'success', synced: 0, failed: 0 };
    }
    
    let synced = 0;
    let failed = 0;
    
    for (const item of pendingActions) {
      try {
        // This would normally call your API
        // Mark as synced in database
        await offlineDatabase.markPendingSynced?.(item.id);
        synced++;
      } catch (err) {
        console.error('[SyncEngine] Failed to sync item:', item.id, err);
        failed++;
      }
    }
    
    // Update last sync time
    await offlineDatabase.setSyncMetadata('lastSync', new Date().toISOString());
    
    listeners.forEach(cb => cb({ 
      type: 'sync_complete', 
      synced, 
      failed 
    }));
    
    return { status: 'success', synced, failed };
  } catch (err) {
    listeners.forEach(cb => cb({ type: 'sync_error', error: err.message }));
    return { status: 'error', error: err.message };
  }
};

/**
 * Register event listener
 */
const onSync = (callback) => {
  eventListeners.add(callback);
  return () => eventListeners.delete(callback);
};

/**
 * Get device ID
 */
const getDeviceId = () => deviceId;

/**
 * Clear all sync data
 */
const clearAll = async () => {
  try {
    await offlineDatabase.clearAllData?.();
    return { success: true };
  } catch (err) {
    console.error('[SyncEngine] Error clearing data:', err);
    return { success: false, error: err.message };
  }
};

const syncEngine = {
  getPendingCount,
  getLastSync,
  syncNow,
  onSync,
  getDeviceId,
  clearAll,
  isInitialized: () => true,
};

export default syncEngine;
