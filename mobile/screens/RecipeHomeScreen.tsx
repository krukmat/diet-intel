import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { RecipeLanguageToggle } from '../components/RecipeLanguageToggle';
import i18n from '../i18n/config';

interface RecipeHomeScreenProps {
  onBackPress: () => void;
  navigateToGeneration: () => void;
  navigateToSearch: () => void;
  navigateToMyRecipes: () => void;
  navigationContext?: {
    targetContext?: string;
    sourceScreen?: string;
  };
}

export default function RecipeHomeScreen({
  onBackPress,
  navigateToGeneration,
  navigateToSearch,
  navigateToMyRecipes,
  navigationContext,
}: RecipeHomeScreenProps) {
  const { t, i18n } = useTranslation('translation', { useSuspense: false });

  // Force re-render when language changes
  React.useEffect(() => {
    console.log('🌐 RecipeHomeScreen mounted - Current language:', i18n.language);
    console.log('🌐 RecipeHomeScreen - statsTitle result:', t('recipeHome.statsTitle'));
    console.log('🌐 RecipeHomeScreen - Spanish test:', t('navigation.recipes'));
  }, [i18n.language, t]);

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalRecipes: 0,
    favoriteRecipes: 0,
    recentGenerations: 0,
  });

  useEffect(() => {
    loadRecipeStats();
    
    // Handle navigation context if provided
    if (navigationContext?.targetContext) {
      handleContextNavigation(navigationContext.targetContext);
    }
  }, [navigationContext]);

  const loadRecipeStats = async () => {
    setLoading(true);
    try {
      // TODO: Load actual stats from API in R.2.1.6
      // For now, show demo stats
      setTimeout(() => {
        setStats({
          totalRecipes: 12,
          favoriteRecipes: 5,
          recentGenerations: 3,
        });
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error loading recipe stats:', error);
      setLoading(false);
    }
  };

  const handleContextNavigation = (context: string) => {
    switch (context) {
      case 'generate':
        setTimeout(() => navigateToGeneration(), 100);
        break;
      case 'search':
        setTimeout(() => navigateToSearch(), 100);
        break;
      case 'my-recipes':
        setTimeout(() => navigateToMyRecipes(), 100);
        break;
      default:
        break;
    }
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'generate':
        navigateToGeneration();
        break;
      case 'search':
        navigateToSearch();
        break;
      case 'my-recipes':
        navigateToMyRecipes();
        break;
      default:
        break;
    }
  };

  const handleLanguageChange = (language: string) => {
    // Reload stats and data when language changes
    setTimeout(() => {
      loadRecipeStats();
    }, 100);
  };

  const contextModes = [
    {
      id: 'generate',
      title: t('recipeHome.generateRecipe', '🔧 Generar recetas'),
      description: t('recipeHome.generateDescription', 'Crear nuevas recetas con IA'),
      color: '#007AFF',
      action: () => handleQuickAction('generate'),
    },
    {
      id: 'search',
      title: t('recipeHome.searchRecipes', '🔍 Buscar Recetas'),
      description: t('recipeHome.searchDescription', 'Find recipes by ingredients'),
      color: '#34C759',
      action: () => handleQuickAction('search'),
    },
    {
      id: 'my-recipes',
      title: t('recipeHome.myRecipes', '📚 Mis Recetas'),
      description: t('recipeHome.myRecipesDescription', 'Ver recetas guardadas y generadas'),
      color: '#FF9500',
      action: () => handleQuickAction('my-recipes'),
    },
  ];

  return (
    <ScrollView key={i18n.language} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <Text style={styles.backButtonText}>{t('recipeHome.home', '🏠 Home')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('recipeHome.title', '🍳 Receta AI')}</Text>
        <RecipeLanguageToggle
          style={styles.languageToggle}
          onLanguageChange={handleLanguageChange}
        />
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>{t('recipeHome.statsTitle', '📊 Estadísticas')}</Text>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.loadingText}>{t('recipeHome.loadingStats', 'Cargando estadísticas...')}</Text>
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalRecipes}</Text>
              <Text style={styles.statLabel}>{t('recipeHome.totalRecipes', 'Total recetas')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.favoriteRecipes}</Text>
              <Text style={styles.statLabel}>{t('recipeHome.favorites', 'Favoritos')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.recentGenerations}</Text>
              <Text style={styles.statLabel}>{t('recipeHome.recent', 'Recientes')}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Context Selection */}
      <View style={styles.contextSection}>
        <Text style={styles.sectionTitle}>{t('recipeHome.quickActions', '🚀 Quick Actions')}</Text>
        <View style={styles.contextGrid}>
          {contextModes.map((mode) => (
            <TouchableOpacity
              key={mode.id}
              style={[styles.contextCard, { borderLeftColor: mode.color }]}
              onPress={mode.action}
            >
              <Text style={styles.contextTitle}>{mode.title}</Text>
              <Text style={styles.contextDescription}>{mode.description}</Text>
              <View style={[styles.contextIndicator, { backgroundColor: mode.color }]} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>⏰ Recent Activity</Text>
        <View style={styles.recentCard}>
          <Text style={styles.recentTitle}>🍝 {t('recipeHome.mediterraneanPasta', 'Mediterranean Pasta')}</Text>
          <Text style={styles.recentDescription}>{t('recipeHome.generated', 'Generated 2 hours ago')} • 4.8⭐</Text>
          <Text style={styles.recentMeta}>{t('recipeHome.vegetarian', 'Vegetarian')} • 25 min cook time</Text>
        </View>
        <View style={styles.recentCard}>
          <Text style={styles.recentTitle}>🥗 {t('recipeHome.quinoaPowerBowl', 'Quinoa Power Bowl')}</Text>
          <Text style={styles.recentDescription}>{t('recipeHome.generatedYesterday', 'Generated yesterday')} • 4.6⭐</Text>
          <Text style={styles.recentMeta}>{t('recipeHome.vegan', 'Vegan')} • {t('recipeHome.highProtein', 'High Protein')}</Text>
        </View>
        <View style={styles.recentCard}>
          <Text style={styles.recentTitle}>🍲 {t('recipeHome.chickenCurry', 'Chicken Curry')}</Text>
          <Text style={styles.recentDescription}>{t('recipeHome.generatedDaysAgo', { days: 3 })} • 4.9⭐</Text>
          <Text style={styles.recentMeta}>{t('recipeHome.glutenFree', 'Gluten-Free')} • 40 min cook time</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          🤖 AI-Powered Recipe Generation
        </Text>
        <Text style={styles.footerSubtext}>
          Create personalized recipes based on your preferences
        </Text>
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
    justifyContent: 'space-between',
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
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    flex: 1,
  },
  languageToggle: {
    marginLeft: 8,
  },
  statsContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#8E8E93',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statCard: {
    alignItems: 'center',
    padding: 12,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  contextSection: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  contextGrid: {
    gap: 12,
  },
  contextCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
  },
  contextTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  contextDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  contextIndicator: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  recentSection: {
    margin: 16,
  },
  recentCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  recentDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  recentMeta: {
    fontSize: 12,
    color: '#AF52DE',
  },
  footer: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  footerText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
});
