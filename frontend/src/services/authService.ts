import api from './api';
import { ApiResponse, User } from '../types';

export interface LoginResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

class AuthService {
  async login(email: string, password: string): Promise<LoginResult> {
    const res: ApiResponse<LoginResult> = await api.post('/auth/login', { email, password });
    if (!res.success || !res.data) {
      throw new Error(res.message || '로그인에 실패했습니다');
    }
    localStorage.setItem('accessToken', res.data.accessToken);
    localStorage.setItem('refreshToken', res.data.refreshToken);
    return res.data;
  }

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }
}

export const authService = new AuthService();
