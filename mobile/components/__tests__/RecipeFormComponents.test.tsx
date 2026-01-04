import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MultiSelect, CheckboxGroup, RadioGroup } from '../RecipeFormComponents';

describe('MultiSelect', () => {
  it('opens modal and toggles options', () => {
    const onSelectionChange = jest.fn();
    const { getByText, getByPlaceholderText } = render(
      <MultiSelect
        title="Cuisine"
        options={[
          { value: 'it', label: 'Italian' },
          { value: 'mx', label: 'Mexican' },
        ]}
        selectedValues={[]}
        onSelectionChange={onSelectionChange}
      />
    );

    fireEvent.press(getByText('Select options'));
    fireEvent.press(getByText('Italian'));
    expect(onSelectionChange).toHaveBeenCalledWith(['it']);
  });
});

describe('CheckboxGroup', () => {
  it('toggles checkbox options', () => {
    const onSelectionChange = jest.fn();
    const { getByText } = render(
      <CheckboxGroup
        title="Diet"
        options={[{ value: 'veg', label: 'Vegetarian' }]}
        selectedValues={[]}
        onSelectionChange={onSelectionChange}
      />
    );

    fireEvent.press(getByText('Vegetarian'));
    expect(onSelectionChange).toHaveBeenCalledWith(['veg']);
  });
});

describe('RadioGroup', () => {
  it('selects radio option', () => {
    const onSelectionChange = jest.fn();
    const { getByText } = render(
      <RadioGroup
        title="Difficulty"
        options={[
          { value: 'easy', label: 'Easy' },
          { value: 'hard', label: 'Hard' },
        ]}
        selectedValue="easy"
        onSelectionChange={onSelectionChange}
      />
    );

    fireEvent.press(getByText('Hard'));
    expect(onSelectionChange).toHaveBeenCalledWith('hard');
  });
});
