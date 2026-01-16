import React from 'react';
import { useHomeDashboard } from '../hooks/useHomeDashboard';
import {
  HeroSection,
  HeaderSection,
  NavigationSection
} from './HomeDashboard/index';

interface ActionItem {
  id: string;
  label: string;
  icon?: string;
  onPress: () => void;
}

interface HomeDashboardProps {
  title: string;
  subtitle: string;
  version: string;
  heroDailyCalories?: number | null;
  heroPlannedCalories?: number | null;
  heroConsumedCalories?: number | null;
  heroPlanActive?: boolean | null;
  toolActions: ActionItem[];
  primaryActions: ActionItem[];
  secondaryActions: ActionItem[];
  showDeveloperSettings: boolean;
  showNotifications: boolean;
  onLogout: () => void;
  onShowDeveloperSettings: () => void;
  onShowNotifications: () => void;
  onShowLanguageSwitcher: () => void;
}

/**
 * Componente principal del HomeDashboard refactorizado
 * Utiliza separación de responsabilidades con hooks y componentes puros
 */
export default function HomeDashboard(props: HomeDashboardProps) {
  // Extraer datos del hook personalizado
  const formattedData = useHomeDashboard({
    heroDailyCalories: props.heroDailyCalories,
    heroPlannedCalories: props.heroPlannedCalories,
    heroConsumedCalories: props.heroConsumedCalories,
    heroPlanActive: props.heroPlanActive,
  });

  return (
    <>
      <HeaderSection
        toolActions={props.toolActions}
        onLogout={props.onLogout}
        onShowDeveloperSettings={props.onShowDeveloperSettings}
        onShowNotifications={props.onShowNotifications}
        onShowLanguageSwitcher={props.onShowLanguageSwitcher}
        showDeveloperSettings={props.showDeveloperSettings}
        showNotifications={props.showNotifications}
      />

      <HeroSection
        title={props.title}
        subtitle={props.subtitle}
        version={props.version}
        caloriesText={formattedData.caloriesText}
        plannedCaloriesText={formattedData.plannedCaloriesText}
        progressText={formattedData.progressText}
        planText={formattedData.planText}
      />

      <NavigationSection primaryActions={props.primaryActions} />
    </>
  );
}
