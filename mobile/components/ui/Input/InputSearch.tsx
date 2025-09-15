/**
 * InputSearch Component
 * Specialized search input with icon and clear functionality
 * Solves inconsistent search field styling across screens
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { Input } from './Input';
import { InputSearchProps } from './Input.types';
import { searchInputStyles } from './Input.styles';
import { tokens } from '../../../styles/tokens';

/**
 * Search Icon Component
 */
const SearchIcon: React.FC<{ color?: string }> = ({ color = tokens.colors.text.secondary }) => (
  <View style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ fontSize: 16, color }}>🔍</Text>
  </View>
);

/**
 * InputSearch Component
 * Search-specific input with suggestions and clear functionality
 */
export const InputSearch: React.FC<InputSearchProps> = ({
  placeholder = 'Search...',
  onSearch,
  showSuggestions = false,
  suggestions = [],
  onSuggestionSelect,
  onChangeText,
  value,
  testID,
  ...inputProps
}) => {
  const [searchValue, setSearchValue] = useState(value || '');
  const [showSuggestionsList, setShowSuggestionsList] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);

  // Handle text change
  const handleChangeText = (text: string) => {
    setSearchValue(text);
    onChangeText?.(text);

    // Filter suggestions if enabled
    if (showSuggestions && suggestions.length > 0) {
      const filtered = suggestions.filter(suggestion =>
        suggestion.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestionsList(text.length > 0 && filtered.length > 0);
    }
  };

  // Handle search submission
  const handleSubmitEditing = () => {
    onSearch?.(searchValue);
    setShowSuggestionsList(false);
  };

  // Handle suggestion selection
  const handleSuggestionPress = (suggestion: string) => {
    setSearchValue(suggestion);
    onChangeText?.(suggestion);
    onSuggestionSelect?.(suggestion);
    setShowSuggestionsList(false);
    onSearch?.(suggestion);
  };

  // Handle clear
  const handleClear = () => {
    setSearchValue('');
    onChangeText?.('');
    setShowSuggestionsList(false);
  };

  // Handle focus
  const handleFocus = () => {
    if (showSuggestions && filteredSuggestions.length > 0 && searchValue.length > 0) {
      setShowSuggestionsList(true);
    }
  };

  // Handle blur
  const handleBlur = () => {
    // Delay hiding suggestions to allow for selection
    setTimeout(() => {
      setShowSuggestionsList(false);
    }, 150);
  };

  return (
    <View style={searchInputStyles.container}>
      <Input
        variant="search"
        placeholder={placeholder}
        value={searchValue}
        onChangeText={handleChangeText}
        onSubmitEditing={handleSubmitEditing}
        onFocus={handleFocus}
        onBlur={handleBlur}
        leftIcon={<SearchIcon />}
        showClear={true}
        onClear={handleClear}
        testID={testID}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        {...inputProps}
      />

      {/* Suggestions List */}
      {showSuggestionsList && (
        <View style={searchInputStyles.suggestionsContainer}>
          <FlatList
            data={filteredSuggestions}
            keyExtractor={(item, index) => `${item}-${index}`}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[
                  searchInputStyles.suggestion,
                  index === filteredSuggestions.length - 1 && searchInputStyles.suggestionLast
                ]}
                onPress={() => handleSuggestionPress(item)}
                testID={testID ? `${testID}-suggestion-${index}` : `search-suggestion-${index}`}
              >
                <Text style={searchInputStyles.suggestionText}>{item}</Text>
              </TouchableOpacity>
            )}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </View>
  );
};

// Export types
export type { InputSearchProps } from './Input.types';