/**
 * Card Component Exports
 * Barrel export for the complete Card component system
 *
 * Usage:
 * import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/Card';
 */

// Main card component
export { Card } from './Card';

// Sub-components
export { CardHeader } from './CardHeader';
export { CardBody } from './CardBody';
export { CardFooter } from './CardFooter';

// Type exports
export type {
  CardProps,
  CardHeaderProps,
  CardBodyProps,
  CardFooterProps,
  CardVariant,
  CardPadding,
  CardShadow,
  CardStatsProps,
  CardActionProps,
} from './Card.types';

// Style utilities (for advanced usage)
export {
  getCardStyles,
  cardHeaderStyles,
  getCardBodyStyle,
  getCardFooterStyle,
  staticStyles,
} from './Card.styles';