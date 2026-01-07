/**
 * Rewards Header Component for DietIntel Mobile App
 * Professional header component for rewards screen with navigation integration
 */

import React from 'react';
import { View, Text, TouchableOpacity, StatusBar } from 'react-native';

// Professional styling system - Modular approach
import { headerStyles } from '../../styles/header.styles';

interface RewardsHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightComponent?: React.ReactNode;
  backgroundColor?: string;
  titleColor?: string;
  testID?: string;
}

/**
 * Back button component
 */
const BackButton: React.FC<{
  onPress: () => void;
  color?: string;
  testID?: string;
}> = ({ onPress, color = 'white', testID = 'rewards-header-back-button' }) => (
  <TouchableOpacity onPress={onPress} testID={testID} style={headerStyles.backButton}>
    <Text style={[headerStyles.backButtonText, { color }]}>←</Text>
  </TouchableOpacity>
);

/**
 * Rewards Header component
 */
export const RewardsHeader: React.FC<RewardsHeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightComponent,
  backgroundColor = '#007AFF',
  titleColor = 'white',
  testID = 'rewards-header'
}) => {
  return (
    <View style={[headerStyles.container, { backgroundColor }]} testID={testID}>
      <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />
      
      <View style={headerStyles.content}>
        {/* Left side */}
        <View style={headerStyles.left}>
          {onBack && (
            <BackButton onPress={onBack} />
          )}
        </View>

        {/* Center - Title and subtitle */}
        <View style={headerStyles.center}>
          <Text 
            style={[headerStyles.title, { color: titleColor }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
          {subtitle && (
            <Text 
              style={headerStyles.subtitle}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right side */}
        <View style={headerStyles.right}>
          {rightComponent}
        </View>
      </View>
    </View>
  );
};

/**
 * Rewards Header with points display
 */
export const PointsHeader: React.FC<Omit<RewardsHeaderProps, 'title'> & {
  points: number;
  level: number;
}> = ({ points, level, ...props }) => {
  const rightComponent = (
    <View style={headerStyles.pointsContainer}>
      <Text style={headerStyles.pointsText}>{points} pts</Text>
      <Text style={headerStyles.levelText}>Nivel {level}</Text>
    </View>
  );

  return (
    <RewardsHeader
      {...props}
      title="🏆 Recompensas"
      rightComponent={rightComponent}
    />
  );
};

/**
 * Rewards Header with achievements count
 */
export const AchievementsHeader: React.FC<Omit<RewardsHeaderProps, 'title'> & {
  unlockedCount: number;
  totalCount: number;
}> = ({ unlockedCount, totalCount, ...props }) => {
  const rightComponent = (
    <View style={headerStyles.achievementsContainer}>
      <Text style={headerStyles.achievementsText}>
        {unlockedCount}/{totalCount}
      </Text>
      <Text style={headerStyles.achievementsLabel}>Logros</Text>
    </View>
  );

  return (
    <RewardsHeader
      {...props}
      title="🏆 Recompensas"
      rightComponent={rightComponent}
    />
  );
};
