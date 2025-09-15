/**
 * Input Component Test Screen
 * Demonstrates all Input variants and usage patterns
 * Tests the unified input system solving current inconsistencies
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { Input, InputSearch, InputNumber } from './index';
import { tokens } from '../../../styles/tokens';

const InputTest: React.FC = () => {
  // State for various inputs
  const [defaultInput, setDefaultInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [calorieInput, setCalorieInput] = useState('1800');
  const [weightInput, setWeightInput] = useState('70');
  const [multilineInput, setMultilineInput] = useState('');

  // Mock search suggestions
  const searchSuggestions = [
    'Apple',
    'Banana',
    'Orange',
    'Strawberry',
    'Blueberry',
    'Pineapple',
    'Mango',
    'Grapes',
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Input Component System</Text>

      {/* Default Inputs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Default Inputs</Text>
        <Text style={styles.description}>Standard form inputs with consistent styling</Text>

        <Input
          label="Full Name"
          placeholder="Enter your full name"
          value={defaultInput}
          onChangeText={setDefaultInput}
          required
        />

        <Input
          label="Email Address"
          placeholder="user@example.com"
          value={emailInput}
          onChangeText={setEmailInput}
          keyboardType="email-address"
          autoCapitalize="none"
          helperText="We'll never share your email"
          required
        />

        <Input
          label="Password"
          placeholder="Enter your password"
          value={passwordInput}
          onChangeText={setPasswordInput}
          secureTextEntry
          helperText="At least 8 characters"
          required
        />
      </View>

      {/* Input States */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Input States</Text>

        <Input
          label="Success State"
          placeholder="Valid input"
          value="valid@email.com"
          state="success"
          successText="Email is available!"
        />

        <Input
          label="Error State"
          placeholder="Invalid input"
          value="invalid-email"
          state="error"
          errorText="Please enter a valid email address"
        />

        <Input
          label="Disabled State"
          placeholder="Cannot edit"
          value="disabled@email.com"
          editable={false}
          state="disabled"
        />
      </View>

      {/* Search Input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Search Input</Text>
        <Text style={styles.description}>Unified search with suggestions and clear functionality</Text>

        <InputSearch
          placeholder="Search for foods..."
          value={searchInput}
          onChangeText={setSearchInput}
          onSearch={(query) => Alert.alert('Search', `Searching for: ${query}`)}
          showSuggestions={true}
          suggestions={searchSuggestions}
          onSuggestionSelect={(suggestion) => {
            setSearchInput(suggestion);
            Alert.alert('Selected', suggestion);
          }}
        />
      </View>

      {/* Number Inputs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Number Inputs</Text>
        <Text style={styles.description}>Specialized numeric inputs solving manual calorie input issues</Text>

        <InputNumber
          label="Daily Calories"
          value={calorieInput}
          onChangeText={setCalorieInput}
          onValueChange={(value) => console.log('Calories:', value)}
          min={800}
          max={5000}
          unit="kcal"
          helperText="Recommended daily calorie intake"
        />

        <InputNumber
          label="Weight"
          value={weightInput}
          onChangeText={setWeightInput}
          onValueChange={(value) => console.log('Weight:', value)}
          min={30}
          max={300}
          decimals={1}
          unit="kg"
          showSteppers={true}
          step={0.5}
        />

        <InputNumber
          label="Price"
          placeholder="0.00"
          currency={true}
          decimals={2}
          thousandsSeparator={true}
          onValueChange={(value) => console.log('Price:', value)}
        />
      </View>

      {/* Input Sizes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Input Sizes</Text>

        <Input
          label="Small Input"
          placeholder="Small size (36px)"
          size="sm"
        />

        <Input
          label="Medium Input"
          placeholder="Medium size (44px) - Default"
          size="md"
        />

        <Input
          label="Large Input"
          placeholder="Large size (52px)"
          size="lg"
        />
      </View>

      {/* Multiline Input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Multiline Input</Text>

        <Input
          label="Notes"
          placeholder="Enter your notes here..."
          value={multilineInput}
          onChangeText={setMultilineInput}
          variant="multiline"
          maxLength={200}
          showCounter={true}
          helperText="Add any additional information"
        />
      </View>

      {/* Input with Icons */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Input with Icons</Text>

        <Input
          label="Location"
          placeholder="Enter location"
          leftIcon={<Text style={styles.icon}>📍</Text>}
        />

        <Input
          label="Phone Number"
          placeholder="+1 (555) 123-4567"
          leftIcon={<Text style={styles.icon}>📞</Text>}
          keyboardType="phone-pad"
        />

        <Input
          label="Website"
          placeholder="https://example.com"
          leftIcon={<Text style={styles.icon}>🌐</Text>}
          rightIcon={<Text style={styles.icon}>🔗</Text>}
          keyboardType="url"
          autoCapitalize="none"
        />
      </View>

      {/* Complex Form Example */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recipe Form Example</Text>
        <Text style={styles.description}>Example form using the unified input system</Text>

        <Input
          label="Recipe Name"
          placeholder="Delicious pasta"
          required
        />

        <InputNumber
          label="Servings"
          placeholder="4"
          min={1}
          max={20}
          showSteppers={true}
          unit="servings"
        />

        <InputNumber
          label="Prep Time"
          placeholder="15"
          min={1}
          max={300}
          unit="minutes"
        />

        <InputNumber
          label="Calories per Serving"
          placeholder="350"
          min={50}
          max={2000}
          unit="kcal"
        />

        <Input
          label="Instructions"
          placeholder="Step-by-step cooking instructions..."
          variant="multiline"
          maxLength={1000}
          showCounter={true}
        />

        <InputSearch
          label="Tags"
          placeholder="Search recipe tags..."
          suggestions={['Vegetarian', 'Gluten-Free', 'Quick', 'Healthy', 'Italian', 'Comfort Food']}
          showSuggestions={true}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background.default,
  },
  content: {
    padding: tokens.spacing.lg,
    paddingBottom: tokens.spacing.xl,
  },
  title: {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.xl,
    textAlign: 'center',
  },
  section: {
    marginBottom: tokens.spacing.xl,
  },
  sectionTitle: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.xs,
  },
  description: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    marginBottom: tokens.spacing.md,
  },
  icon: {
    fontSize: 18,
  },
});

export default InputTest;