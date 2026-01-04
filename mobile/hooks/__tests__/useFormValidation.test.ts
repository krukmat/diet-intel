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

  it('validates on blur when configured', async () => {
    const { result } = renderHook(() =>
      useFormValidation(
        { name: '' },
        { name: { required: true, validateOnBlur: true } }
      )
    );

    await act(async () => {
      await result.current.setFieldTouched('name');
    });

    expect(result.current.errors.name?.message).toBe('This field is required');
  });

  it('skips validation when optional field is empty', async () => {
    const { result } = renderHook(() =>
      useFormValidation(
        { url: '' },
        { url: { rules: [validationRules.url()] } }
      )
    );

    let error;
    await act(async () => {
      error = await result.current.validateField('url', '');
    });

    expect(error).toBeNull();
  });

  it('captures validation errors when rule throws', async () => {
    const rule = {
      validator: () => {
        throw new Error('boom');
      },
      message: 'bad',
    };

    const { result } = renderHook(() =>
      useFormValidation(
        { name: 'value' },
        { name: { rules: [rule] } }
      )
    );

    let error;
    await act(async () => {
      error = await result.current.validateField('name', 'value');
    });

    expect(error?.message).toBe('Validation failed');
  });

  it('updates values and resets state', async () => {
    const { result } = renderHook(() =>
      useFormValidation(
        { name: 'start' },
        { name: { required: true } }
      )
    );

    await act(async () => {
      result.current.setValues({ name: 'updated' });
    });

    expect(result.current.values.name).toBe('updated');
    expect(result.current.isDirty).toBe(true);

    await act(async () => {
      result.current.reset({ name: 'reset' });
    });

    expect(result.current.values.name).toBe('reset');
    expect(result.current.isDirty).toBe(false);
    expect(result.current.errors.name).toBeUndefined();
  });

  it('summarizes validation warnings', async () => {
    const warningRule = {
      validator: () => false,
      message: 'warn',
      type: 'warning' as const,
    };

    const { result } = renderHook(() =>
      useFormValidation(
        { name: 'x' },
        { name: { rules: [warningRule], validateOnChange: true } }
      )
    );

    await act(async () => {
      await result.current.setFieldValue('name', 'x');
    });

    expect(result.current.validationSummary.totalWarnings).toBe(1);
    expect(result.current.validationSummary.hasWarnings).toBe(true);
  });
});
