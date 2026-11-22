import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onIdTokenChanged, signInWithPopup, signOut } from 'firebase/auth';
import config from '../../firebase-applet-config.json';
import type { UserProfile, SupportedLanguage } from '../types';

const auth = getAuth(initializeApp(config));
type Preferences = Pick<UserProfile, 'savedLocalityIds' | 'savedComparisonIds' | 'preferredProfile' | 'language'>;
const defaults: Preferences = {
  savedLocalityIds: [],
  savedComparisonIds: [],
  preferredProfile: 'family',
  language: 'en',
};

interface AuthContextType {
  user: UserProfile | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  toggleSaveLocality: (id: string) => void;
  isLocalitySaved: (id: string) => boolean;
  setPreferredProfile: (profile: UserProfile['preferredProfile']) => void;
  setLanguagePreference: (lang: SupportedLanguage) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export async function authenticatedFetch(url: string, options?: RequestInit) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in to continue.');
  const headers = new Headers(options?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [identity, setIdentity] = useState<Omit<UserProfile, keyof Preferences> | null>(null);
  const [preferencesByUser, setPreferencesByUser] = useState<Record<string, Preferences>>({});

  useEffect(() => {
    let revision = 0;
    const unsubscribe = onIdTokenChanged(auth, async (account) => {
      const current = ++revision;
      setIdentity(null);
      if (!account) return;
      try {
        const { claims } = await account.getIdTokenResult();
        if (current !== revision) return;
        let preferences = defaults;
        try {
          const saved = localStorage.getItem(`areawise/preferences/${account.uid}`);
          if (saved) preferences = { ...defaults, ...JSON.parse(saved) };
        } catch {
          // Storage may be unavailable in private browsing.
        }
        setPreferencesByUser((previous) => previous[account.uid] ? previous : {
          ...previous,
          [account.uid]: preferences,
        });
        setIdentity({
          id: account.uid,
          email: account.email ?? '',
          name: account.displayName ?? account.email ?? 'AreaWise user',
          role: claims.admin === true ? 'admin' : 'citizen',
        });
      } catch (error) {
        console.error('Unable to read the Firebase session:', error);
      }
    });
    return () => {
      revision++;
      unsubscribe();
    };
  }, []);

  const preferences = identity ? preferencesByUser[identity.id] ?? defaults : defaults;
  const user = identity ? { ...identity, ...preferences } : null;

  useEffect(() => {
    if (!identity) return;
    try {
      localStorage.setItem(`areawise/preferences/${identity.id}`, JSON.stringify(preferences));
    } catch {
      // Keep preferences in memory when storage is unavailable.
    }
  }, [identity, preferences]);

  const update = (change: (previous: Preferences) => Preferences) => {
    if (!identity) return;
    const { id } = identity;
    setPreferencesByUser((previous) => ({
      ...previous,
      [id]: change(previous[id] ?? defaults),
    }));
  };

  return (
    <AuthContext.Provider value={{
      user,
      login: async () => { await signInWithPopup(auth, new GoogleAuthProvider()); },
      logout: () => signOut(auth),
      toggleSaveLocality: (id) => update((previous) => ({
        ...previous,
        savedLocalityIds: previous.savedLocalityIds.includes(id)
          ? previous.savedLocalityIds.filter((item) => item !== id)
          : [...previous.savedLocalityIds, id],
      })),
      isLocalitySaved: (id) => preferences.savedLocalityIds.includes(id),
      setPreferredProfile: (preferredProfile) => update((previous) => ({ ...previous, preferredProfile })),
      setLanguagePreference: (language) => update((previous) => ({ ...previous, language })),
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required.');
  return context;
}
