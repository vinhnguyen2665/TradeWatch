export interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  telegram_chat_id?: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  full_name?: string;
  telegram_chat_id?: string;
}

export interface LoginData {
  username_or_email: string;
  password: string;
}

export interface UserProfileUpdateData {
  full_name?: string;
  telegram_chat_id?: string;
  current_password?: string;
  new_password?: string;
}

export interface PortfolioPosition {
  id?: number;
  user_id?: number;
  ticker: string;
  company_name?: string;
  buy_price: number;
  quantity: number;
  tp_pct: number;
  sl_pct: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  current_price?: number;
  volume?: number;
  change_pct?: number;
  pnl_pct?: number;
  pnl_value?: number;
  market_value?: number;
  tp_price?: number;
  sl_price?: number;
  status?: 'NORMAL' | 'TAKE_PROFIT_TRIGGERED' | 'STOP_LOSS_TRIGGERED';
  last_updated?: string;
}

export interface PriceHistory {
  id: number;
  ticker: string;
  price: number;
  volume: number;
  change_pct: number;
  timestamp: string;
}

export interface SystemSettings {
  polling_interval_sec: number;
  bot_status: 'RUNNING' | 'PAUSED';
  alert_cooldown_min: number;
  trade_hours_only: boolean;
  telegram_bot_token_set: boolean;
  telegram_chat_id?: string;
  scheduler_running: boolean;
}

export interface MarketStatus {
  is_open: boolean;
  session_name: string;
  session_code: string;
  description: string;
  current_vn_time: string;
}

export interface AlertLog {
  id: number;
  user_id?: number;
  ticker: string;
  alert_type: 'TAKE_PROFIT' | 'STOP_LOSS' | 'PRICE_SPIKE' | 'BUY_SIGNAL';
  triggered_price: number;
  pnl_pct: number;
  sent_at: string;
}

export interface ScreenerSignal {
  ticker: string;
  name?: string;
  exchange?: string;
  price: number;
  change_pct: number;
  volume: number;
  sma20_volume: number;
  volume_spike_ratio: number;
  rsi_14?: number;
  ma_20?: number;
  signal_type: 'VOLUME_BREAKOUT' | 'RSI_OVERSOLD_REBOUND' | 'MA20_BREAKOUT' | 'GOLDEN_CROSS';
  signal_strength: 'STRONG' | 'MEDIUM';
  reason: string;
  timestamp: string;
}

export interface DashboardSummary {
  total_positions: number;
  active_positions: number;
  total_investment: number;
  current_portfolio_value: number;
  total_pnl_value: number;
  total_pnl_pct: number;
  top_gainer?: PortfolioPosition;
  top_loser?: PortfolioPosition;
  bot_status: 'RUNNING' | 'PAUSED';
  polling_interval_sec: number;
  trade_hours_only: boolean;
  market_status?: MarketStatus;
  last_scan_time?: string;
  recent_alerts: AlertLog[];
}

export interface PositionFormData {
  ticker: string;
  company_name?: string;
  buy_price: number;
  quantity: number;
  tp_pct: number;
  sl_pct: number;
  is_active: boolean;
}
