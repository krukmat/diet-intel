import { renderHook, act } from '@testing-library/react-native';
import { useFormValidation, validationRules } from '../useFormValidation';
import { errorHandler } from '../../services/ErrorHandler';

jest.mock('../../services/ErrorHandler', () => ({
  errorHandler: {
    handleError: jest.fn(),
  },
  ErrorCategory: {} ,
  ErrorSeverity: {},
}));

describe('useFormValidation', () => {
  it('validates required field on submit', async () => {
    const { result } = renderHook(() =>
      useFormValidation(
        { name: '' },
        { name: { required: true, validateOnChange: true } }
      )
    );

    let isValid = false;
    await act(async () => {
      isValid = await result.current.handleSubmit(() => undefined);
    });

    expect(isValid).toBe(false);
    expect(result.current.errors.name?.message).toBe('This field is required');
  });

  it('sanitizes and validates on change', async () => {
    const { result } = renderHook(() =>
      useFormValidation(
        { name: '' },
        {
          name: {
            sanitizer: (value: string) => value.trim(),
            rules: [validationRules.minLength(2)],
            validateOnChange: true,
          },
        }
      )
    );

    await act(async () => {
      await result.current.setFieldValue('name', ' a ');
    });

    expect(result.current.values.name).toBe('a');
    expect(result.current.errors.name?.message).toBe('Must be at least 2 characters long');
  });

  it('calls onSubmit when form is valid', async () => {
    const onSubmit = jest.fn();

    const { result } = renderHook(() =>
      useFormValidation(
        { name: 'Valid' },
        { name: { required: true } }
      )
    );

    await act(async () => {
      await result.current.handleSubmit(onSubmit);
    });

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Valid' });
  });

  it('invokes error handler on submit failure', async () => {
    const onSubmit = jest.fn(() => {
      throw new Error('boom');
    });

    const { result } = renderHook(() =>
      useFormValidation(
        { name: 'Valid' },
        { name: { required: true } }
      )
    );

    await act(async () => {
      await result.current.handleSubmit(onSubmit);
    });

    expect(errorHandler.handleError).toHaveBeenCalled();
  });

  it('handles async validation rule', async () => {
    jest.useFakeTimers();

    const { result } = renderHook(() =>
      useFormValidation(
        { name: 'existing recipe' },
        { name: { rules: [validationRules.uniqueRecipeName()] } }
      )
    );

    let error;
    await act(async () => {
      const promise = result.current.validateField('name', 'existing recipe');
      jest.advanceTimersByTime(500);
      error = await promise;
    });

    expect(error?.message).toBe('This recipe name already exists');
    jest.useRealTimers();
  });
});
