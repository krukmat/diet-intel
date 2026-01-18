import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useHomeDashboard } from '../hooks/useHomeDashboard';
import { HomeHeader } from './HomeDashboard/HomeHeader';
import { TodaySummaryCard } from './HomeDashboard/TodaySummaryCard';
import { homeDashboardStyles as styles } from './styles/HomeDashboard.styles';

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
  const { t } = useTranslation();
  // Extraer datos del hook personalizado
  const formattedData = useHomeDashboard({
    heroDailyCalories: props.heroDailyCalories,
    heroPlannedCalories: props.heroPlannedCalories,
    heroConsumedCalories: props.heroConsumedCalories,
    heroPlanActive: props.heroPlanActive,
  });
  const combinedActions = [
    ...props.primaryActions,
    ...props.secondaryActions,
    ...props.toolActions,
  ];
  const findAction = (id: string) =>
    combinedActions.find(action => action.id === id);
  const quickActionIds = ['logMeal', 'uploadLabel', 'photos'];
  const quickActions = quickActionIds
    .map((id) => findAction(id))
    .filter((action): action is ActionItem => Boolean(action))
    .map(action => ({
      id: action.id,
      label: action.label,
      icon: action.icon,
      onPress: action.onPress,
    }));
  const excludedTileIds = new Set(['explore', 'profile', ...quickActionIds]);
  const secondaryTiles = props.secondaryActions.filter(
    action => !excludedTileIds.has(action.id)
  );
  const actionTiles = [...quickActions, ...secondaryTiles];
  const headerUtilities = [
    ...props.toolActions,
    {
      id: 'language',
      label: '🌐',
      onPress: props.onShowLanguageSwitcher,
    },
    ...(props.showNotifications
      ? [{ id: 'notifications', label: '🔔', onPress: props.onShowNotifications }]
      : []),
    ...(props.showDeveloperSettings
      ? [{ id: 'settings', label: '⚙️', onPress: props.onShowDeveloperSettings }]
      : []),
    { id: 'logout', label: '🚪', onPress: props.onLogout },
  ];
  const planAction = findAction('plan');
  const summaryCtaHandler = planAction ? planAction.onPress : () => {};
  const hasActivePlan = props.heroPlanActive === true;
  const hasProgress =
    props.heroConsumedCalories !== null &&
    props.heroConsumedCalories !== undefined &&
    props.heroConsumedCalories > 0;
  const summaryHelperText = hasActivePlan
    ? (!hasProgress
        ? t('home.summary.emptyState', 'Aún no registraste comidas')
        : undefined)
    : t('home.summary.noPlan', 'Sin plan activo');
  const summaryCtaLabel = hasActivePlan
    ? t('home.summary.ctaPlan', 'Ver plan')
    : t('home.summary.ctaCreate', 'Crear plan');
  const progressValue =
    props.heroConsumedCalories !== null &&
    props.heroConsumedCalories !== undefined &&
    props.heroDailyCalories !== null &&
    props.heroDailyCalories !== undefined &&
    props.heroDailyCalories > 0
      ? props.heroConsumedCalories / props.heroDailyCalories
      : undefined;
  const summaryStats = [
    {
      id: 'progress',
      label: t('home.hero.todayProgress'),
      value: formattedData.progressText,
    },
    {
      id: 'plan',
      label: t('home.hero.planStatus'),
      value: formattedData.planText,
    },
  ];

  return (
    <View style={styles.homeContainer}>
      <HomeHeader
        title={props.title}
        greeting={props.subtitle}
        utilities={headerUtilities}
      />
      <TodaySummaryCard
        summaryTitle={t('home.summary.title', 'Resumen de hoy')}
        caloriesText={formattedData.caloriesText}
        stats={summaryStats}
        helperText={summaryHelperText}
        progressValue={progressValue}
        ctaLabel={summaryCtaLabel}
        onCtaPress={summaryCtaHandler}
      />
      <View style={styles.homeSpacer} />
      <View style={styles.actionsContainer}>
        <View style={styles.actionsGrid}>
          {actionTiles.map(action => (
            <TouchableOpacity
              key={action.id}
              onPress={action.onPress}
              style={styles.actionTile}
              testID={`home-action-${action.id}`}
            >
              {action.icon ? (
                <Text style={styles.actionTileIcon}>{action.icon}</Text>
              ) : null}
              <Text style={styles.actionTileText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}
