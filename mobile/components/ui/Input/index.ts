/**
 * Input Component Exports
 * Barrel export for the complete Input component system
 *
 * Usage:
 * import { Input, InputSearch, InputNumber } from '@/components/ui/Input';
 */

// Main input components
export { Input } from './Input';
export { InputSearch } from './InputSearch';
export { InputNumber } from './InputNumber';

// Type exports
export type {
  InputProps,
  InputRef,
  InputSearchProps,
  InputNumberProps,
  InputVariant,
  InputSize,
  InputState,
  ValidationRule,
  InputValidationProps,
} from './Input.types';

// Style utilities (for advanced usage)
export {
  getInputStyles,
  inputLabelStyles,
  getInputHelperStyle,
  inputIconStyles,
  searchInputStyles,
  numberInputStyles,
  characterCounterStyles,
  staticStyles,
} from './Input.styles';