import AsyncStorage from '@react-native-async-storage/async-storage';
import * as NetInfoModule from '@react-native-community/netinfo';
import { SyncManager, syncManager } from '../SyncManager';
import { recipeApi } from '../RecipeApiService';
import { recipeStorage } from '../RecipeStorageService';

jest.mock('../RecipeApiService', () => ({
  recipeApi: {
    getPersonalRecipes: jest.fn(),
    getCollections: jest.fn(),
    savePersonalRecipe: jest.fn(),
    deletePersonalRecipe: jest.fn(),
    createCollection: jest.fn(),
  },
}));

jest.mock('../RecipeStorageService', () => ({
  recipeStorage: {
    getRecipe: jest.fn(),
    saveRecipe: jest.fn(),
  },
}));

describe('SyncManager', () => {
  const mockRecipe = {
    id: 'r1',
    name: 'Recipe',
    personalMetadata: { lastModified: new Date().toISOString() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    syncManager.cleanupForTests();
    syncManager.updateConfig({ autoSyncEnabled: false });
    await syncManager.clearSyncQueue();
    (syncManager as any).isOnline = true;
    (syncManager as any).syncInProgress = false;
    (NetInfoModule as any).__setState({ isConnected: true, isInternetReachable: true });
  });

  it('queues recipe changes and syncs when online', async () => {
    (recipeStorage.getRecipe as jest.Mock).mockResolvedValue(mockRecipe);
    (recipeApi.getPersonalRecipes as jest.Mock).mockResolvedValue({ recipes: [] });
    (recipeApi.getCollections as jest.Mock).mockResolvedValue([]);

    (syncManager as any).syncQueue = [
      { id: 'r1', type: 'recipe', action: 'update', data: {}, timestamp: Date.now(), attempts: 0 },
    ];
    (syncManager as any).isOnline = true;
    await syncManager.performSync();

    expect(recipeApi.savePersonalRecipe).toHaveBeenCalled();
  });

  it('handles offline sync attempts', async () => {
    (syncManager as any).isOnline = false;
    (NetInfoModule as any).__setState({ isConnected: false, isInternetReachable: false });
    await expect(syncManager.forcePullFromServer()).rejects.toThrow('Cannot pull from server while offline');
    await expect(syncManager.forcePushToServer()).rejects.toThrow('Cannot push to server while offline');
  });

  it('resolves conflicts using remote strategy', async () => {
    syncManager.updateConfig({ conflictResolution: 'remote' });
    (recipeStorage.getRecipe as jest.Mock).mockResolvedValue({
      id: 'r1',
      personalMetadata: { lastModified: '2024-01-01T00:00:00Z' },
    });
    (recipeApi.getPersonalRecipes as jest.Mock).mockResolvedValue({
      recipes: [{ id: 'r1', personalMetadata: { lastModified: '2024-01-02T00:00:00Z' } }],
    });
    (recipeApi.getCollections as jest.Mock).mockResolvedValue([]);

    (syncManager as any).syncQueue = [
      { id: 'r1', type: 'recipe', action: 'update', data: {}, timestamp: Date.now(), attempts: 0 },
    ];
    (syncManager as any).isOnline = true;
    await syncManager.performSync();

    expect(recipeStorage.saveRecipe).toHaveBeenCalled();
  });

  it('stores conflicts for manual resolution', async () => {
    syncManager.updateConfig({ conflictResolution: 'manual' });
    (recipeStorage.getRecipe as jest.Mock).mockResolvedValue({
      id: 'r1',
      personalMetadata: { lastModified: '2024-01-01T00:00:00Z' },
    });
    (recipeApi.getPersonalRecipes as jest.Mock).mockResolvedValue({
      recipes: [{ id: 'r1', personalMetadata: { lastModified: '2024-01-02T00:00:02Z' } }],
    });
    (recipeApi.getCollections as jest.Mock).mockResolvedValue([]);

    (syncManager as any).syncQueue = [
      { id: 'r1', type: 'recipe', action: 'update', data: {}, timestamp: Date.now(), attempts: 0 },
    ];
    (syncManager as any).isOnline = true;
    await syncManager.performSync();

    const stored = await AsyncStorage.getItem('@sync_conflicts');
    expect(stored).toBeTruthy();
  });

  it('syncs collection create actions', async () => {
    (recipeApi.getPersonalRecipes as jest.Mock).mockResolvedValue({ recipes: [] });
    (recipeApi.getCollections as jest.Mock).mockResolvedValue([]);

    (syncManager as any).syncQueue = [
      { id: 'c1', type: 'collection', action: 'create', data: { name: 'Test' }, timestamp: Date.now(), attempts: 0 },
    ];
    (syncManager as any).isOnline = true;
    await syncManager.performSync();

    expect(recipeApi.createCollection).toHaveBeenCalledWith({ name: 'Test' });
  });

  it('clears sync queue', async () => {
    await syncManager.queueRecipeChange('r1', 'delete');
    expect(syncManager.getStatus().pendingChanges).toBe(1);
    await syncManager.clearSyncQueue();
    expect(syncManager.getStatus().pendingChanges).toBe(0);
  });

  it('resolves manual conflicts', async () => {
    const conflict = {
      id: 'r1',
      type: 'recipe',
      localVersion: { id: 'r1', personalMetadata: {} },
      remoteVersion: { id: 'r1', personalMetadata: {} },
      localModified: 1,
      remoteModified: 2,
    };
    await AsyncStorage.setItem('@sync_conflicts', JSON.stringify([conflict]));
    await syncManager.resolveManualConflict('r1', 'remote');
    expect(recipeStorage.saveRecipe).toHaveBeenCalled();
  });

  it('supports creating new instance for tests', async () => {
    (SyncManager as any).instance = undefined;
    const instance = SyncManager.getInstance();
    instance.cleanupForTests();
    expect(instance).toBeDefined();
    (SyncManager as any).instance = syncManager;
  });
});
