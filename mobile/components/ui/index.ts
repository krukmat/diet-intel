/**
 * UI Components Library
 * Central export for all DietIntel design system components
 *
 * Phase 1: Design System Foundation
 * - Button: Complete ✅
 * - Card: Coming next
 * - Input: Coming next
 * - Layout: Coming next
 */

// Button Component System
export { Button } from './Button';
export type {
  ButtonProps,
  ButtonVariant,
  ButtonSize,
  ButtonWidth
} from './Button';

// Design Tokens (for component consumers)
export { tokens } from '../../styles/tokens';

// More components will be added here as we implement them:
// export { Card } from './Card';
// export { Input } from './Input';
// export { Container, Section, Spacer, Grid } from './Layout';