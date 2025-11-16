// src/services/authService.ts
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    is_staff: boolean;
  };
}

export const authService = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login/', credentials);
    const { access, refresh, user } = response.data;
    
    useAuthStore.getState().setAuth(user, access, refresh);
    
    return response.data;
  },

  logout: async (): Promise<void> => {
    const { refreshToken } = useAuthStore.getState();
    try {
      if (refreshToken) {
        await api.post('/auth/logout/', { refresh_token: refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      useAuthStore.getState().logout();
    }
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/user/');
    useAuthStore.getState().setUser(response.data);
    return response.data;
  },
};

