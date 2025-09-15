/**
 * UI Components Library
 * Central export for all DietIntel design system components
 *
 * Phase 1: Design System Foundation
 * - Button: Complete ✅
 * - Card: Complete ✅
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

// Card Component System
export {
  Card,
  CardHeader,
  CardBody,
  CardFooter
} from './Card';
export type {
  CardProps,
  CardHeaderProps,
  CardBodyProps,
  CardFooterProps,
  CardVariant,
  CardPadding,
  CardShadow,
  CardStatsProps,
  CardActionProps
} from './Card';

// Design Tokens (for component consumers)
export { tokens } from '../../styles/tokens';

// More components will be added here as we implement them:
// export { Input } from './Input';
// export { Container, Section, Spacer, Grid } from './Layout';