import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, onIdTokenChanged, signInWithPopup, signOut } from 'firebase/auth';
import config from '../../firebase-applet-config.json';
import { readJson } from '../api';
import type { UserProfile, SupportedLanguage } from '../types';

const firebaseConfig = {
  ...config,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || config.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || config.appId,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || config.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || config.authDomain,
};
const auth = getAuth(initializeApp(firebaseConfig));
const emulator = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL;
if (import.meta.env.DEV && emulator && firebaseConfig.projectId.startsWith('demo-') &&
    /^http:\/\/127\.0\.0\.1:\d+$/.test(emulator)) {
  connectAuthEmulator(auth, emulator);
}

export interface SavedComparison {
  id: string;
  title: string;
  placeIds: string[];
  savedAt: string;
}
interface AccountData {
  savedLocalityIds: string[];
  language: SupportedLanguage;
  preferredProfile: UserProfile['preferredProfile'];
  comparisons: SavedComparison[];
}
interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  accountError: string;
  comparisons: SavedComparison[];
  login: () => Promise<void>;
  logout: () => Promise<void>;
  reloadAccount: () => Promise<void>;
  toggleSaveLocality: (id: string) => Promise<void>;
  isLocalitySaved: (id: string) => boolean;
  setPreferredProfile: (profile: UserProfile['preferredProfile']) => void;
  setLanguagePreference: (language: SupportedLanguage) => void;
}

const empty: AccountData = { savedLocalityIds: [], comparisons: [], language: 'en', preferredProfile: 'family' };
const AuthContext = createContext<AuthContextType | null>(null);

export async function authenticatedFetch(url: string, options?: RequestInit) {
  if (!url.startsWith('/api/')) throw new Error('Account credentials are restricted to AreaWise API requests.');
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in to continue.');
  const headers = new Headers(options?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...options, headers, redirect: 'error' });
}

function loadAccount(signal?: AbortSignal) {
  return authenticatedFetch('/api/v1/me', { signal }).then((response) => readJson<AccountData>(response));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Pick<UserProfile, 'id' | 'email' | 'name' | 'role'> | null>(null);
  const [accountState, setAccount] = useState<{ uid: string; data: AccountData } | null>(null);
  const account = accountState?.uid === identity?.id ? accountState?.data ?? empty : empty;
  const [loading, setLoading] = useState(true);
  const [accountError, setAccountError] = useState('');

  useEffect(() => {
    let revision = 0;
    let request: AbortController | undefined;
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      const current = ++revision;
      request?.abort();
      if (!user) {
        setIdentity(null);
        setAccount(null);
        setAccountError('');
        setLoading(false);
        return;
      }
      const abort = new AbortController();
      request = abort;
      try {
        const { claims } = await user.getIdTokenResult();
        if (current !== revision) return;
        setIdentity({
          id: user.uid, email: user.email ?? '', name: user.displayName ?? 'AreaWise user',
          role: claims.admin === true ? 'admin' : claims.professional === true ? 'consultant' : 'citizen',
        });
        const profile = await loadAccount(abort.signal);
        if (current === revision) {
          setAccount({ uid: user.uid, data: profile });
          setAccountError('');
        }
      } catch (error) {
        if (current === revision) setAccountError(error instanceof Error ? error.message : 'Account data unavailable.');
      } finally {
        if (current === revision) setLoading(false);
      }
    });
    return () => {
      revision++;
      request?.abort();
      unsubscribe();
    };
  }, []);

  async function reloadAccount() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const profile = await loadAccount();
    if (auth.currentUser?.uid === uid) {
      setAccount({ uid, data: profile });
      setAccountError('');
    }
  }

  async function preference(change: Partial<Pick<AccountData, 'language' | 'preferredProfile'>>) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      await readJsonIfPresent(await authenticatedFetch('/api/v1/me/preferences', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(change),
      }));
      if (auth.currentUser?.uid === uid) setAccount((previous) => ({
        uid, data: { ...(previous?.uid === uid ? previous.data : empty), ...change },
      }));
    } catch (error) {
      if (auth.currentUser?.uid === uid) setAccountError(error instanceof Error ? error.message : 'Preferences could not be saved.');
    }
  }

  const user = identity ? { ...identity, ...account, savedComparisonIds: account.comparisons.map(({ id }) => id) } : null;
  return (
    <AuthContext.Provider value={{
      user,
      loading,
      accountError,
      comparisons: account.comparisons,
      login: async () => { await signInWithPopup(auth, new GoogleAuthProvider()); },
      logout: () => signOut(auth),
      reloadAccount,
      toggleSaveLocality: async (id) => {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('Sign in to save places.');
        const wasSaved = account.savedLocalityIds.includes(id);
        await readJsonIfPresent(await authenticatedFetch(`/api/v1/me/saved/${encodeURIComponent(id)}`, {
          method: wasSaved ? 'DELETE' : 'PUT',
        }));
        if (auth.currentUser?.uid !== uid) return;
        setAccount((previous) => {
          const current = previous?.uid === uid ? previous.data : empty;
          return { uid, data: {
            ...current,
            savedLocalityIds: wasSaved
              ? current.savedLocalityIds.filter((place) => place !== id)
              : [...new Set([...current.savedLocalityIds, id])],
          } };
        });
      },
      isLocalitySaved: (id) => account.savedLocalityIds.includes(id),
      setPreferredProfile: (preferredProfile) => { void preference({ preferredProfile }); },
      setLanguagePreference: (language) => { void preference({ language }); },
    }}>
      {children}
    </AuthContext.Provider>
  );
}

async function readJsonIfPresent(response: Response) {
  if (response.status !== 204) await readJson(response);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required.');
  return context;
}
