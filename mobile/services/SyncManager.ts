// Enhanced Sync Manager for Recipe API Integration
// Coordinates between local storage and remote API with conflict resolution

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { apiClient } from './ApiClient';
import { recipeApi } from './RecipeApiService';
import { recipeStorage } from './RecipeStorageService';
import { PersonalRecipe, RecipeCollection } from '../types/RecipeTypes';

// Sync Configuration
interface SyncConfig {
  autoSyncEnabled: boolean;
  syncInterval: number; // milliseconds
  conflictResolution: 'local' | 'remote' | 'merge' | 'manual';
  maxRetries: number;
  batchSize: number;
}

// Sync Entry for tracking changes
interface SyncEntry {
  id: string;
  type: 'recipe' | 'collection';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  attempts: number;
  lastError?: string;
}

// Sync Status
interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: number;
  pendingChanges: number;
  syncInProgress: boolean;
  errors: SyncEntry[];
}

// Conflict Resolution
interface ConflictItem {
  id: string;
  type: 'recipe' | 'collection';
  localVersion: any;
  remoteVersion: any;
  localModified: number;
  remoteModified: number;
}

export class SyncManager {
  private static instance: SyncManager;
  private config: SyncConfig;
  private syncQueue: SyncEntry[] = [];
  private syncTimer: NodeJS.Timeout | null = null;
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private listeners: Array<(status: SyncStatus) => void> = [];

  private constructor() {
    this.config = {
      autoSyncEnabled: true,
      syncInterval: 60000, // 1 minute
      conflictResolution: 'merge',
      maxRetries: 3,
      batchSize: 10,
    };
    
    this.initializeNetworkMonitoring();
    this.loadSyncQueue();
    this.startAutoSync();
  }

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  // Network Monitoring
  private initializeNetworkMonitoring(): void {
    try {
      // Check if NetInfo is properly available
      if (NetInfo && typeof NetInfo.addEventListener === 'function') {
        NetInfo.addEventListener(state => {
          const wasOffline = !this.isOnline;
          this.isOnline = state.isConnected ?? true; // Default to true if undefined

          // Start sync when coming back online
          if (wasOffline && this.isOnline && this.syncQueue.length > 0) {
            console.log('📡 Back online - starting sync...');
            this.performSync();
          }

          this.notifyListeners();
        });
        console.log('📡 SyncManager NetInfo initialized successfully');
      } else {
        throw new Error('NetInfo.addEventListener is not available');
      }
    } catch (error) {
      console.warn('NetInfo not available in SyncManager, assuming online:', error);
      // Fallback to online state
      this.isOnline = true;
    }
  }

