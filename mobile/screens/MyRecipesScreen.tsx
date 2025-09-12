import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';

interface MyRecipesScreenProps {
  onBackPress: () => void;
  onNavigateToDetail?: (recipeId: string) => void;
}

export default function MyRecipesScreen({
  onBackPress,
  onNavigateToDetail,
}: MyRecipesScreenProps) {
  const { t } = useTranslation();

  const handleViewRecipes = () => {
    Alert.alert(
      '📚 My Recipes',
      'My Recipes screen will be implemented in R.2.1.5! This is a placeholder screen for navigation setup.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>📚 My Recipes</Text>
      </View>

      {/* Placeholder Content */}
      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderTitle}>🚧 Coming Soon</Text>
        <Text style={styles.placeholderDescription}>
          My Recipes Library will be implemented in task R.2.1.5
        </Text>
        
        <TouchableOpacity style={styles.placeholderButton} onPress={handleViewRecipes}>
          <Text style={styles.placeholderButtonText}>📚 View My Recipes (Placeholder)</Text>
        </TouchableOpacity>
      </View>

      {/* Feature Preview */}
      <View style={styles.previewSection}>
        <Text style={styles.previewTitle}>📋 Planned Features:</Text>
        <Text style={styles.previewItem}>• Personal recipe library</Text>
        <Text style={styles.previewItem}>• Recipe categories & organization</Text>
        <Text style={styles.previewItem}>• Recipe management (edit, delete, share)</Text>
        <Text style={styles.previewItem}>• Personal recipe analytics</Text>
        <Text style={styles.previewItem}>• Favorite recipes</Text>
        <Text style={styles.previewItem}>• Recipe folders and tags</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  placeholderContainer: {
    margin: 16,
    padding: 24,
    backgroundColor: 'white',
    borderRadius: 12,
    alignItems: 'center',
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9500',
    marginBottom: 12,
  },
  placeholderDescription: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  placeholderButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  placeholderButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  previewSection: {
    margin: 16,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  previewItem: {
    fontSize: 14,
    color: '#8E8E93',
    marginVertical: 4,
    lineHeight: 20,
  },
});