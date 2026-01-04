import { useMemo } from 'react';
import { FeatureToggle } from '../services/DeveloperSettings';
import { getHomeActions } from '../config/homeActions';

export const useHomeActions = (toggles?: FeatureToggle) => {
  const primaryActions = useMemo(() => getHomeActions('primary', toggles), [toggles]);
  const secondaryActions = useMemo(() => getHomeActions('secondary', toggles), [toggles]);
  const toolActions = useMemo(() => getHomeActions('tool', toggles), [toggles]);

  return {
    primaryActions,
    secondaryActions,
    toolActions,
  };
};
