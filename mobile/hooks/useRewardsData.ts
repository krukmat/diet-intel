import { useState, useEffect } from 'react';
import { RewardsScreenData } from '../types/rewards';

// Initial empty data
const initialData: RewardsScreenData = {
  totalPoints: 0,
  currentLevel: 1,
  levelProgress: 0,
  pointsToNextLevel: 1000,
  currentStreak: 0,
  longestStreak: 0,
  achievements: [],
  unlockedAchievements: [],
  achievementPoints: 0
};

interface UseRewardsDataReturn {
  data: RewardsScreenData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// API endpoints para gamificación
const API_ENDPOINTS = {
  USER_POINTS: '/gamification/me/points',
  USER_BADGES: '/gamification/me/badges', 
  BADGE_DEFINITIONS: '/gamification/badges'
};

// Función para transformar datos del backend a formato RewardsScreenData
const transformBackendData = (pointsData: any, badgesData: any, definitionsData: any): RewardsScreenData => {
  // Extraer puntos y nivel
  const totalPoints = pointsData?.total_points || 0;
  const currentLevel = pointsData?.current_level || 1;
  const pointsNeeded = pointsData?.points_needed || 1000;
  
  // Calcular progreso de nivel
  const levelProgress = pointsData?.next_level_threshold 
    ? Math.round(((totalPoints % pointsData.next_level_threshold) / pointsData.next_level_threshold) * 100)
    : Math.round((totalPoints / (currentLevel * 1000)) * 100);
  
  // Transformar badges a achievements
  const achievements = (badgesData?.badges || []).map((badge: any) => ({
    id: badge.id || badge.name,
    title: badge.title || badge.name,
    description: badge.description || `Logro: ${badge.name}`,
    unlocked: badge.earned || false,
    progress: badge.earned ? 100 : (badge.progress || 0),
    target: badge.target || 1,
    points: badge.points || 100,
    icon: badge.icon || '🏆'
  }));
  
  // Agregar definiciones de badges como achievements potenciales
  const definitions = definitionsData?.definitions || {};
  Object.keys(definitions).forEach(key => {
    const def = definitions[key];
    if (!achievements.find(a => a.id === key)) {
      achievements.push({
        id: key,
        title: def.title || key,
        description: def.description || `Logro: ${key}`,
        unlocked: false,
        progress: 0,
        target: def.target || 1,
        points: def.points || 100,
        icon: def.icon || '🏆'
      });
    }
  });

  return {
    totalPoints,
    currentLevel,
    levelProgress,
    pointsToNextLevel: pointsNeeded,
    currentStreak: 0, // TODO: implementar streaks
    longestStreak: 0, // TODO: implementar streaks
    achievements,
    unlockedAchievements: achievements.filter(a => a.unlocked),
    achievementPoints: achievements.filter(a => a.unlocked).reduce((sum, a) => sum + a.points, 0)
  };
};

export const useRewardsData = (useMockData: boolean = false): UseRewardsDataReturn => {
  const [data, setData] = useState<RewardsScreenData | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRewardsData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Modo desarrollo: usar mock data
      if (useMockData) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simular API delay
        const mockData = {
          totalPoints: 1500,
          currentLevel: 3,
          levelProgress: 75,
          pointsToNextLevel: 500,
          currentStreak: 5,
          longestStreak: 12,
          achievements: [
            {
              id: 'first_meal',
              title: 'Primera Comida',
              description: 'Registra tu primera comida',
              unlocked: true,
              progress: 100,
              target: 1,
              points: 100,
              icon: '🍽️'
            },
            {
              id: 'weekly_streak',
              title: 'Racha Semanal',
              description: '7 días consecutivos',
              unlocked: false,
              progress: 5,
              target: 7,
              points: 200,
              icon: '🔥'
            }
          ],
          unlockedAchievements: [],
          achievementPoints: 500
        };
        setData(mockData);
        return;
      }

      // PRODUCCIÓN: Usar API real
      console.log('🔄 Conectando con backend de gamificación...');
      
      // Verificar que estamos en modo producción
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
      
      // Hacer llamadas paralelas a los endpoints
      const [pointsResponse, badgesResponse, definitionsResponse] = await Promise.all([
        fetch(`${baseUrl}${API_ENDPOINTS.USER_POINTS}`, {
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${baseUrl}${API_ENDPOINTS.USER_BADGES}`, {
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${baseUrl}${API_ENDPOINTS.BADGE_DEFINITIONS}`, {
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      // Verificar respuestas
      if (!pointsResponse.ok) {
        throw new Error(`Error al obtener puntos: ${pointsResponse.status}`);
      }
      if (!badgesResponse.ok) {
        throw new Error(`Error al obtener badges: ${badgesResponse.status}`);
      }
      if (!definitionsResponse.ok) {
        throw new Error(`Error al obtener definiciones: ${definitionsResponse.status}`);
      }

      // Parsear datos
      const pointsData = await pointsResponse.json();
      const badgesData = await badgesResponse.json();
      const definitionsData = await definitionsResponse.json();
      
      // Transformar datos
      const transformedData = transformBackendData(pointsData, badgesData, definitionsData);
      
      console.log('✅ Datos de gamificación cargados:', transformedData);
      setData(transformedData);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error('❌ Error al obtener datos de recompensas:', errorMessage);
      setError(`Error al cargar recompensas: ${errorMessage}`);
      
      // Fallback: usar datos vacíos en caso de error
      setData(initialData);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    fetchRewardsData();
  };

  useEffect(() => {
    fetchRewardsData();
  }, [useMockData]);

  return {
    data,
    loading,
    error,
    refresh
  };
};

// Función auxiliar para obtener token de autenticación
const getAuthToken = async (): Promise<string> => {
  // TODO: Implementar lógica real de obtención de token
  // Por ahora, retornar token placeholder
  return 'placeholder-token';
};
