import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, SupportedLanguage } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  login: (email: string, role?: UserProfile['role']) => void;
  logout: () => void;
  toggleSaveLocality: (id: string) => void;
  isLocalitySaved: (id: string) => boolean;
  setPreferredProfile: (profile: UserProfile['preferredProfile']) => void;
  switchRole: (role: UserProfile['role']) => void;
  setLanguagePreference: (lang: SupportedLanguage) => void;
}

const DEFAULT_USER: UserProfile = {
  id: 'usr-kunal-varanasi',
  email: 'kunal.singh@areawise.in',
  name: 'Kunal Singh',
  role: 'citizen',
  savedLocalityIds: ['sigra', 'lanka', 'assi'],
  savedComparisonIds: [],
  preferredProfile: 'family',
  language: 'en',
};

const AuthContext = createContext<AuthContextType>({
  user: DEFAULT_USER,
  login: () => {},
  logout: () => {},
  toggleSaveLocality: () => {},
  isLocalitySaved: () => false,
  setPreferredProfile: () => {},
  switchRole: () => {},
  setLanguagePreference: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('areawise_user');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return DEFAULT_USER;
        }
      }
    }
    return DEFAULT_USER;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('areawise_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('areawise_user');
    }
  }, [user]);

  const login = (email: string, role: UserProfile['role'] = 'citizen') => {
    const newUser: UserProfile = {
      id: `usr-${Date.now()}`,
      email,
      name: email.split('@')[0].replace('.', ' '),
      role,
      savedLocalityIds: ['sigra', 'lanka'],
      savedComparisonIds: [],
      preferredProfile: 'family',
      language: user?.language || 'en',
    };
    setUser(newUser);
  };

  const logout = () => {
    setUser(null);
  };

  const toggleSaveLocality = (id: string) => {
    if (!user) return;
    const exists = user.savedLocalityIds.includes(id);
    const updated = exists
      ? user.savedLocalityIds.filter((item) => item !== id)
      : [...user.savedLocalityIds, id];
    setUser({ ...user, savedLocalityIds: updated });
  };

  const isLocalitySaved = (id: string) => {
    return user ? user.savedLocalityIds.includes(id) : false;
  };

  const setPreferredProfile = (profile: UserProfile['preferredProfile']) => {
    if (!user) return;
    setUser({ ...user, preferredProfile: profile });
  };

  const switchRole = (role: UserProfile['role']) => {
    if (!user) return;
    setUser({ ...user, role });
  };

  const setLanguagePreference = (lang: SupportedLanguage) => {
    if (!user) return;
    setUser({ ...user, language: lang });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        toggleSaveLocality,
        isLocalitySaved,
        setPreferredProfile,
        switchRole,
        setLanguagePreference,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
