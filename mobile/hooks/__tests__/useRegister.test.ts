/**
 * Tests unitarios para el hook useRegister
 */

import { renderHook, act } from '@testing-library/react-native';
import { useRegister } from '../useRegister';
import { AuthService } from '../../services/AuthService';

// Mock del servicio de autenticación
jest.mock('../../services/AuthService');
const mockedAuthService = AuthService as jest.Mocked<typeof AuthService>;

describe('useRegister', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return initial state with empty form fields', () => {
      const { result } = renderHook(() => useRegister());

      expect(result.current.email).toBe('');
      expect(result.current.password).toBe('');
      expect(result.current.confirmPassword).toBe('');
      expect(result.current.loading).toBe(false);
      expect(result.current.errors).toEqual({});
    });
  });

  describe('form state management', () => {
    it('should update email when setEmail is called', () => {
      const { result } = renderHook(() => useRegister());

      act(() => {
        result.current.setEmail('test@example.com');
      });

      expect(result.current.email).toBe('test@example.com');
    });

    it('should update password when setPassword is called', () => {
      const { result } = renderHook(() => useRegister());

      act(() => {
        result.current.setPassword('ValidPass123!');
      });

      expect(result.current.password).toBe('ValidPass123!');
    });

    it('should update confirmPassword when setConfirmPassword is called', () => {
      const { result } = renderHook(() => useRegister());

      act(() => {
        result.current.setConfirmPassword('ValidPass123!');
      });

      expect(result.current.confirmPassword).toBe('ValidPass123!');
    });
  });

  describe('register function', () => {
    it('should return validation error for invalid form data', async () => {
      const { result } = renderHook(() => useRegister());

      let registerResult;
      await act(async () => {
        registerResult = await result.current.register();
      });

      expect(registerResult!.success).toBe(false);
      expect(registerResult!.error).toBe('Validation Error');
      expect(result.current.errors.email).toBeDefined();
    });

    it('should set loading state during registration', async () => {
      const { result } = renderHook(() => useRegister());

      // Set valid form data
      act(() => {
        result.current.setEmail('user@example.com');
        result.current.setPassword('ValidPass123!');
        result.current.setConfirmPassword('ValidPass123!');
      });

      // Mock successful registration
      mockedAuthService.registerUser.mockResolvedValueOnce({
        success: true,
        message: 'Account created successfully',
        user_id: '123'
      });

      let registerPromise;
      act(() => {
        registerPromise = result.current.register();
      });

      // Should be loading
      expect(result.current.loading).toBe(true);

      await act(async () => {
        await registerPromise;
      });

      // Should not be loading anymore
      expect(result.current.loading).toBe(false);
    });

    it('should call AuthService.registerUser with correct parameters', async () => {
      const { result } = renderHook(() => useRegister());

      const testEmail = 'user@example.com';
      const testPassword = 'ValidPass123!';

      act(() => {
        result.current.setEmail(testEmail);
        result.current.setPassword(testPassword);
        result.current.setConfirmPassword(testPassword);
      });

      mockedAuthService.registerUser.mockResolvedValueOnce({
        success: true,
        message: 'Account created successfully',
        user_id: '123'
      });

      await act(async () => {
        await result.current.register();
      });

      expect(mockedAuthService.registerUser).toHaveBeenCalledWith(testEmail, testPassword);
      expect(mockedAuthService.registerUser).toHaveBeenCalledTimes(1);
    });

    it('should clear form and errors on successful registration', async () => {
      const { result } = renderHook(() => useRegister());

      act(() => {
        result.current.setEmail('user@example.com');
        result.current.setPassword('ValidPass123!');
        result.current.setConfirmPassword('ValidPass123!');
      });

      // Set some errors first
      act(() => {
        result.current.setEmail('invalid-email');
      });

      mockedAuthService.registerUser.mockResolvedValueOnce({
        success: true,
        message: 'Account created successfully',
        user_id: '123'
      });

      await act(async () => {
        await result.current.register();
      });

      expect(result.current.email).toBe('');
      expect(result.current.password).toBe('');
      expect(result.current.confirmPassword).toBe('');
      expect(result.current.errors).toEqual({});
    });

    it('should set errors when validation fails', async () => {
      const { result } = renderHook(() => useRegister());

      act(() => {
        result.current.setEmail('invalid-email');
        result.current.setPassword('weak');
        result.current.setConfirmPassword('different');
      });

      await act(async () => {
        await result.current.register();
      });

      expect(result.current.errors.email).toBeDefined();
      expect(result.current.errors.password).toBeDefined();
      expect(result.current.errors.confirmPassword).toBeDefined();
    });

    it('should handle API errors gracefully', async () => {
      const { result } = renderHook(() => useRegister());

      act(() => {
        result.current.setEmail('user@example.com');
        result.current.setPassword('ValidPass123!');
        result.current.setConfirmPassword('ValidPass123!');
      });

      const apiError = {
        success: false,
        message: 'Email already exists',
        error: 'Conflict'
      };

      mockedAuthService.registerUser.mockResolvedValueOnce(apiError);

      let registerResult;
      await act(async () => {
        registerResult = await result.current.register();
      });

      expect(registerResult).toEqual(apiError);
      expect(result.current.loading).toBe(false);
    });

    it('should handle unexpected errors', async () => {
      const { result } = renderHook(() => useRegister());

      act(() => {
        result.current.setEmail('user@example.com');
        result.current.setPassword('ValidPass123!');
        result.current.setConfirmPassword('ValidPass123!');
      });

      mockedAuthService.registerUser.mockRejectedValueOnce(new Error('Network error'));

      let registerResult;
      await act(async () => {
        registerResult = await result.current.register();
      });

      expect(registerResult!.success).toBe(false);
      expect(registerResult!.error).toBe('Client Error');
      expect(result.current.loading).toBe(false);
    });
  });
});
