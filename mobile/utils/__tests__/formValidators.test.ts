/**
 * Tests unitarios para utilidades de validación de formularios
 */

import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validateRegistrationForm
} from '../formValidators';

describe('formValidators', () => {
  describe('validateEmail', () => {
    it('should return true for valid emails', () => {
      const validEmails = [
        'user@example.com',
        'test.email+tag@domain.co.uk',
        'user123@test-domain.com',
        'a@b.co',
        'test.email@subdomain.domain.org'
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should return false for invalid emails', () => {
      const invalidEmails = [
        '', // empty string
        '   ', // whitespace only
        'invalid', // no @
        '@domain.com', // no username
        'user@', // no domain
        'user@domain', // no TLD
        'user..double@domain.com', // double dots
        '.user@domain.com', // starts with dot
        'user@domain.', // ends with dot
        'user@.domain.com', // dot after @
        'verylongemailaddress' + 'a'.repeat(250) + '@example.com', // too long
      ];

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });

    it('should return false for non-string inputs', () => {
      expect(validateEmail(null as any)).toBe(false);
      expect(validateEmail(undefined as any)).toBe(false);
      expect(validateEmail(123 as any)).toBe(false);
      expect(validateEmail({} as any)).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should return true for valid passwords', () => {
      const validPasswords = [
        'Abc123!@#',
        'Password123$',
        'Test123!@#',
        'MySecure1!',
        'Complex!123Password'
      ];

      validPasswords.forEach(password => {
        expect(validatePassword(password)).toBe(true);
      });
    });

    it('should return false for invalid passwords', () => {
      const invalidPasswords = [
        '', // empty
        'short', // too short
        'nouppercase123!', // no uppercase
        'NOLOWERCASE123!', // no lowercase
        'NoNumbers!', // no numbers
        'NoSpecial123', // no special characters
        'OnlyLower123', // no uppercase
        'ONLYUPPER123!', // no lowercase
        'OnlyLetters!', // no numbers
        '123456789!', // no letters
        'a'.repeat(200) + '1A!', // too long
        'Valid123!' + 'a'.repeat(120) // way too long
      ];

      invalidPasswords.forEach(password => {
        expect(validatePassword(password)).toBe(false);
      });
    });

    it('should return false for non-string inputs', () => {
      expect(validatePassword(null as any)).toBe(false);
      expect(validatePassword(undefined as any)).toBe(false);
      expect(validatePassword(123 as any)).toBe(false);
      expect(validatePassword({} as any)).toBe(false);
    });
  });

  describe('validateConfirmPassword', () => {
    it('should return true when passwords match', () => {
      expect(validateConfirmPassword('Password123!', 'Password123!')).toBe(true);
      expect(validateConfirmPassword('Test123!', 'Test123!')).toBe(true);
      expect(validateConfirmPassword('a', 'a')).toBe(true);
    });

    it('should return false when passwords do not match', () => {
      expect(validateConfirmPassword('Password123!', 'password123!')).toBe(false);
      expect(validateConfirmPassword('Test123!', 'Test123')).toBe(false);
      expect(validateConfirmPassword('a', 'b')).toBe(false);
      expect(validateConfirmPassword('Password123!', '')).toBe(false);
      expect(validateConfirmPassword('', 'Password123!')).toBe(false);
    });

    it('should return false for empty or invalid inputs', () => {
      expect(validateConfirmPassword('', '')).toBe(false);
      expect(validateConfirmPassword('', 'password')).toBe(false);
      expect(validateConfirmPassword('password', '')).toBe(false);
      expect(validateConfirmPassword(null as any, 'password')).toBe(false);
      expect(validateConfirmPassword('password', null as any)).toBe(false);
    });
  });

  describe('validateRegistrationForm', () => {
    it('should return valid result for valid form data', () => {
      const validForm = {
        email: 'user@example.com',
        password: 'ValidPass123!',
        confirmPassword: 'ValidPass123!'
      };

      const result = validateRegistrationForm(validForm);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should return errors for invalid email', () => {
      const invalidEmailForm = {
        email: 'invalid-email',
        password: 'ValidPass123!',
        confirmPassword: 'ValidPass123!'
      };

      const result = validateRegistrationForm(invalidEmailForm);

      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBe('Please enter a valid email address');
      expect(result.errors.password).toBeUndefined();
      expect(result.errors.confirmPassword).toBeUndefined();
    });

    it('should return errors for missing email', () => {
      const missingEmailForm = {
        email: '',
        password: 'ValidPass123!',
        confirmPassword: 'ValidPass123!'
      };

      const result = validateRegistrationForm(missingEmailForm);

      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBe('Email is required');
    });

    it('should return errors for invalid password', () => {
      const invalidPasswordForm = {
        email: 'user@example.com',
        password: 'weak',
        confirmPassword: 'weak'
      };

      const result = validateRegistrationForm(invalidPasswordForm);

      expect(result.isValid).toBe(false);
      expect(result.errors.password).toContain('Password must be at least 8 characters');
    });

    it('should return errors for missing password', () => {
      const missingPasswordForm = {
        email: 'user@example.com',
        password: '',
        confirmPassword: ''
      };

      const result = validateRegistrationForm(missingPasswordForm);

      expect(result.isValid).toBe(false);
      expect(result.errors.password).toBe('Password is required');
    });

    it('should return errors for mismatched passwords', () => {
      const mismatchedPasswordsForm = {
        email: 'user@example.com',
        password: 'ValidPass123!',
        confirmPassword: 'DifferentPass123!'
      };

      const result = validateRegistrationForm(mismatchedPasswordsForm);

      expect(result.isValid).toBe(false);
      expect(result.errors.confirmPassword).toBe('Passwords do not match');
    });

    it('should return errors for missing confirm password', () => {
      const missingConfirmPasswordForm = {
        email: 'user@example.com',
        password: 'ValidPass123!',
        confirmPassword: ''
      };

      const result = validateRegistrationForm(missingConfirmPasswordForm);

      expect(result.isValid).toBe(false);
      expect(result.errors.confirmPassword).toBe('Please confirm your password');
    });

    it('should return multiple errors for multiple invalid fields', () => {
      const multipleErrorsForm = {
        email: 'invalid-email',
        password: 'weak',
        confirmPassword: 'different'
      };

      const result = validateRegistrationForm(multipleErrorsForm);

      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBeDefined();
      expect(result.errors.password).toBeDefined();
      expect(result.errors.confirmPassword).toBeDefined();
    });
  });
});
