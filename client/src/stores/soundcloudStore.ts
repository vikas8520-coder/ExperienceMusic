import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export interface SoundCloudTrack {
  id: number;
  title: string;
  user: {
    username: string;
    avatar_url?: string;
  };
  artwork_url?: string;
  duration: number;
  stream_url?: string;
  streamable: boolean;
}

export interface SoundCloudPlaylist {
  id: number;
  title: string;
  artwork_url?: string;
  track_count: number;
  tracks: SoundCloudTrack[];
}

interface SoundCloudAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface SoundCloudUser {
  id: number;
  username: string;
  avatar_url?: string;
}

interface SoundCloudStore {
  auth: SoundCloudAuth | null;
  user: SoundCloudUser | null;
  clientId: string | null;
  oauthState: string | null;
  isLoading: boolean;
  error: string | null;
  
  tracks: SoundCloudTrack[];
  likes: SoundCloudTrack[];
  playlists: SoundCloudPlaylist[];
  searchQuery: string;
  activeTab: 'search' | 'likes' | 'playlists';
  
  setClientId: (clientId: string) => void;
  setAuth: (auth: SoundCloudAuth) => void;
  setUser: (user: SoundCloudUser) => void;
  setOauthState: (state: string | null) => void;
  logout: () => void;
  
  setSearchQuery: (query: string) => void;
  setActiveTab: (tab: 'search' | 'likes' | 'playlists') => void;
  setTracks: (tracks: SoundCloudTrack[]) => void;
  setLikes: (likes: SoundCloudTrack[]) => void;
  setPlaylists: (playlists: SoundCloudPlaylist[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  isAuthenticated: () => boolean;
  getAuthHeader: () => string | null;
  refreshTokenIfNeeded: () => Promise<boolean>;
  initiateLogin: () => void;
  validateOAuthCallback: (code: string, state: string) => boolean;
}

export const useSoundCloudStore = create<SoundCloudStore>()(
  persist(
    (set, get) => ({
      auth: null,
      user: null,
      clientId: null,
      oauthState: null,
      isLoading: false,
      error: null,
      
      tracks: [],
      likes: [],
      playlists: [],
      searchQuery: '',
      activeTab: 'search',
      
      setClientId: (clientId) => set({ clientId }),
      
      setAuth: (auth) => set({ auth }),
      
      setUser: (user) => set({ user }),
      
      setOauthState: (oauthState) => set({ oauthState }),
      
      logout: () => set({ 
        auth: null, 
        user: null, 
        oauthState: null,
        tracks: [], 
        likes: [], 
        playlists: [],
        searchQuery: '',
        error: null 
      }),
      
      initiateLogin: () => {
        const { clientId } = get();
        if (!clientId) {
          set({ error: 'SoundCloud is not configured' });
          return;
        }
        
        const state = generateState();
        set({ oauthState: state });
        
        const redirectUri = `${window.location.origin}${window.location.pathname}`;
        const authUrl = new URL('https://api.soundcloud.com/connect');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'non-expiring');
        authUrl.searchParams.set('state', state);
        
        window.location.href = authUrl.toString();
      },
      
      validateOAuthCallback: (code: string, state: string) => {
        const { oauthState } = get();
        if (!oauthState || oauthState !== state) {
          set({ error: 'Invalid OAuth state - possible CSRF attack', oauthState: null });
          return false;
        }
        set({ oauthState: null });
        return true;
      },
      
      setSearchQuery: (query) => set({ searchQuery: query }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setTracks: (tracks) => set({ tracks }),
      setLikes: (likes) => set({ likes }),
      setPlaylists: (playlists) => set({ playlists }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      
      isAuthenticated: () => {
        const { auth } = get();
        return auth !== null && auth.expiresAt > Date.now();
      },
      
      getAuthHeader: () => {
        const { auth } = get();
        if (!auth) return null;
        return `OAuth ${auth.accessToken}`;
      },
      
      refreshTokenIfNeeded: async () => {
        const { auth, setAuth, logout } = get();
        if (!auth) return false;
        
        if (auth.expiresAt > Date.now() + 60000) {
          return true;
        }
        
        try {
          const response = await fetch('/api/auth/soundcloud/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: auth.refreshToken }),
          });
          
          if (!response.ok) {
            logout();
            return false;
          }
          
          const data = await response.json();
          setAuth({
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + (data.expires_in * 1000),
          });
          return true;
        } catch (error) {
          console.error('Token refresh failed:', error);
          logout();
          return false;
        }
      },
    }),
    {
      name: 'soundcloud-auth',
      partialize: (state) => ({ 
        auth: state.auth,
        user: state.user,
        oauthState: state.oauthState,
      }),
    }
  )
);

export async function fetchSoundCloudConfig(): Promise<string | null> {
  try {
    const response = await fetch('/api/soundcloud/config');
    if (!response.ok) return null;
    const data = await response.json();
    return data.clientId;
  } catch {
    return null;
  }
}

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

async function handleApiResponse<T>(response: Response, errorMessage: string): Promise<T> {
  if (response.status === 401 || response.status === 403) {
    useSoundCloudStore.getState().logout();
    throw new AuthError('Session expired. Please log in again.');
  }
  if (!response.ok) {
    throw new Error(errorMessage);
  }
  return response.json();
}

export async function searchTracks(query: string, authHeader: string): Promise<SoundCloudTrack[]> {
  const response = await fetch(`/api/soundcloud/tracks?q=${encodeURIComponent(query)}&limit=20`, {
    headers: { 'Authorization': authHeader },
  });
  return handleApiResponse<SoundCloudTrack[]>(response, 'Failed to search tracks');
}

export async function fetchUserLikes(authHeader: string): Promise<SoundCloudTrack[]> {
  const response = await fetch('/api/soundcloud/me/likes?limit=50', {
    headers: { 'Authorization': authHeader },
  });
  const data = await handleApiResponse<{ collection?: Array<{ track?: SoundCloudTrack }> }>(response, 'Failed to fetch likes');
  return data.collection?.map((item) => item.track).filter((t): t is SoundCloudTrack => !!t) || [];
}

export async function fetchUserPlaylists(authHeader: string): Promise<SoundCloudPlaylist[]> {
  const response = await fetch('/api/soundcloud/me/playlists', {
    headers: { 'Authorization': authHeader },
  });
  return handleApiResponse<SoundCloudPlaylist[]>(response, 'Failed to fetch playlists');
}

export async function getStreamUrl(trackId: number, authHeader: string): Promise<string | null> {
  const response = await fetch(`/api/soundcloud/tracks/${trackId}/stream`, {
    headers: { 'Authorization': authHeader },
  });
  if (response.status === 401 || response.status === 403) {
    useSoundCloudStore.getState().logout();
    throw new AuthError('Session expired. Please log in again.');
  }
  if (!response.ok) return null;
  const data = await response.json();
  return data.http_mp3_128_url || data.hls_mp3_128_url || null;
}

export async function fetchUserInfo(authHeader: string): Promise<SoundCloudUser | null> {
  const response = await fetch('/api/soundcloud/me', {
    headers: { 'Authorization': authHeader },
  });
  if (response.status === 401 || response.status === 403) {
    useSoundCloudStore.getState().logout();
    return null;
  }
  if (!response.ok) return null;
  return response.json();
}
