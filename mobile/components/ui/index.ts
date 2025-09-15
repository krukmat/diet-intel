/**
 * UI Components Library
 * Central export for all DietIntel design system components
 *
 * Phase 1: Design System Foundation - COMPLETE ✅
 * - Button: Complete ✅
 * - Card: Complete ✅
 * - Input: Complete ✅
 * - Layout: Complete ✅
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

// Input Component System
export {
  Input,
  InputSearch,
  InputNumber
} from './Input';
export type {
  InputProps,
  InputRef,
  InputSearchProps,
  InputNumberProps,
  InputVariant,
  InputSize,
  InputState,
  ValidationRule,
  InputValidationProps
} from './Input';

// Layout Component System
export {
  Container,
  Section,
  Spacer,
  Grid,
  GridItem
} from './Layout';
export type {
  ContainerProps,
  SectionProps,
  SpacerProps,
  GridProps,
  GridItemProps,
  ContainerVariant,
  ContainerPadding,
  SectionSpacing,
  GridColumns,
  SpacerDirection
} from './Layout';

// Design Tokens (for component consumers)
export { tokens } from '../../styles/tokens';