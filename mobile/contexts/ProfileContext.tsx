import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Profile } from '../types/profile';
import { apiService } from '../services/ApiService';

// EPIC_A.A1: Contexto React para gestión de estado de perfil (~80 tokens)

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  isOwner: (profileId: string) => boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

interface ProfileProviderProps {
  children: ReactNode;
}

export const ProfileProvider: React.FC<ProfileProviderProps> = ({ children }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const refreshProfile = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // Primero obtener usuario actual
      const currentUserResponse = await apiService.getCurrentUser();
      const userId = currentUserResponse.data.id;
      setCurrentUserId(userId);

      // Luego obtener perfil
      const profileResponse = await apiService.getProfile(userId);
      setProfile(profileResponse.data);
    } catch (err) {
      console.error('ProfileContext - Error loading profile:', err);
      setError('Failed to load profile');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const isOwner = (profileId: string): boolean => {
    return currentUserId === profileId;
  };

  const contextValue: ProfileContextType = {
    profile,
    loading,
    error,
    refreshProfile,
    isOwner,
  };

  return (
    <ProfileContext.Provider value={contextValue}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = (): ProfileContextType => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