  // Auto Sync Management
  private startAutoSync(): void {
    if (this.config.autoSyncEnabled && !this.syncTimer) {
      this.syncTimer = setInterval(() => {
        if (this.isOnline && this.syncQueue.length > 0) {
          this.performSync();
        }
      }, this.config.syncInterval);
    }
  }

  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  // Queue Management
  private async loadSyncQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('@sync_queue');
      if (stored) {
        this.syncQueue = JSON.parse(stored);
        console.log(`📋 Loaded ${this.syncQueue.length} pending sync items`);
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  private async saveSyncQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem('@sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  // Public API for adding sync entries
  public async queueRecipeChange(
    recipeId: string,
    action: 'create' | 'update' | 'delete',
    data?: any
  ): Promise<void> {
    const entry: SyncEntry = {
      id: recipeId,
      type: 'recipe',
      action,
      data,
      timestamp: Date.now(),
      attempts: 0,
    };

    // Remove any existing entries for the same recipe to avoid duplicates
    this.syncQueue = this.syncQueue.filter(e => !(e.type === 'recipe' && e.id === recipeId));
    
    // Don't queue deletes if we have a create pending
    const hasCreate = this.syncQueue.some(e => 
      e.type === 'recipe' && e.id === recipeId && e.action === 'create'
    );
    
    if (action === 'delete' && hasCreate) {
      // Just remove the create entry - no need to sync anything
      return;
    }

    this.syncQueue.push(entry);
    await this.saveSyncQueue();
    this.notifyListeners();

    // Try immediate sync if online
    if (this.isOnline && !this.syncInProgress) {
      this.performSync();
    }
  }

  public async queueCollectionChange(
    collectionId: string,
    action: 'create' | 'update' | 'delete',
    data?: any
  ): Promise<void> {
    const entry: SyncEntry = {
      id: collectionId,
      type: 'collection',
      action,
      data,
      timestamp: Date.now(),
      attempts: 0,
    };

    this.syncQueue = this.syncQueue.filter(e => !(e.type === 'collection' && e.id === collectionId));
    this.syncQueue.push(entry);
    await this.saveSyncQueue();
    this.notifyListeners();

    if (this.isOnline && !this.syncInProgress) {
      this.performSync();
    }
  }

  // Main Sync Logic
  public async performSync(): Promise<void> {
    if (!this.isOnline || this.syncInProgress || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    this.notifyListeners();

    console.log(`🔄 Starting sync of ${this.syncQueue.length} items...`);

    try {
      // First, pull changes from server to detect conflicts
      await this.pullChangesFromServer();
      
      // Then push local changes
      await this.pushChangesToServer();
      
      // Update last sync time
      await AsyncStorage.setItem('@last_sync_time', Date.now().toString());
      
      console.log('✅ Sync completed successfully');
    } catch (error) {
      console.error('❌ Sync failed:', error);
    } finally {
      this.syncInProgress = false;
      this.notifyListeners();
    }
  }

  // Pull remote changes and detect conflicts
  private async pullChangesFromServer(): Promise<void> {
    try {
      const lastSyncTime = await AsyncStorage.getItem('@last_sync_time');
      const since = lastSyncTime ? parseInt(lastSyncTime) : 0;

      // Fetch remote changes since last sync
      const remoteRecipes = await recipeApi.getPersonalRecipes(1, 100, {
        modifiedSince: new Date(since).toISOString(),
      });

      const remoteCollections = await recipeApi.getCollections();

      // Detect and resolve conflicts
      await this.handleConflicts(remoteRecipes.recipes, remoteCollections);

      // Update local storage with non-conflicting remote changes
      for (const remoteRecipe of remoteRecipes.recipes) {
        const localRecipe = await recipeStorage.getRecipe(remoteRecipe.id);
        
        if (!localRecipe || this.shouldUseRemoteVersion(localRecipe, remoteRecipe)) {
          await recipeStorage.saveRecipe(remoteRecipe, 'synced');
        }
      }

    } catch (error) {
      console.warn('Failed to pull changes from server:', error);
    }
  }

  // Push local changes to server
  private async pushChangesToServer(): Promise<void> {
    const batch = this.syncQueue.slice(0, this.config.batchSize);
    const processed: string[] = [];

    for (const entry of batch) {
      try {
        await this.syncSingleEntry(entry);
        processed.push(entry.id);
      } catch (error) {
        entry.attempts++;
        entry.lastError = error.message;
        
        if (entry.attempts >= this.config.maxRetries) {
          console.error(`❌ Max retries reached for ${entry.type} ${entry.id}:`, error);
          processed.push(entry.id); // Remove from queue even if failed
        }
      }
    }

    // Remove processed entries
    this.syncQueue = this.syncQueue.filter(e => !processed.includes(e.id));
    await this.saveSyncQueue();
  }

  // Sync individual entry
  private async syncSingleEntry(entry: SyncEntry): Promise<void> {
    switch (entry.type) {
      case 'recipe':
        await this.syncRecipe(entry);
        break;
      case 'collection':
        await this.syncCollection(entry);
        break;
      default:
        throw new Error(`Unknown sync entry type: ${entry.type}`);
    }
  }

  private async syncRecipe(entry: SyncEntry): Promise<void> {
    switch (entry.action) {
      case 'create':
      case 'update':
        const localRecipe = await recipeStorage.getRecipe(entry.id);
        if (localRecipe) {
          await recipeApi.savePersonalRecipe({
            recipe: localRecipe,
            source: 'mobile',
          });
        }
        break;
      case 'delete':
        await recipeApi.deletePersonalRecipe(entry.id);
        break;
    }
  }

  private async syncCollection(entry: SyncEntry): Promise<void> {
    switch (entry.action) {
      case 'create':
      case 'update':
        if (entry.data) {
          await recipeApi.createCollection(entry.data);
        }
        break;
      case 'delete':
        // Collections are typically not deleted completely
        break;
    }
  }

  // Conflict Resolution
  private async handleConflicts(
    remoteRecipes: PersonalRecipe[],
    remoteCollections: RecipeCollection[]
  ): Promise<void> {
    const conflicts: ConflictItem[] = [];

    // Check for recipe conflicts
    for (const remoteRecipe of remoteRecipes) {
      const localRecipe = await recipeStorage.getRecipe(remoteRecipe.id);
      const pendingEntry = this.syncQueue.find(e => e.type === 'recipe' && e.id === remoteRecipe.id);

      if (localRecipe && pendingEntry && this.hasConflict(localRecipe, remoteRecipe)) {
        conflicts.push({
          id: remoteRecipe.id,
          type: 'recipe',
          localVersion: localRecipe,
          remoteVersion: remoteRecipe,
          localModified: new Date(localRecipe.personalMetadata.lastModified || 0).getTime(),
          remoteModified: new Date(remoteRecipe.personalMetadata.lastModified || 0).getTime(),
        });
      }
    }

    // Resolve conflicts based on strategy
    for (const conflict of conflicts) {
      await this.resolveConflict(conflict);
    }
  }

  private hasConflict(localItem: any, remoteItem: any): boolean {
    const localModified = new Date(localItem.personalMetadata?.lastModified || 0).getTime();
    const remoteModified = new Date(remoteItem.personalMetadata?.lastModified || 0).getTime();
    
    // Consider it a conflict if both were modified and they're different
    return Math.abs(localModified - remoteModified) > 1000 && // 1 second tolerance
           JSON.stringify(localItem) !== JSON.stringify(remoteItem);
  }

  private shouldUseRemoteVersion(localItem: any, remoteItem: any): boolean {
    const localModified = new Date(localItem.personalMetadata?.lastModified || 0).getTime();
    const remoteModified = new Date(remoteItem.personalMetadata?.lastModified || 0).getTime();
    
    return remoteModified > localModified;
  }

  private async resolveConflict(conflict: ConflictItem): Promise<void> {
    switch (this.config.conflictResolution) {
      case 'local':
        // Keep local version - do nothing
        break;
      case 'remote':
        // Use remote version
        if (conflict.type === 'recipe') {
          await recipeStorage.saveRecipe(conflict.remoteVersion, 'synced');
        }
        break;
      case 'merge':
        // Merge versions (simple strategy: keep local user data, use remote for metadata)
        const merged = this.mergeVersions(conflict.localVersion, conflict.remoteVersion);
        if (conflict.type === 'recipe') {
          await recipeStorage.saveRecipe(merged, 'synced');
        }
        break;
      case 'manual':
        // Store conflict for manual resolution
        await this.storeConflictForManualResolution(conflict);
        break;
    }
  }

  private mergeVersions(local: any, remote: any): any {
    return {
      ...remote, // Use remote as base
      personalMetadata: {
        ...remote.personalMetadata,
        ...local.personalMetadata, // Keep local personal data
        lastModified: new Date().toISOString(),
      },
      personalNotes: local.personalNotes || remote.personalNotes,
      personalRating: local.personalMetadata?.personalRating || remote.personalMetadata?.personalRating,
    };
  }

  private async storeConflictForManualResolution(conflict: ConflictItem): Promise<void> {
    try {
      const conflicts = await AsyncStorage.getItem('@sync_conflicts');
      const existing = conflicts ? JSON.parse(conflicts) : [];
      existing.push(conflict);
      await AsyncStorage.setItem('@sync_conflicts', JSON.stringify(existing));
    } catch (error) {
      console.error('Failed to store conflict:', error);
    }
  }

  // Status and Configuration
  public getStatus(): SyncStatus {
    return {
      isOnline: this.isOnline,
      lastSyncTime: 0, // Will be loaded from AsyncStorage
      pendingChanges: this.syncQueue.length,
      syncInProgress: this.syncInProgress,
      errors: this.syncQueue.filter(e => e.lastError),
    };
  }

  public updateConfig(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.autoSyncEnabled !== undefined) {
      if (newConfig.autoSyncEnabled) {
        this.startAutoSync();
      } else {
        this.stopAutoSync();
      }
    }
  }

  // Event Listeners
  public addStatusListener(listener: (status: SyncStatus) => void): void {
    this.listeners.push(listener);
  }

  public removeStatusListener(listener: (status: SyncStatus) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(listener => listener(status));
  }

  // Manual Operations
  public async forcePullFromServer(): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Cannot pull from server while offline');
    }
    
    await this.pullChangesFromServer();
  }

