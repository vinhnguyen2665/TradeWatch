export interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  role: 'admin' | 'user';
  telegram_chat_id?: string;
  created_at: string;
}

export interface UserAdminItem {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  role: 'admin' | 'user';
  telegram_chat_id?: string;
  created_at: string;
  updated_at?: string;
  positions_count: number;
  alerts_count: number;
  ai_provider?: string;
}

export interface UserGrowthPoint {
  date: string;
  users_count: number;
}

export interface TopActiveUser {
  id: number;
  username: string;
  full_name?: string;
  role: string;
  positions_count: number;
  alerts_count: number;
}

export interface UserAdminStats {
  total_users: number;
  total_admins: number;
  total_regular_users: number;
  total_positions_tracked: number;
  total_alerts_sent: number;
  user_growth: UserGrowthPoint[];
  top_users: TopActiveUser[];
}

export interface AdminCreateUserData {
  username: string;
  email: string;
  password: string;
  full_name?: string;
  role: 'admin' | 'user';
  telegram_chat_id?: string;
}

export interface AdminUpdateUserData {
  full_name?: string;
  email?: string;
  role?: 'admin' | 'user';
  telegram_chat_id?: string;
  password?: string;
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
  gemini_api_key_set?: boolean;
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

// --- AI Portfolio Allocation Interfaces ---
export type AIProviderType = 'gemini' | 'openai' | 'local';

export interface UserAIConfig {
  ai_provider: AIProviderType;
  gemini_api_key_set: boolean;
  gemini_api_key_masked?: string;
  openai_api_key_set: boolean;
  openai_api_key_masked?: string;
  local_ai_base_url?: string | null;
  local_ai_api_key_set: boolean;
  local_ai_api_key_masked?: string;
  selected_model?: string;
}

export interface GeminiModelInfo {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  input_token_limit?: number;
  output_token_limit?: number;
  is_recommended: boolean;
}

export interface AssetAllocationItem {
  asset_class: string;
  ticker: string;
  company_name?: string;
  capital_percentage: number;
  allocated_amount: number;
  current_price: number;
  estimated_shares: number;
  strategic_position: string;
  profit_target: string;
  stop_loss?: string;
}

export interface DetailedPositionStrategy {
  ticker: string;
  asset_class: string;
  percentage: number;
  title: string;
  badge_type: 'SAFE' | 'MEDIUM' | 'HIGH_RISK';
  position_analysis: string;
  execution_strategy: string;
  buy_zone: string;
  profit_target_zone: string;
  stop_loss_zone: string;
  risk_notes: string;
}

export interface PortfolioAllocationResult {
  total_capital: number;
  risk_profile: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | string;
  summary_table: AssetAllocationItem[];
  detailed_strategies: DetailedPositionStrategy[];
  executive_summary: string;
  market_cycle_assessment: string;
  risk_management_rules: string[];
  estimated_portfolio_yield?: string;
  ai_provider?: AIProviderType | string;
  ai_model?: string;
}

export interface PortfolioAllocationRequest {
  total_capital: number;
  vn30_tickers?: string[];
  midcap_tickers?: string[];
  penny_tickers?: string[];
  vn30_ticker?: string;
  midcap_ticker?: string;
  penny_ticker?: string;
  ai_provider?: AIProviderType;
  custom_api_key?: string;
  custom_base_url?: string;
  model_name?: string;
  risk_profile?: string;
  custom_weights?: {
    vn30: number;
    midcap: number;
    penny: number;
  };
}

export interface PortfolioAllocationRecord {
  id?: number;
  user_id?: number;
  total_capital: number;
  data: PortfolioAllocationResult;
  created_at: string;
}

