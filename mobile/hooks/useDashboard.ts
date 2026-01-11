import { useState, useCallback } from 'react';
import { apiService, DashboardData } from '../services/ApiService';

export interface UseDashboardReturn {
  dashboard: DashboardData | null;
  dashboardLoading: boolean;
  dashboardError: string | null;
  loadDashboard: () => Promise<void>;
  refreshDashboard: () => Promise<void>;
}

export const useDashboard = (): UseDashboardReturn => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);

    try {
      const response = await apiService.getDashboard();
      setDashboard(response.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      setDashboardError('Failed to load progress data');
      // Keep existing dashboard or null
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    await loadDashboard();
  }, [loadDashboard]);

  return {
    dashboard,
    dashboardLoading,
    dashboardError,
    loadDashboard,
    refreshDashboard,
  };
};
