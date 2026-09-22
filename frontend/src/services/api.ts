import axios from 'axios';
import {
  PortfolioPosition,
  PriceHistory,
  SystemSettings,
  ScreenerSignal,
  DashboardSummary,
  PositionFormData,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
