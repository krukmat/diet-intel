/**
 * Button Component Visual Test
 * Simple test component to verify Button functionality and variants
 *
 * This file demonstrates all Button variants that will replace
 * the 9+ inconsistent button styles in the current UI
 */

import React, { useState } from 'react';
import { View, ScrollView, Text, StyleSheet, Alert } from 'react-native';
import { Button } from './Button';
import { tokens } from '../../../styles/tokens';

export const ButtonTest: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handlePress = (variant: string) => {
    Alert.alert('Button Pressed', `${variant} button was pressed!`);
  };

  const handleLoadingTest = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 3000);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Button Component Test</Text>
      <Text style={styles.subtitle}>All 4 variants solving UI chaos</Text>

      {/* Primary Buttons - Main Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Primary Buttons</Text>
        <Text style={styles.sectionSubtitle}>Replaces: "Escaner de Código"</Text>

        <Button
          variant="primary"
          onPress={() => handlePress('Primary')}
          style={styles.button}
        >
          Escaner de Código
        </Button>

        <Button
          variant="primary"
          size="lg"
          onPress={() => handlePress('Primary Large')}
          style={styles.button}
        >
          Start Camera
        </Button>

        <Button
          variant="primary"
          loading={loading}
          onPress={handleLoadingTest}
          style={styles.button}
        >
          {loading ? 'Loading...' : 'Test Loading'}
        </Button>
      </View>

      {/* Secondary Buttons - Secondary Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Secondary Buttons</Text>
        <Text style={styles.sectionSubtitle}>Replaces: "Subir Etiqueta", "Plan de Comidas", etc.</Text>

        <Button
          variant="secondary"
          onPress={() => handlePress('Secondary')}
          style={styles.button}
        >
          Subir Etiqueta
        </Button>

        <Button
          variant="secondary"
          onPress={() => handlePress('Plan de Comidas')}
          style={styles.button}
        >
          Plan de Comidas
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onPress={() => handlePress('Seguimiento')}
          style={styles.button}
        >
          Seguimiento
        </Button>
      </View>

      {/* Tertiary Buttons - Minimal Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tertiary Buttons</Text>
        <Text style={styles.sectionSubtitle}>Replaces: Text-only actions</Text>

        <Button
          variant="tertiary"
          onPress={() => handlePress('Tertiary')}
          style={styles.button}
        >
          Buscar
        </Button>

        <Button
          variant="tertiary"
          size="sm"
          onPress={() => handlePress('Recetas')}
          style={styles.button}
        >
          Recetas
        </Button>
      </View>

      {/* Destructive Buttons - Dangerous Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Destructive Buttons</Text>
        <Text style={styles.sectionSubtitle}>Replaces: "Restablecer"</Text>

        <Button
          variant="destructive"
          onPress={() => handlePress('Destructive')}
          style={styles.button}
        >
          Restablecer
        </Button>
      </View>

      {/* State Tests */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Button States</Text>

        <Button
          variant="primary"
          disabled={true}
          onPress={() => {}}
          style={styles.button}
        >
          Disabled Primary
        </Button>

        <Button
          variant="secondary"
          disabled={true}
          onPress={() => {}}
          style={styles.button}
        >
          Disabled Secondary
        </Button>
      </View>

      {/* Width Tests */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Width Variants</Text>

        <Button
          variant="primary"
          width="full"
          onPress={() => handlePress('Full Width')}
          style={styles.button}
        >
          Full Width Button
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface.background,
  },

  content: {
    padding: tokens.spacing.md,
  },

  title: {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.text.primary,
    textAlign: 'center',
    marginBottom: tokens.spacing.xs,
  },

  subtitle: {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    marginBottom: tokens.spacing.xl,
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

  sectionSubtitle: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    marginBottom: tokens.spacing.md,
    fontStyle: 'italic',
  },

  button: {
    marginBottom: tokens.spacing.sm,
  },
});

export default ButtonTest;