// Loading States & Skeleton Screen Components
// Provides engaging loading experiences with shimmer animations

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Dimensions,
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

// Shimmer Animation Hook
const useShimmerAnimation = (duration: number = 1500) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [animatedValue, duration]);

  return animatedValue;
};

// Base Shimmer Component
interface ShimmerProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
  children?: React.ReactNode;
}

const Shimmer: React.FC<ShimmerProps> = ({
  width = 100,
  height = 20,
  borderRadius = 4,
  style,
  children,
}) => {
  const shimmerAnimation = useShimmerAnimation();

  const shimmerTranslate = shimmerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-screenWidth, screenWidth],
  });

  return (
    <View
      style={[
        styles.shimmerContainer,
        { width, height, borderRadius },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmerGradient,
          {
            transform: [{ translateX: shimmerTranslate }],
          },
        ]}
      />
      {children}
    </View>
  );
};

// Recipe Card Skeleton
export const RecipeCardSkeleton: React.FC<{ viewMode?: 'grid' | 'list' }> = ({ 
  viewMode = 'grid' 
}) => {
  if (viewMode === 'list') {
    return (
      <View style={styles.recipeCardSkeletonList}>
        <Shimmer width={80} height={80} borderRadius={8} style={styles.recipeImageSkeleton} />
        <View style={styles.recipeContentSkeleton}>
          <Shimmer width="80%" height={16} style={{ marginBottom: 8 }} />
          <Shimmer width="100%" height={12} style={{ marginBottom: 4 }} />
          <Shimmer width="60%" height={12} style={{ marginBottom: 8 }} />
          <View style={styles.recipeMetaSkeleton}>
            <Shimmer width={40} height={12} />
            <Shimmer width={50} height={12} />
            <Shimmer width={45} height={12} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.recipeCardSkeletonGrid}>
      <Shimmer width="100%" height={120} borderRadius={8} style={{ marginBottom: 12 }} />
      <Shimmer width="85%" height={16} style={{ marginBottom: 8 }} />
      <Shimmer width="100%" height={12} style={{ marginBottom: 4 }} />
      <Shimmer width="70%" height={12} style={{ marginBottom: 8 }} />
      <View style={styles.recipeMetaSkeletonGrid}>
        <Shimmer width={30} height={12} />
        <Shimmer width={40} height={12} />
      </View>
    </View>
  );
};

// Recipe List Skeleton
export const RecipeListSkeleton: React.FC<{ 
  count?: number; 
  viewMode?: 'grid' | 'list' 
}> = ({ count = 6, viewMode = 'grid' }) => {
  return (
    <View style={viewMode === 'grid' ? styles.recipeGridSkeleton : styles.recipeListContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <RecipeCardSkeleton key={index} viewMode={viewMode} />
      ))}
    </View>
  );
};

// Recipe Detail Skeleton
export const RecipeDetailSkeleton: React.FC = () => {
  return (
    <View style={styles.recipeDetailSkeleton}>
      {/* Header Image */}
      <Shimmer width="100%" height={250} borderRadius={0} style={{ marginBottom: 16 }} />
      
      {/* Title and Basic Info */}
      <View style={styles.recipeDetailContent}>
        <Shimmer width="90%" height={24} style={{ marginBottom: 8 }} />
        <Shimmer width="70%" height={16} style={{ marginBottom: 16 }} />
        
        {/* Meta Info */}
        <View style={styles.recipeMetaRow}>
          <Shimmer width={60} height={14} />
          <Shimmer width={70} height={14} />
          <Shimmer width={50} height={14} />
        </View>
        
        {/* Description */}
        <View style={{ marginVertical: 20 }}>
          <Shimmer width="30%" height={18} style={{ marginBottom: 12 }} />
          <Shimmer width="100%" height={14} style={{ marginBottom: 4 }} />
          <Shimmer width="95%" height={14} style={{ marginBottom: 4 }} />
          <Shimmer width="80%" height={14} />
        </View>
        
        {/* Ingredients */}
        <View style={{ marginVertical: 20 }}>
          <Shimmer width="40%" height={18} style={{ marginBottom: 12 }} />
          {Array.from({ length: 8 }).map((_, index) => (
            <View key={index} style={styles.ingredientSkeleton}>
              <Shimmer width={20} height={14} />
              <Shimmer width="70%" height={14} />
            </View>
          ))}
        </View>
        
        {/* Instructions */}
        <View style={{ marginVertical: 20 }}>
          <Shimmer width="40%" height={18} style={{ marginBottom: 12 }} />
          {Array.from({ length: 6 }).map((_, index) => (
            <View key={index} style={styles.instructionSkeleton}>
              <Shimmer width={24} height={24} borderRadius={12} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Shimmer width="95%" height={14} style={{ marginBottom: 4 }} />
                <Shimmer width="80%" height={14} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

// Search Results Skeleton
export const SearchResultsSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <View style={styles.searchResultsSkeleton}>
      {/* Search Header */}
      <View style={styles.searchHeaderSkeleton}>
        <Shimmer width="60%" height={16} style={{ marginBottom: 8 }} />
        <Shimmer width="30%" height={14} />
      </View>
      
      {/* Results */}
      <RecipeListSkeleton count={count} viewMode="grid" />
    </View>
  );
};

// Collection Skeleton
export const CollectionSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <View style={styles.collectionContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.collectionItemSkeleton}>
          <Shimmer width={60} height={60} borderRadius={12} />
          <View style={styles.collectionContentSkeleton}>
            <Shimmer width="70%" height={16} style={{ marginBottom: 4 }} />
            <Shimmer width="50%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
};

// Loading Overlay Component
interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  type?: 'spinner' | 'progress' | 'custom';
  progress?: number;
  children?: React.ReactNode;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message = 'Loading...',
  type = 'spinner',
  progress = 0,
  children,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.loadingOverlay, { opacity }]}>
      <View style={styles.loadingContainer}>
        {type === 'spinner' && <ActivityIndicator size="large" color="#007AFF" />}
        
        {type === 'progress' && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(progress)}%</Text>
          </View>
        )}
        
        {type === 'custom' && children}
        
        <Text style={styles.loadingMessage}>{message}</Text>
      </View>
    </Animated.View>
  );
};

