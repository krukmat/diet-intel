import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  RecipeApiService,
  ShoppingOptimizationResponse,
  ConsolidatedIngredient,
  BulkBuyingSuggestion
} from '../services/RecipeApiService';
import { BaseRecipe } from '../types/RecipeTypes';

interface ShoppingOptimizationScreenProps {
  onBackPress: () => void;
  selectedRecipes: BaseRecipe[];
  userId: string;
}

const ShoppingOptimizationScreen: React.FC<ShoppingOptimizationScreenProps> = ({
  onBackPress,
  selectedRecipes,
  userId,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [optimization, setOptimization] = useState<ShoppingOptimizationResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'ingredients' | 'bulk' | 'summary'>('ingredients');

  useEffect(() => {
    if (selectedRecipes.length > 0) {
      generateOptimization();
    }
  }, [selectedRecipes]);

  const generateOptimization = async () => {
    setLoading(true);
    try {
      const recipeApi = RecipeApiService.getInstance();

      const optimizationResult = await recipeApi.optimizeShoppingList({
        recipeIds: selectedRecipes.map(r => r.id),
        userId: userId,
        optimizationName: `Shopping for ${selectedRecipes.length} recipes`,
      });

      setOptimization(optimizationResult);
    } catch (error) {
      console.error('Failed to optimize shopping list:', error);
      Alert.alert('Error', 'Failed to optimize your shopping list. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const renderIngredientItem = ({ item }: { item: ConsolidatedIngredient }) => (
    <View style={styles.ingredientCard}>
      <View style={styles.ingredientHeader}>
        <Text style={styles.ingredientName}>{item.name.replace(/_/g, ' ')}</Text>
        <View style={styles.ingredientMeta}>
          <Text style={styles.ingredientQuantity}>
            {item.totalQuantity} {item.unit}
          </Text>
          <Text style={styles.ingredientCost}>
            {formatCurrency(item.estimatedCost)}
          </Text>
        </View>
      </View>

      <View style={styles.ingredientSources}>
        <Text style={styles.sourcesLabel}>Used in:</Text>
        {item.sourceRecipes.map((source, index) => (
          <View key={index} style={styles.sourceItem}>
            <Text style={styles.sourceName}>{source.recipeName}</Text>
            <Text style={styles.sourceQuantity}>
              {source.quantity} {source.unit}
            </Text>
          </View>
        ))}
      </View>

      {item.bulkDiscountAvailable && (
        <View style={styles.bulkBadge}>
          <Text style={styles.bulkBadgeText}>🛒 Bulk Available</Text>
        </View>
      )}
    </View>
  );

  const renderBulkSuggestion = ({ item }: { item: BulkBuyingSuggestion }) => (
    <View style={styles.bulkCard}>
      <View style={styles.bulkHeader}>
        <View>
          <Text style={styles.bulkIngredient}>
            {optimization?.consolidatedIngredients
              .find(ing => ing.id === item.ingredientConsolidationId)?.name
              .replace(/_/g, ' ')
            }
          </Text>
          <Text style={styles.bulkType}>
            {item.suggestionType.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>
        <View style={styles.bulkSavings}>
          <Text style={styles.bulkSavingsAmount}>
            Save {formatCurrency(item.immediateSavings)}
          </Text>
          <Text style={styles.bulkSavingsPercentage}>
            ({Math.round((item.immediateSavings / (item.currentNeededQuantity * item.regularUnitPrice)) * 100)}% off)
          </Text>
        </View>
      </View>

      <View style={styles.bulkDetails}>
        <View style={styles.bulkComparison}>
          <View style={styles.bulkOption}>
            <Text style={styles.bulkOptionLabel}>Current Need</Text>
            <Text style={styles.bulkOptionValue}>
              {item.currentNeededQuantity} {item.bulkUnit}
            </Text>
            <Text style={styles.bulkOptionPrice}>
              {formatCurrency(item.regularUnitPrice)} per {item.bulkUnit}
            </Text>
          </View>

          <Text style={styles.bulkArrow}>→</Text>

          <View style={styles.bulkOption}>
            <Text style={styles.bulkOptionLabel}>Bulk Package</Text>
            <Text style={styles.bulkOptionValue}>
              {item.suggestedBulkQuantity} {item.bulkUnit}
            </Text>
            <Text style={styles.bulkOptionPrice}>
              {formatCurrency(item.bulkUnitPrice)} per {item.bulkUnit}
            </Text>
          </View>
        </View>

        <View style={styles.bulkMetadata}>
          <View style={styles.bulkMetaItem}>
            <Text style={styles.bulkMetaLabel}>Storage:</Text>
            <Text style={styles.bulkMetaValue}>{item.storageRequirements}</Text>
          </View>
          <View style={styles.bulkMetaItem}>
            <Text style={styles.bulkMetaLabel}>Use within:</Text>
            <Text style={styles.bulkMetaValue}>{item.estimatedUsageTimeframeDays} days</Text>
          </View>
          <View style={styles.bulkMetaItem}>
            <Text style={styles.bulkMetaLabel}>Risk:</Text>
            <Text style={[
              styles.bulkMetaValue,
              item.perishabilityRisk === 'low' ? styles.riskLow :
              item.perishabilityRisk === 'medium' ? styles.riskMedium : styles.riskHigh
            ]}>
              {item.perishabilityRisk}
            </Text>
          </View>
        </View>

        <View style={styles.confidenceBar}>
          <Text style={styles.confidenceLabel}>
            Recommendation Confidence: {Math.round(item.recommendationScore * 100)}%
          </Text>
          <View style={styles.confidenceBarTrack}>
            <View
              style={[
                styles.confidenceBarFill,
                { width: `${item.recommendationScore * 100}%` }
              ]}
            />
          </View>
        </View>
      </View>
    </View>
  );

  const renderSummaryTab = () => (
    <View style={styles.summaryContainer}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>🎯 Optimization Summary</Text>

        <View style={styles.summaryMetric}>
          <Text style={styles.metricLabel}>Total Recipes</Text>
          <Text style={styles.metricValue}>{selectedRecipes.length}</Text>
        </View>

        <View style={styles.summaryMetric}>
          <Text style={styles.metricLabel}>Ingredients Consolidated</Text>
          <Text style={styles.metricValue}>
            {optimization?.optimizationMetrics.totalIngredients} → {optimization?.optimizationMetrics.consolidatedTo}
          </Text>
        </View>

        <View style={styles.summaryMetric}>
          <Text style={styles.metricLabel}>Estimated Total Cost</Text>
          <Text style={styles.metricValue}>
            {formatCurrency(optimization?.estimatedTotalCost || 0)}
          </Text>
        </View>

        <View style={styles.summaryMetric}>
          <Text style={styles.metricLabel}>Potential Savings</Text>
          <Text style={[styles.metricValue, styles.savingsValue]}>
            {formatCurrency(optimization?.estimatedSavings || 0)}
          </Text>
        </View>

        <View style={styles.summaryMetric}>
          <Text style={styles.metricLabel}>Optimization Score</Text>
          <Text style={styles.metricValue}>
            {Math.round((optimization?.optimizationMetrics.optimizationScore || 0) * 100)}%
          </Text>
        </View>
      </View>

      <View style={styles.recipesCard}>
        <Text style={styles.cardTitle}>📝 Selected Recipes</Text>
        {selectedRecipes.map((recipe) => (
          <View key={recipe.id} style={styles.recipeItem}>
            <Text style={styles.recipeName}>{recipe.name}</Text>
            <Text style={styles.recipeInfo}>
              {recipe.servings} servings • {recipe.cookingTime} min
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Optimizing your shopping list...</Text>
        <Text style={styles.loadingSubtext}>
          Consolidating ingredients and finding bulk savings...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🛒 Smart Shopping</Text>
      </View>

      {optimization && (
        <>
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'ingredients' && styles.activeTab]}
              onPress={() => setActiveTab('ingredients')}
            >
              <Text style={[styles.tabText, activeTab === 'ingredients' && styles.activeTabText]}>
                Ingredients ({optimization.consolidatedIngredients.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'bulk' && styles.activeTab]}
              onPress={() => setActiveTab('bulk')}
            >
              <Text style={[styles.tabText, activeTab === 'bulk' && styles.activeTabText]}>
                Bulk Savings ({optimization.bulkSuggestions.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'summary' && styles.activeTab]}
              onPress={() => setActiveTab('summary')}
            >
              <Text style={[styles.tabText, activeTab === 'summary' && styles.activeTabText]}>
                Summary
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {activeTab === 'ingredients' && (
              <FlatList
                data={optimization.consolidatedIngredients}
                renderItem={renderIngredientItem}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContainer}
              />
            )}

            {activeTab === 'bulk' && (
              <>
                {optimization.bulkSuggestions.length > 0 ? (
                  <FlatList
                    data={optimization.bulkSuggestions}
                    renderItem={renderBulkSuggestion}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContainer}
                  />
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateTitle}>💡 No Bulk Opportunities</Text>
                    <Text style={styles.emptyStateText}>
                      Your current shopping list doesn't have cost-effective bulk buying opportunities.
                    </Text>
                  </View>
                )}
              </>
            )}

            {activeTab === 'summary' && renderSummaryTab()}
          </View>
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  listContainer: {
    padding: 20,
  },
  ingredientCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ingredientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textTransform: 'capitalize',
    flex: 1,
  },
  ingredientMeta: {
    alignItems: 'flex-end',
  },
  ingredientQuantity: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  ingredientCost: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  ingredientSources: {
    marginBottom: 8,
  },
  sourcesLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  sourceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  sourceName: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  sourceQuantity: {
    fontSize: 13,
    color: '#666',
  },
  bulkBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8f5e8',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bulkBadgeText: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: '500',
  },
  bulkCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bulkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  bulkIngredient: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textTransform: 'capitalize',
  },
  bulkType: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  bulkSavings: {
    alignItems: 'flex-end',
  },
  bulkSavingsAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#28a745',
  },
  bulkSavingsPercentage: {
    fontSize: 12,
    color: '#28a745',
  },
  bulkDetails: {
    gap: 16,
  },
  bulkComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bulkOption: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  bulkOptionLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginBottom: 4,
  },
  bulkOptionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  bulkOptionPrice: {
    fontSize: 12,
    color: '#666',
  },
  bulkArrow: {
    fontSize: 24,
    color: '#666',
    marginHorizontal: 16,
  },
  bulkMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  bulkMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: '30%',
  },
  bulkMetaLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 6,
  },
  bulkMetaValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
  riskLow: {
    color: '#28a745',
  },
  riskMedium: {
    color: '#ffc107',
  },
  riskHigh: {
    color: '#dc3545',
  },
  confidenceBar: {
    marginTop: 4,
  },
  confidenceLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  confidenceBarTrack: {
    height: 4,
    backgroundColor: '#e1e5e9',
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  summaryContainer: {
    padding: 20,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  summaryMetric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  savingsValue: {
    color: '#28a745',
  },
  recipesCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  recipeItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },
  recipeName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  recipeInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ShoppingOptimizationScreen;
