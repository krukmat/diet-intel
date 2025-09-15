/**
 * Card Component Test Screen
 * Demonstrates all Card variants and usage patterns
 * Similar to ButtonTest.tsx for Button component
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Card, CardHeader, CardBody, CardFooter } from './index';
import { Button } from '../Button';
import { tokens } from '../../../styles/tokens';

const CardTest: React.FC = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Card Component System</Text>

      {/* Default Variant */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Default Cards</Text>
        <Text style={styles.description}>Stats cards style (white background, subtle shadow)</Text>

        <Card variant="default" padding="md">
          <CardHeader title="Daily Nutrition" subtitle="Today's progress" />
          <CardBody spacing="md">
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>1,847</Text>
                <Text style={styles.statLabel}>Calories</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>87g</Text>
                <Text style={styles.statLabel}>Protein</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>156g</Text>
                <Text style={styles.statLabel}>Carbs</Text>
              </View>
            </View>
          </CardBody>
        </Card>
      </View>

      {/* Elevated Variant */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Elevated Cards</Text>
        <Text style={styles.description}>Demo section style (higher shadow for emphasis)</Text>

        <Card variant="elevated" padding="lg">
          <CardHeader
            title="Demo Feature"
            subtitle="Try scanning a product"
            action={<Button variant="tertiary" size="sm">Demo</Button>}
          />
          <CardBody spacing="lg">
            <Text style={styles.bodyText}>
              This elevated card draws more attention with increased shadow and padding.
              Perfect for highlighting important features or promotional content.
            </Text>
          </CardBody>
        </Card>
      </View>

      {/* Outlined Variant */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Outlined Cards</Text>
        <Text style={styles.description}>Border instead of shadow (alternative styling)</Text>

        <Card variant="outlined" padding="md">
          <CardHeader title="Settings Card" />
          <CardBody spacing="sm">
            <Text style={styles.bodyText}>
              Outlined cards use borders instead of shadows for definition.
              Good for minimalist designs or when shadows aren't appropriate.
            </Text>
          </CardBody>
          <CardFooter alignment="right">
            <Button variant="secondary" size="sm">Configure</Button>
          </CardFooter>
        </Card>
      </View>

      {/* Interactive Variant */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Interactive Cards</Text>
        <Text style={styles.description}>Feature button cards (touchable with feedback)</Text>

        <Card
          variant="interactive"
          padding="md"
          onPress={() => console.log('Card pressed!')}
        >
          <CardBody spacing="md">
            <View style={styles.actionContent}>
              <View style={styles.actionIcon}>
                <Text style={styles.iconText}>📸</Text>
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>Scan Product</Text>
                <Text style={styles.actionDescription}>Take a photo to get nutrition info</Text>
              </View>
            </View>
          </CardBody>
        </Card>

        <Card
          variant="interactive"
          padding="md"
          onPress={() => console.log('Another card pressed!')}
        >
          <CardBody spacing="md">
            <View style={styles.actionContent}>
              <View style={styles.actionIcon}>
                <Text style={styles.iconText}>🍽️</Text>
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>Plan Meals</Text>
                <Text style={styles.actionDescription}>AI-powered meal planning</Text>
              </View>
            </View>
          </CardBody>
        </Card>
      </View>

      {/* Different Padding Sizes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Padding Variations</Text>

        <Card variant="default" padding="sm">
          <Text style={styles.bodyText}>Small padding (8px)</Text>
        </Card>

        <Card variant="default" padding="md">
          <Text style={styles.bodyText}>Medium padding (16px)</Text>
        </Card>

        <Card variant="default" padding="lg">
          <Text style={styles.bodyText}>Large padding (24px)</Text>
        </Card>
      </View>

      {/* Complex Layout Example */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Complex Layout</Text>

        <Card variant="default" padding="md">
          <CardHeader
            title="Recipe Recommendations"
            subtitle="Based on your preferences"
            action={<Button variant="tertiary" size="sm">View All</Button>}
          />
          <CardBody spacing="md">
            <Text style={styles.bodyText}>
              Discover new recipes that match your dietary goals and taste preferences.
              Our AI considers your nutrition targets and past ratings.
            </Text>
            <View style={styles.tagContainer}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>High Protein</Text>
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagText}>Low Carb</Text>
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagText}>Vegetarian</Text>
              </View>
            </View>
          </CardBody>
          <CardFooter alignment="space-between">
            <Button variant="secondary" size="sm">Save for Later</Button>
            <Button variant="primary" size="sm">Try Recipe</Button>
          </CardFooter>
        </Card>
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
  bodyText: {
    fontSize: tokens.typography.fontSize.md,
    color: tokens.colors.text.primary,
    lineHeight: tokens.typography.fontSize.md * tokens.typography.lineHeight.normal,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.primary[500],
    marginBottom: tokens.spacing.xs,
  },
  statLabel: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: tokens.colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.md,
  },
  iconText: {
    fontSize: 24,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.xs,
  },
  actionDescription: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  tag: {
    backgroundColor: tokens.colors.primary[50],
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.borderRadius.sm,
  },
  tagText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.primary[700],
    fontWeight: tokens.typography.fontWeight.medium,
  },
});

export default CardTest;