// Generation Progress Component
interface GenerationProgressProps {
  visible: boolean;
  progress?: {
    status: string;
    progress: number;
    message: string;
  };
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  visible,
  progress,
}) => {
  const pulseAnimation = useShimmerAnimation(1000);
  
  const pulseScale = pulseAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  if (!visible || !progress) return null;

  return (
    <View style={styles.generationProgress}>
      <Animated.View 
        style={[
          styles.generationIcon,
          { transform: [{ scale: pulseScale }] }
        ]}
      >
        <Text style={styles.generationEmoji}>🤖</Text>
      </Animated.View>
      
      <Text style={styles.generationTitle}>AI Recipe Generation</Text>
      <Text style={styles.generationMessage}>{progress.message}</Text>
      
      <View style={styles.generationProgressBar}>
        <View 
          style={[
            styles.generationProgressFill, 
            { width: `${progress.progress}%` }
          ]} 
        />
      </View>
      
      <Text style={styles.generationPercentage}>{Math.round(progress.progress)}%</Text>
    </View>
  );
};

// Inline Loading Component for buttons
interface InlineLoadingProps {
  loading: boolean;
  text: string;
  loadingText?: string;
  style?: any;
  textStyle?: any;
}

export const InlineLoading: React.FC<InlineLoadingProps> = ({
  loading,
  text,
  loadingText,
  style,
  textStyle,
}) => {
  return (
    <View style={[styles.inlineLoading, style]}>
      {loading && (
        <ActivityIndicator 
          size="small" 
          color="#007AFF" 
          style={{ marginRight: 8 }} 
        />
      )}
      <Text style={[styles.inlineLoadingText, textStyle]}>
        {loading ? (loadingText || 'Loading...') : text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  // Shimmer
  shimmerContainer: {
    backgroundColor: '#E5E5EA',
    overflow: 'hidden',
  },
  shimmerGradient: {
    width: '50%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.3)',
    position: 'absolute',
  },

  // Recipe Card Skeletons
  recipeCardSkeletonGrid: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    margin: 8,
    width: (screenWidth - 48) / 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  recipeCardSkeletonList: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  recipeImageSkeleton: {
    marginRight: 16,
  },
  recipeContentSkeleton: {
    flex: 1,
  },
  recipeMetaSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recipeMetaSkeletonGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  // Recipe Grid/List
  recipeGridSkeleton: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  recipeListContainer: {
    paddingVertical: 8,
  },

  // Recipe Detail
  recipeDetailSkeleton: {
    flex: 1,
    backgroundColor: 'white',
  },
  recipeDetailContent: {
    paddingHorizontal: 16,
  },
  recipeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  ingredientSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  instructionSkeleton: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 8,
  },

  // Search Results
  searchResultsSkeleton: {
    flex: 1,
    paddingTop: 16,
  },
  searchHeaderSkeleton: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },

  // Collections
  collectionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  collectionItemSkeleton: {
    alignItems: 'center',
    marginRight: 16,
    width: 80,
  },
  collectionContentSkeleton: {
    marginTop: 8,
    alignItems: 'center',
  },

  // Loading Overlay
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  loadingContainer: {
    backgroundColor: 'white',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: 280,
    width: '80%',
  },
  loadingMessage: {
    marginTop: 16,
    fontSize: 16,
    color: '#1C1C1E',
    textAlign: 'center',
  },

  // Progress
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },

  // Generation Progress
  generationProgress: {
    backgroundColor: 'white',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    marginHorizontal: 32,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  generationIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  generationEmoji: {
    fontSize: 32,
  },
  generationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  generationMessage: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  generationProgressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  generationProgressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  generationPercentage: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
  },

  // Inline Loading
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineLoadingText: {
    fontSize: 16,
    color: '#1C1C1E',
  },
});