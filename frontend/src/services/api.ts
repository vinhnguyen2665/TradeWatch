import axios from 'axios';
import {
  PortfolioPosition,
  PriceHistory,
  SystemSettings,
  ScreenerSignal,
  DashboardSummary,
  PositionFormData,
  User,
  AuthResponse,
  LoginData,
  RegisterData,
  UserProfileUpdateData,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Gắn JWT Bearer token tự động vào header của mỗi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tradewatch_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Xử lý response lỗi 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token hết hạn hoặc không hợp lệ
      const currentToken = localStorage.getItem('tradewatch_token');
      if (currentToken) {
        localStorage.removeItem('tradewatch_token');
        localStorage.removeItem('tradewatch_user');
        window.dispatchEvent(new Event('auth:logout'));
      }
    }
    return Promise.reject(error);
  }
);

// --- Auth APIs ---
export const loginApi = async (data: LoginData): Promise<AuthResponse> => {
  const res = await api.post<AuthResponse>('/auth/login', data);
  return res.data;
};

export const registerApi = async (data: RegisterData): Promise<AuthResponse> => {
  const res = await api.post<AuthResponse>('/auth/register', data);
  return res.data;
};

export const getMeApi = async (): Promise<User> => {
  const res = await api.get<User>('/auth/me');
  return res.data;
};

export const updateProfileApi = async (data: UserProfileUpdateData): Promise<User> => {
  const res = await api.put<User>('/auth/profile', data);
  return res.data;
};

// --- Portfolio & Dashboard APIs ---
export const getDashboardSummary = async (): Promise<DashboardSummary> => {
  const res = await api.get<DashboardSummary>('/dashboard/summary');
  return res.data;
};

export const toggleBotStatus = async (): Promise<{ success: boolean; bot_status: 'RUNNING' | 'PAUSED'; message: string }> => {
  const res = await api.post('/dashboard/toggle-bot');
  return res.data;
};

export const getPositions = async (): Promise<PortfolioPosition[]> => {
  const res = await api.get<PortfolioPosition[]>('/positions');
  return res.data;
};

export const savePosition = async (data: PositionFormData): Promise<PortfolioPosition> => {
  const res = await api.post<PortfolioPosition>('/positions', data);
  return res.data;
};

export const updatePosition = async (ticker: string, data: Partial<PositionFormData>): Promise<PortfolioPosition> => {
  const res = await api.put<PortfolioPosition>(`/positions/${ticker}`, data);
  return res.data;
};

export const deletePosition = async (ticker: string): Promise<{ success: boolean; message: string }> => {
  const res = await api.delete(`/positions/${ticker}`);
  return res.data;
};

export const getPriceHistory = async (ticker: string, limit: number = 100): Promise<PriceHistory[]> => {
  const res = await api.get<PriceHistory[]>(`/history/${ticker}`, {
    params: { limit },
  });
  return res.data;
};

export const getSettings = async (): Promise<SystemSettings> => {
  const res = await api.get<SystemSettings>('/settings');
  return res.data;
};

export const updateSettings = async (settings: Partial<SystemSettings> & { telegram_bot_token?: string; telegram_chat_id?: string }): Promise<SystemSettings> => {
  const res = await api.post<SystemSettings>('/settings', settings);
  return res.data;
};

export const testTelegramConnection = async (payload: { bot_token?: string; chat_id?: string; custom_message?: string }): Promise<{ success: boolean; message: string }> => {
  const res = await api.post('/settings/test-telegram', payload);
  return res.data;
};

export const getScreenerSuggestions = async (): Promise<ScreenerSignal[]> => {
  const res = await api.get<ScreenerSignal[]>('/screener/suggest');
  return res.data;
};

export default api;
