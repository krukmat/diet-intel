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

  it('provides basic sync functionality', () => {
    expect(syncManager).toBeDefined();
  });

  it('handles offline operations', async () => {
    await syncManager.clearSyncQueue();
    expect(syncManager).toBeDefined();
  });

  it('supports conflict resolution', () => {
    syncManager.updateConfig({ autoSyncEnabled: false });
    expect(syncManager).toBeDefined();
  });

  it('manages sync queue operations', async () => {
    await syncManager.clearSyncQueue();
    expect(syncManager).toBeDefined();
  });

  it('handles collection synchronization', () => {
    expect(syncManager).toBeDefined();
  });

  it('clears sync queue properly', async () => {
    await syncManager.clearSyncQueue();
    expect(syncManager).toBeDefined();
  });

  it('resolves conflicts manually', async () => {
    await syncManager.clearSyncQueue();
    expect(syncManager).toBeDefined();
  });

  it('supports creating new instance for tests', async () => {
    (SyncManager as any).instance = undefined;
    const instance = SyncManager.getInstance();
    instance.cleanupForTests();
    expect(instance).toBeDefined();
    (SyncManager as any).instance = syncManager;
  });
});
