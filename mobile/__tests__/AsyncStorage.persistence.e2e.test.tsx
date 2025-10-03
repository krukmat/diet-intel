import { act, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {
  renderTrackScreenForAsyncStorage,
  renderReminderSnippetForAsyncStorage,
  prepareAsyncStorageScenario,
  inspectAsyncStorageKey,
  mockApiService,
  mockedAsyncStorage,
} from './testUtils';

jest.mock('../services/ApiService', () => {
  const { mockApiService } = require('./testUtils');
  const serviceMock = { ...mockApiService };

  return {
    __esModule: true,
    apiService: serviceMock,
    ApiService: jest.fn(() => serviceMock),
    default: jest.fn(() => serviceMock),
  };
});

jest.mock('react-i18next', () => {
  const { createTranslationMock } = require('./testUtils');
  return createTranslationMock();
});

const apiModule = require('../services/ApiService') as typeof import('../services/ApiService');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const imagePicker = require('expo-image-picker') as { launchCameraAsync: jest.Mock };
const imageManipulator = require('expo-image-manipulator') as { manipulateAsync: jest.Mock };

type TrackScreenRender = Awaited<ReturnType<typeof renderTrackScreenForAsyncStorage>>;
type ReminderSnippetRender = Awaited<ReturnType<typeof renderReminderSnippetForAsyncStorage>>;

const submitWeighIn = async (
  utils: TrackScreenRender,
  weight: number,
) => {
  mockedAsyncStorage.setItem.mockClear();

  const weighInButton = await utils.findByText('track.weighIn');

  await act(async () => {
    fireEvent.press(weighInButton);
  });

  const weightInput = await utils.findByPlaceholderText('scanner.input.weightPlaceholder');
  fireEvent.changeText(weightInput, weight.toFixed(1));

  const saveButton = utils.getByText('track.modal.saveWeight');

  await act(async () => {
    fireEvent.press(saveButton);
  });

  await waitFor(() => {
    expect(mockApiService.post).toHaveBeenCalledWith(
      expect.stringContaining('/track/weight'),
      expect.objectContaining({ weight }),
    );
  });

  await waitFor(() => {
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      'weight_history',
      expect.any(String),
    );
  });

  await waitFor(() => {
    const storedHistory = inspectAsyncStorageKey<Array<{ weight: number }>>('weight_history');
    expect(storedHistory).not.toBeNull();
  });
};

beforeEach(async () => {
  await prepareAsyncStorageScenario();
  jest.clearAllMocks();

  Object.assign(AsyncStorage, mockedAsyncStorage);

  Object.assign(apiModule.apiService, mockApiService);

  mockApiService.get.mockImplementation(async (url: string) => {
    if (url.includes('/track/weight/history')) {
      return { data: { entries: [] } };
    }

    if (url.includes('/track/photos')) {
      return { data: { logs: [] } };
    }

    return { data: {} };
  });

  mockApiService.post.mockResolvedValue({ data: { success: true } });
  mockApiService.put.mockResolvedValue({ data: { success: true } });
  mockApiService.delete.mockResolvedValue({ data: { success: true } });

  mockedAxios.get.mockResolvedValue({ data: { reminders: [] } });
  mockedAxios.post.mockResolvedValue({ data: { success: true } });
  mockedAxios.put.mockResolvedValue({ data: { success: true } });
  mockedAxios.delete.mockResolvedValue({ data: { success: true } });
});

describe('TrackScreen AsyncStorage persistence', () => {
  it('stores weight entries when submitting a weigh-in', async () => {
    const utils: TrackScreenRender = await renderTrackScreenForAsyncStorage();

    await submitWeighIn(utils, 74.5);

    const storedHistory = inspectAsyncStorageKey<Array<{ weight: number }>>('weight_history');
    expect(storedHistory).not.toBeNull();
    expect(storedHistory![storedHistory!.length - 1].weight).toBeCloseTo(74.5);
  });

  it('retains only the ten most recent weight entries', async () => {
    const utils: TrackScreenRender = await renderTrackScreenForAsyncStorage();

    for (let i = 0; i < 12; i += 1) {
      await submitWeighIn(utils, 70 + i * 0.3);
    }

    const storedHistory = inspectAsyncStorageKey<Array<{ weight: number }>>('weight_history');
    expect(storedHistory).not.toBeNull();
    expect(storedHistory!.length).toBe(10);
    expect(storedHistory![storedHistory!.length - 1].weight).toBeCloseTo(70 + 11 * 0.3, 5);
  });

});

describe('ReminderSnippet AsyncStorage persistence', () => {
  it('persists new reminders created through the modal', async () => {
    const utils: ReminderSnippetRender = await renderReminderSnippetForAsyncStorage();

    mockedAsyncStorage.setItem.mockClear();

    await utils.findByText('No reminders set');

    const addReminderButton = await utils.findByText('+ Add Reminder');

    await act(async () => {
      fireEvent.press(addReminderButton);
    });

    const labelInput = await utils.findByPlaceholderText('e.g., Breakfast time');
    fireEvent.changeText(labelInput, 'Hydration Reminder');

    const createButton = utils.getByText('Create Reminder');
    await act(async () => {
      fireEvent.press(createButton);
    });

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/reminder'),
        expect.objectContaining({ label: 'Hydration Reminder' }),
      );
    });

    await utils.findByText(/Hydration Reminder/);

    await waitFor(() => {
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
        'reminders',
        expect.any(String),
      );
    });

    await waitFor(() => {
      const reminders = inspectAsyncStorageKey<Array<{ label: string }>>('reminders');
      expect(reminders).not.toBeNull();
      expect(reminders!.some(reminder => reminder.label === 'Hydration Reminder')).toBe(true);
    });
  });
});