  public async forcePushToServer(): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Cannot push to server while offline');
    }
    
    await this.pushChangesToServer();
  }

  public async clearSyncQueue(): Promise<void> {
    this.syncQueue = [];
    await this.saveSyncQueue();
    this.notifyListeners();
  }

  public async getConflicts(): Promise<ConflictItem[]> {
    try {
      const conflicts = await AsyncStorage.getItem('@sync_conflicts');
      return conflicts ? JSON.parse(conflicts) : [];
    } catch (error) {
      console.error('Failed to get conflicts:', error);
      return [];
    }
  }

  public async resolveManualConflict(conflictId: string, resolution: 'local' | 'remote' | 'merged', mergedData?: any): Promise<void> {
    try {
      const conflicts = await this.getConflicts();
      const conflict = conflicts.find(c => c.id === conflictId);
      
      if (!conflict) return;

      let resolvedData;
      switch (resolution) {
        case 'local':
          resolvedData = conflict.localVersion;
          break;
        case 'remote':
          resolvedData = conflict.remoteVersion;
          break;
        case 'merged':
          resolvedData = mergedData || this.mergeVersions(conflict.localVersion, conflict.remoteVersion);
          break;
      }

      if (conflict.type === 'recipe') {
        await recipeStorage.saveRecipe(resolvedData, 'synced');
      }

      // Remove resolved conflict
      const remaining = conflicts.filter(c => c.id !== conflictId);
      await AsyncStorage.setItem('@sync_conflicts', JSON.stringify(remaining));
      
    } catch (error) {
      console.error('Failed to resolve manual conflict:', error);
    }
  }
}

// Export singleton instance
export const syncManager = SyncManager.getInstance();