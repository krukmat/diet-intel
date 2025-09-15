/**
 * Layout Component Exports
 * Barrel export for the complete Layout component system
 */

// Main layout components
export { Container } from './Container';
export { Section } from './Section';
export { Spacer } from './Spacer';
export { Grid, GridItem } from './Grid';

// Type exports
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
  SpacerDirection,
} from './Layout.types';