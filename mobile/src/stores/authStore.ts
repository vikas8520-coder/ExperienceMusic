import { create } from 'zustand';
import { soundcloudAdapter } from '@/adapters/soundcloudAdapter';
import type { User } from '@/types';

interface AuthStore {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  login: (accessToken: string, refreshToken?: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  isAuthenticated: false,
  user: null,
  isLoading: true,
  error: null,

  initialize: async () => {
    set({ isLoading: true });
    try {
      const hasToken = await soundcloudAdapter.initialize();
      if (hasToken) {
        const user = await soundcloudAdapter.getMe();
        set({ isAuthenticated: true, user, isLoading: false });
      } else {
        set({ isAuthenticated: false, user: null, isLoading: false });
      }
    } catch (error) {
      set({ 
        isAuthenticated: false, 
        user: null, 
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize'
      });
    }
  },

  login: async (accessToken: string, refreshToken?: string) => {
    set({ isLoading: true, error: null });
    try {
      await soundcloudAdapter.setTokens(accessToken, refreshToken);
      const user = await soundcloudAdapter.getMe();
      set({ isAuthenticated: true, user, isLoading: false });
    } catch (error) {
      await soundcloudAdapter.clearTokens();
      set({ 
        isAuthenticated: false, 
        user: null, 
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed'
      });
    }
  },

  logout: async () => {
    await soundcloudAdapter.clearTokens();
    set({ isAuthenticated: false, user: null });
  },
}));
