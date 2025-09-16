import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { RecipeLanguageToggle } from '../components/RecipeLanguageToggle';
import {
  Container,
  Section,
  Spacer,
  Grid,
  Card,
  CardHeader,
  CardBody,
  Button,
  tokens
} from '../components/ui';

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
  const { t } = useTranslation();
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
      case 'random':
        handleRandomRecipe();
        break;
      default:
        break;
    }
  };

  const handleRandomRecipe = () => {
    // TODO: Implement random recipe generation in R.2.1.6
    Alert.alert(
      t('recipeHome.randomRecipe', '🎲 Random Recipe'),
      t('recipeHome.randomComingSoon', 'Random recipe generation will be available in the next update!')
    );
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
      title: t('recipeHome.generateRecipe', '🔧 Generate Recipe'),
      description: t('recipeHome.generateDescription', 'Create new recipes with AI'),
      color: '#007AFF',
      action: () => handleQuickAction('generate'),
    },
    {
      id: 'search',
      title: t('recipeHome.searchRecipes', '🔍 Search Recipes'),
      description: t('recipeHome.searchDescription', 'Find recipes by ingredients'),
      color: '#34C759',
      action: () => handleQuickAction('search'),
    },
    {
      id: 'my-recipes',
      title: t('recipeHome.myRecipes', '📚 My Recipes'),
      description: t('recipeHome.myRecipesDescription', 'View saved & generated recipes'),
      color: '#FF9500',
      action: () => handleQuickAction('my-recipes'),
    },
    {
      id: 'random',
      title: t('recipeHome.randomRecipe', '🎲 Random Recipe'),
      description: t('recipeHome.randomDescription', 'Get a surprise recipe suggestion'),
      color: '#AF52DE',
      action: () => handleQuickAction('random'),
    },
  ];

  return (
    <Container padding="md" scrollable safeArea>
      {/* Header */}
      <Section spacing="sm" noDivider>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Button
            variant="tertiary"
            size="sm"
            onPress={onBackPress}
            title={t('recipeHome.home', '🏠 Home')}
          />
          <Text style={{
            fontSize: tokens.typography.fontSize['2xl'],
            fontWeight: tokens.typography.fontWeight.bold,
            color: tokens.colors.text.primary,
            flex: 1,
            textAlign: 'center',
          }}>
            {t('recipeHome.title', '🍳 Recipe AI')}
          </Text>
          <RecipeLanguageToggle onLanguageChange={handleLanguageChange} />
        </View>
      </Section>

      {/* Quick Stats */}
      <Section
        title="📊 Your Recipe Statistics"
        spacing="md"
      >
        <Card variant="default" padding="md">
          <CardBody spacing="md">
            {loading ? (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: tokens.spacing.lg,
              }}>
                <ActivityIndicator size="small" color={tokens.colors.primary[500]} />
                <Text style={{
                  marginLeft: tokens.spacing.sm,
                  fontSize: tokens.typography.fontSize.md,
                  color: tokens.colors.text.secondary,
                }}>
                  Loading stats...
                </Text>
              </View>
            ) : (
              <Grid columns={3} gap="sm">
                <Card variant="outlined" padding="md">
                  <CardBody spacing="xs">
                    <Text style={{
                      fontSize: tokens.typography.fontSize['2xl'],
                      fontWeight: tokens.typography.fontWeight.bold,
                      color: tokens.colors.primary[500],
                      textAlign: 'center',
                    }}>
                      {stats.totalRecipes}
                    </Text>
                    <Text style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.text.secondary,
                      textAlign: 'center',
                    }}>
                      Total Recipes
                    </Text>
                  </CardBody>
                </Card>
                <Card variant="outlined" padding="md">
                  <CardBody spacing="xs">
                    <Text style={{
                      fontSize: tokens.typography.fontSize['2xl'],
                      fontWeight: tokens.typography.fontWeight.bold,
                      color: tokens.colors.primary[500],
                      textAlign: 'center',
                    }}>
                      {stats.favoriteRecipes}
                    </Text>
                    <Text style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.text.secondary,
                      textAlign: 'center',
                    }}>
                      Favorites
                    </Text>
                  </CardBody>
                </Card>
                <Card variant="outlined" padding="md">
                  <CardBody spacing="xs">
                    <Text style={{
                      fontSize: tokens.typography.fontSize['2xl'],
                      fontWeight: tokens.typography.fontWeight.bold,
                      color: tokens.colors.primary[500],
                      textAlign: 'center',
                    }}>
                      {stats.recentGenerations}
                    </Text>
                    <Text style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.text.secondary,
                      textAlign: 'center',
                    }}>
                      Recent
                    </Text>
                  </CardBody>
                </Card>
              </Grid>
            )}
          </CardBody>
        </Card>
      </Section>

      {/* Quick Actions */}
      <Section title="🚀 Quick Actions" spacing="md">
        <Grid columns={1} gap="sm">
          {contextModes.map((mode) => (
            <Card
              key={mode.id}
              variant="interactive"
              padding="md"
              onPress={mode.action}
            >
              <CardBody spacing="sm">
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: tokens.typography.fontSize.lg,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: tokens.colors.text.primary,
                      marginBottom: tokens.spacing.xs,
                    }}>
                      {mode.title}
                    </Text>
                    <Text style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.text.secondary,
                      lineHeight: tokens.typography.fontSize.sm * tokens.typography.lineHeight.normal,
                    }}>
                      {mode.description}
                    </Text>
                  </View>
                  <View style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: mode.color,
                    marginLeft: tokens.spacing.sm,
                  }} />
                </View>
              </CardBody>
            </Card>
          ))}
        </Grid>
      </Section>

      {/* Recent Activity */}
      <Section title="⏰ Recent Activity" spacing="md">
        <Grid columns={1} gap="sm">
          <Card variant="default" padding="md">
            <CardBody spacing="xs">
              <Text style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.text.primary,
              }}>
                🍝 Mediterranean Pasta
              </Text>
              <Text style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.text.secondary,
              }}>
                Generated 2 hours ago • 4.8⭐
              </Text>
              <Text style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.primary[600],
              }}>
                Vegetarian • 25 min cook time
              </Text>
            </CardBody>
          </Card>
          <Card variant="default" padding="md">
            <CardBody spacing="xs">
              <Text style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.text.primary,
              }}>
                🥗 Quinoa Power Bowl
              </Text>
              <Text style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.text.secondary,
              }}>
                Generated yesterday • 4.6⭐
              </Text>
              <Text style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.primary[600],
              }}>
                Vegan • High Protein
              </Text>
            </CardBody>
          </Card>
          <Card variant="default" padding="md">
            <CardBody spacing="xs">
              <Text style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.text.primary,
              }}>
                🍲 Chicken Curry
              </Text>
              <Text style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.text.secondary,
              }}>
                Generated 3 days ago • 4.9⭐
              </Text>
              <Text style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.primary[600],
              }}>
                Gluten-Free • 40 min cook time
              </Text>
            </CardBody>
          </Card>
        </Grid>
      </Section>

      {/* Footer */}
      <Section spacing="lg" noDivider>
        <View style={{
          alignItems: 'center',
          paddingVertical: tokens.spacing.lg,
        }}>
          <Text style={{
            fontSize: tokens.typography.fontSize.lg,
            fontWeight: tokens.typography.fontWeight.medium,
            color: tokens.colors.text.primary,
            textAlign: 'center',
            marginBottom: tokens.spacing.xs,
          }}>
            🤖 AI-Powered Recipe Generation
          </Text>
          <Text style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.text.secondary,
            textAlign: 'center',
          }}>
            Create personalized recipes based on your preferences
          </Text>
        </View>
      </Section>
    </Container>
  );
}

