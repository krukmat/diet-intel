/**
 * Utilidades de validación para formularios
 * Funciones puras para validar email, contraseña y formularios completos
 */

/**
 * Valida si un email tiene formato correcto
 * @param email Email a validar
 * @returns true si es válido
 */
export const validateEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const trimmed = email.trim();

  // Validar formato básico con regex estándar (RFC 5322 simplificado)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return false;
  }

  // Validar longitud razonable
  if (trimmed.length < 5 || trimmed.length > 254) {
    return false;
  }

  // Validar que no tenga caracteres problemáticos consecutivos
  if (trimmed.includes('..') || trimmed.startsWith('.') || trimmed.endsWith('.')) {
    return false;
  }

  // Validar que no haya punto justo después del @
  const atIndex = trimmed.indexOf('@');
  if (atIndex !== -1 && trimmed[atIndex + 1] === '.') {
    return false;
  }

  return true;
};

/**
 * Valida si una contraseña cumple con los requisitos de seguridad
 * @param password Contraseña a validar
 * @returns true si es válida
 */
export const validatePassword = (password: string): boolean => {
  if (!password || typeof password !== 'string') {
    return false;
  }

  // Longitud mínima
  if (password.length < 8) {
    return false;
  }

  // Longitud máxima razonable
  if (password.length > 128) {
    return false;
  }

  // Al menos una letra minúscula
  if (!/[a-z]/.test(password)) {
    return false;
  }

  // Al menos una letra mayúscula
  if (!/[A-Z]/.test(password)) {
    return false;
  }

  // Al menos un número
  if (!/\d/.test(password)) {
    return false;
  }

  // Al menos un carácter especial
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return false;
  }

  return true;
};

/**
 * Valida si la confirmación de contraseña coincide
 * @param password Contraseña original
 * @param confirmPassword Confirmación a validar
 * @returns true si coinciden
 */
export const validateConfirmPassword = (
  password: string,
  confirmPassword: string
): boolean => {
  if (!password || !confirmPassword) {
    return false;
  }

  return password === confirmPassword;
};

/**
 * Resultado de validación de formulario
 */
export interface FormValidationResult {
  isValid: boolean;
  errors: {
    email?: string;
    password?: string;
    confirmPassword?: string;
  };
}

/**
 * Valida un formulario de registro completo
 * @param formData Datos del formulario
 * @returns Resultado de validación con errores específicos
 */
export const validateRegistrationForm = (formData: {
  email: string;
  password: string;
  confirmPassword: string;
}): FormValidationResult => {
  const errors: FormValidationResult['errors'] = {};

  // Validar email
  if (!formData.email?.trim()) {
    errors.email = 'Email is required';
  } else if (!validateEmail(formData.email)) {
    errors.email = 'Please enter a valid email address';
  }

  // Validar password
  if (!formData.password?.trim()) {
    errors.password = 'Password is required';
  } else if (!validatePassword(formData.password)) {
    errors.password =
      'Password must be at least 8 characters with uppercase, lowercase, number, and special character';
  }

  // Validar confirmación de password
  if (!formData.confirmPassword?.trim()) {
    errors.confirmPassword = 'Please confirm your password';
  } else if (!validateConfirmPassword(formData.password, formData.confirmPassword)) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
