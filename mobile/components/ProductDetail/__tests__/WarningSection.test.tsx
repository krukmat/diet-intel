/**
 * Tests unitarios para WarningSection component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { WarningSection } from '../WarningSection';

describe('WarningSection', () => {
  it('renders warning when source is not Product Database and confidence < 0.7', () => {
    const { getByText } = render(
      <WarningSection source="OCR Scan" confidence={0.65} />
    );
    expect(getByText('⚠️ Low Confidence Scan')).toBeTruthy();
    expect(getByText('This product information was extracted with low confidence. Please verify the nutrition values are accurate before adding to your plan.')).toBeTruthy();
  });

  it('does not render when source is Product Database', () => {
    const { queryByText } = render(
      <WarningSection source="Product Database" confidence={0.5} />
    );
    expect(queryByText('⚠️ Low Confidence Scan')).toBeNull();
  });

  it('does not render when confidence >= 0.7', () => {
    const { queryByText } = render(
      <WarningSection source="OCR Scan" confidence={0.8} />
    );
    expect(queryByText('⚠️ Low Confidence Scan')).toBeNull();
  });

  it('does not render when confidence is not provided', () => {
    const { queryByText } = render(
      <WarningSection source="OCR Scan" />
    );
    expect(queryByText('⚠️ Low Confidence Scan')).toBeNull();
  });

  it('renders warning when source is not provided but confidence is low', () => {
    const { getByText } = render(
      <WarningSection confidence={0.5} />
    );
    expect(getByText('⚠️ Low Confidence Scan')).toBeTruthy();
  });
});
