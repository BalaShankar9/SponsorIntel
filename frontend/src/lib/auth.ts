'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from './api';
import type { User, AuthToken } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isPro: boolean;
  isEnterprise: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isPro: false,
      isEnterprise: false,
      isAdmin: false,

      login: async (email: string, password: string) => {
        const tokenData = await api.post<AuthToken>('/api/v1/auth/login', { email, password });
        api.setToken(tokenData.access_token);
        const user = await api.get<User>('/api/v1/auth/me');
        set({
          user,
          token: tokenData.access_token,
          isAuthenticated: true,
          isPro: user.plan === 'pro' || user.plan === 'enterprise',
          isEnterprise: user.plan === 'enterprise',
          isAdmin: false, // determined by backend role
        });
      },

      register: async (email: string, password: string, name: string) => {
        await api.post('/api/v1/auth/register', { email, password, name });
      },

      logout: () => {
        api.clearToken();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isPro: false,
          isEnterprise: false,
          isAdmin: false,
        });
      },

      setUser: (user: User) => {
        set({
          user,
          isAuthenticated: true,
          isPro: user.plan === 'pro' || user.plan === 'enterprise',
          isEnterprise: user.plan === 'enterprise',
        });
      },
    }),
    {
      name: 'sponsorintel-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrate: (_state) => {
        return (rehydratedState) => {
          if (rehydratedState?.token) {
            api.setToken(rehydratedState.token);
            rehydratedState.isAuthenticated = true;
            if (rehydratedState.user) {
              rehydratedState.isPro = rehydratedState.user.plan === 'pro' || rehydratedState.user.plan === 'enterprise';
              rehydratedState.isEnterprise = rehydratedState.user.plan === 'enterprise';
            }
          }
        };
      },
    }
  )
);
