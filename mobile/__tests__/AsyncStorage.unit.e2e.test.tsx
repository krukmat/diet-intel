import { prepareAsyncStorageScenario, inspectAsyncStorageKey, inspectAsyncStorageSnapshot } from './testUtils';

describe('AsyncStorage scenario helpers', () => {
  beforeEach(async () => {
    await prepareAsyncStorageScenario();
  });

  it('seeds canonical keys when provided with domain data', async () => {
    await prepareAsyncStorageScenario({
      seed: {
        weightHistory: [
          { id: '1', date: '2024-01-01', weight: 74.5 },
        ],
        photoLogs: [
          { id: 'photo_1', timestamp: '2024-01-15T10:00:00Z', photo: 'mock://photo.jpg' },
        ],
        reminders: [
          { id: 'rem_1', label: 'Hydrate', time: '08:00', days: [false, true, true, true, true, true, false], enabled: true },
        ],
      },
    });

    const weightHistory = inspectAsyncStorageKey('weight_history');
    const photoLogs = inspectAsyncStorageKey('photo_logs');
    const reminders = inspectAsyncStorageKey('reminders');

    expect(weightHistory).toEqual([
      expect.objectContaining({ weight: 74.5 }),
    ]);
    expect(photoLogs).toEqual([
      expect.objectContaining({ photo: 'mock://photo.jpg' }),
    ]);
    expect(reminders).toEqual([
      expect.objectContaining({ label: 'Hydrate' }),
    ]);
  });

  it('supports seeding arbitrary custom keys', async () => {
    await prepareAsyncStorageScenario({
      seed: {
        custom: {
          custom_key: { enabled: true },
        },
      },
    });

    const custom = inspectAsyncStorageKey('custom_key');
    expect(custom).toEqual({ enabled: true });
  });

  it('generates a full snapshot for inspection', async () => {
    await prepareAsyncStorageScenario({
      seed: {
        weightHistory: [
          { id: '1', date: '2024-01-01', weight: 70.1 },
        ],
        custom: {
          another_key: ['value'],
        },
      },
    });

    const snapshot = inspectAsyncStorageSnapshot();
    expect(snapshot).toMatchObject({
      weight_history: expect.any(Array),
      another_key: ['value'],
    });
  });
});
