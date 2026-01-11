import axios from 'axios';
import { ApiHelper } from '../apiHelper';
import { getEnvironmentConfig } from '../../config/environments';

jest.mock('axios');
jest.mock('../../config/environments', () => ({
  getEnvironmentConfig: jest.fn(() => ({ apiBaseUrl: 'http://mock-api.local' }))
}));

type AxiosInstanceMock = ReturnType<typeof createAxiosInstanceMock>;

const createAxiosInstanceMock = () => {
  const instance = jest.fn() as any;
  instance.get = jest.fn();
  instance.post = jest.fn();
  instance.put = jest.fn();
  instance.delete = jest.fn();
  instance.defaults = { baseURL: '', timeout: 0 };
  instance.interceptors = {
    request: { use: jest.fn() },
    response: { use: jest.fn() }
  };

  return instance;
};

describe('ApiHelper', () => {
  let axiosInstance: AxiosInstanceMock;
  let responseSuccess: any;
  let responseError: any;

  beforeEach(() => {
    jest.clearAllMocks();
    axiosInstance = createAxiosInstanceMock();
    (axios.create as jest.Mock).mockReturnValue(axiosInstance);

    axiosInstance.interceptors.request.use.mockImplementation(() => undefined);
    axiosInstance.interceptors.response.use.mockImplementation((onSuccess: any, onError: any) => {
      responseSuccess = onSuccess;
      responseError = onError;
    });
  });

  it('creates axios client with environment config defaults', () => {
    new ApiHelper();

    expect(getEnvironmentConfig).toHaveBeenCalled();
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: 'http://mock-api.local',
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });
  });

  it('logs and returns request config in request interceptor', () => {
    const helper = new ApiHelper();
    const config = { method: 'get', url: '/test' };

    const requestInterceptor = axiosInstance.interceptors.request.use.mock.calls[0][0];
    const result = requestInterceptor(config);

    expect(result).toBe(config);
  });

  it('returns response from response interceptor', () => {
    new ApiHelper();
    const response = { status: 200, config: { url: '/ok' } };

    expect(responseSuccess(response)).toBe(response);
  });

  it('retries network errors and calls axios instance', async () => {
    jest.useFakeTimers();
    axiosInstance.mockResolvedValue({ data: { ok: true } });

    new ApiHelper({ maxRetries: 2, retryDelay: 200 });

    const error: any = { config: { url: '/retry' } };
    const promise = responseError(error);

    jest.advanceTimersByTime(200);

    await expect(promise).resolves.toEqual({ data: { ok: true } });
    expect(axiosInstance).toHaveBeenCalledWith({ url: '/retry', _retry: true, _retryCount: 1 });

    jest.useRealTimers();
  });

  it('does not retry on client errors and transforms error', async () => {
    new ApiHelper();

    const error: any = {
      message: 'Bad Request',
      response: { status: 400, data: { detail: 'Nope' } },
      config: { url: '/bad' }
    };

    await expect(responseError(error)).rejects.toMatchObject({
      message: 'Nope',
      status: 400,
      data: { detail: 'Nope' }
    });
  });

  it('transforms product response and returns null on not found', async () => {
    axiosInstance.post.mockResolvedValueOnce({
      data: {
        found: true,
        barcode: '123',
        product_name: 'Test Product',
        nutriments: { 'energy-kcal_100g': 100 }
      }
    });

    const helper = new ApiHelper();
    const result = await helper.getProductByBarcode('123');

    expect(result).toEqual({
      id: '123',
      name: 'Test Product',
      barcode: '123',
      nutriments: { energy_kcal: 100, proteins: undefined, fat: undefined, carbohydrates: undefined, sugars: undefined, salt: undefined },
      image_url: undefined,
      brands: undefined,
      categories: undefined
    });

    axiosInstance.post.mockResolvedValueOnce({ data: { found: false } });
    const notFound = await helper.getProductByBarcode('999');
    expect(notFound).toBeNull();
  });

  it('returns null for 404 error on getProductByBarcode', async () => {
    axiosInstance.post.mockRejectedValue({ status: 404 });

    const helper = new ApiHelper();
    const result = await helper.getProductByBarcode('404');

    expect(result).toBeNull();
  });

  it('uploads label image with multipart headers', async () => {
    (global as any).FormData = class {
      append = jest.fn();
    };

    axiosInstance.post.mockResolvedValue({ data: { ok: true } });
    const helper = new ApiHelper();

    const result = await helper.uploadLabelImage('file://image.jpg');

    expect(result).toEqual({ ok: true });
    expect(axiosInstance.post).toHaveBeenCalledWith(
      '/product/scan-label',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  });

  it('uploads label image using external endpoint', async () => {
    (global as any).FormData = class {
      append = jest.fn();
    };

    axiosInstance.post.mockResolvedValue({ data: { ok: true } });
    const helper = new ApiHelper();

    const result = await helper.uploadLabelImageExternal('file://image.jpg');

    expect(result).toEqual({ ok: true });
    expect(axiosInstance.post).toHaveBeenCalledWith(
      '/product/scan-label-external',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  });

  it('retries on server errors until max retries is reached', async () => {
    jest.useFakeTimers();
    axiosInstance.mockResolvedValue({ data: { ok: true } });

    new ApiHelper({ maxRetries: 1, retryDelay: 100 });

    const error: any = {
      response: { status: 500 },
      config: { url: '/retry-server' }
    };

    const promise = responseError(error);
    jest.advanceTimersByTime(100);

    await expect(promise).resolves.toEqual({ data: { ok: true } });
    expect(axiosInstance).toHaveBeenCalledWith({ url: '/retry-server', _retry: true, _retryCount: 1 });

    jest.useRealTimers();
  });

  it('supports meal plan operations', async () => {
    axiosInstance.post.mockResolvedValueOnce({ data: { id: 'plan' } });
    axiosInstance.put.mockResolvedValueOnce({ data: { id: 'plan-updated' } });
    axiosInstance.post.mockResolvedValueOnce({ data: { success: true, message: 'Added' } });
    axiosInstance.get.mockResolvedValueOnce({ data: { maxCalories: 2000 } });

    const helper = new ApiHelper();

    await expect(helper.generateMealPlan({ age: 30, sex: 'male', height_cm: 170, weight_kg: 70, activity_level: 2, goal: 'maintain' }))
      .resolves.toEqual({ id: 'plan' });
    await expect(helper.customizeMealPlan('plan-1', { meal_type: 'lunch', action: 'add', item: { barcode: '1', name: 'Item', serving_size: '1', calories_per_serving: 100, protein_g: 10, fat_g: 2, carbs_g: 5 } }))
      .resolves.toEqual({ id: 'plan-updated' });
    await expect(helper.addProductToPlan({ barcode: '1', meal_type: 'lunch' }))
      .resolves.toEqual({ success: true, message: 'Added' });
    await expect(helper.getMealPlanConfig()).resolves.toEqual({ maxCalories: 2000 });
  });

  it('searches products and maps response', async () => {
    axiosInstance.get.mockResolvedValueOnce({
      data: {
        products: [
          { code: '111', product_name: 'Bar', nutriments: { energy_kcal: 120 } },
        ],
      },
    });

    const helper = new ApiHelper();
    const result = await helper.searchProducts('bar');

    expect(axiosInstance.get).toHaveBeenCalledWith('/product/search?q=bar');
    expect(result[0]).toEqual(expect.objectContaining({ barcode: '111', name: 'Bar' }));
  });

  it('updates configuration and base URL', () => {
    const helper = new ApiHelper();

    helper.updateConfig({ baseURL: 'http://new-api', timeout: 5000 });

    expect(axiosInstance.defaults.baseURL).toBe('http://new-api');
    expect(axiosInstance.defaults.timeout).toBe(5000);

    helper.setBaseURL('http://another-api');
    expect(axiosInstance.defaults.baseURL).toBe('http://another-api');
  });
});
