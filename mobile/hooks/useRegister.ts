/**
 * Custom hook para manejar el estado y lógica del formulario de registro
 */

import { useState } from 'react';
import { AuthService, RegisterResult } from '../services/AuthService';
import { validateRegistrationForm, FormValidationResult } from '../utils/formValidators';

export interface UseRegisterResult {
  // Estado del formulario
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  confirmPassword: string;
  setConfirmPassword: (confirmPassword: string) => void;

  // Estado de la operación
  loading: boolean;
  errors: FormValidationResult['errors'];

  // Función de registro
  register: () => Promise<RegisterResult>;
}

/**
 * Hook personalizado para manejar el formulario de registro
 * Incluye validación, estado y llamada a la API
 */
export const useRegister = (): UseRegisterResult => {
  // Estado del formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Estado de la operación
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormValidationResult['errors']>({});

  /**
   * Función de registro que valida y envía los datos
   */
  const register = async (): Promise<RegisterResult> => {
    // Limpiar errores previos
    setErrors({});

    // Validar formulario
    const validationResult = validateRegistrationForm({
      email,
      password,
      confirmPassword
    });

    // Si hay errores de validación, mostrarlos y retornar
    if (!validationResult.isValid) {
      setErrors(validationResult.errors);
      return {
        success: false,
        message: 'Please correct the errors below',
        error: 'Validation Error'
      };
    }

    // Iniciar operación
    setLoading(true);

    try {
      // Llamar al servicio de autenticación
      const result = await AuthService.registerUser(email, password);

      // Si fue exitoso, limpiar el formulario
      if (result.success) {
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setErrors({});
      }

      return result;
    } catch (error) {
      console.error('useRegister.register error:', error);

      return {
        success: false,
        message: 'An unexpected error occurred during registration',
        error: 'Client Error'
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    // Estado del formulario
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,

    // Estado de la operación
    loading,
    errors,

    // Función de registro
    register
  };
};
