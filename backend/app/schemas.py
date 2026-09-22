from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr, field_validator


# --- User & Auth Schemas ---
class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Tên đăng nhập")
    email: EmailStr = Field(..., description="Email người dùng")
    password: str = Field(..., min_length=6, max_length=100, description="Mật khẩu")
    full_name: Optional[str] = Field(None, max_length=255, description="Họ và tên")
    telegram_chat_id: Optional[str] = Field(None, max_length=100, description="Telegram Chat ID")

    @field_validator("username")
    @classmethod
    def normalize_username(cls, v: str) -> str:
        return v.strip().lower()


class UserLogin(BaseModel):
    username_or_email: str = Field(..., description="Tên đăng nhập hoặc email")
    password: str = Field(..., description="Mật khẩu")


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=255)
    telegram_chat_id: Optional[str] = Field(None, max_length=100)
    current_password: Optional[str] = None
    new_password: Optional[str] = Field(None, min_length=6, max_length=100)


class UserAIConfigUpdate(BaseModel):
    ai_provider: str = Field(default="gemini", description="'gemini' | 'openai' | 'local'")
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    local_ai_base_url: Optional[str] = None
    local_ai_api_key: Optional[str] = None
    selected_model: Optional[str] = None


class UserAIConfigOut(BaseModel):
    ai_provider: str = "gemini"
    gemini_api_key_set: bool = False
    gemini_api_key_masked: Optional[str] = None
    openai_api_key_set: bool = False
    openai_api_key_masked: Optional[str] = None
    local_ai_base_url: Optional[str] = None
    local_ai_api_key_set: bool = False
    local_ai_api_key_masked: Optional[str] = None
    selected_model: Optional[str] = None



class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# --- Portfolio Position Schemas ---
class PortfolioPositionBase(BaseModel):
    ticker: str = Field(..., min_length=2, max_length=10, description="Mã chứng khoán (HOSE/HNX/UPCoM)")
    company_name: Optional[str] = Field(None, max_length=255, description="Tên công ty niêm yết")
    buy_price: float = Field(default=25.0, ge=0.0, description="Giá vốn (x1,000 VND)")
    quantity: int = Field(default=100, ge=0, description="Số lượng cổ phiếu")
    tp_pct: float = Field(default=7.0, ge=0.0, le=100.0, description="Ngưỡng chốt lời %")
    sl_pct: float = Field(default=5.0, ge=0.0, le=100.0, description="Ngưỡng cắt lỗ %")
    is_active: bool = Field(default=True, description="Trạng thái theo dõi")

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, v: str) -> str:
        cleaned = (v or "").strip().upper()
        if len(cleaned) < 2:
            raise ValueError("Mã cổ phiếu phải có ít nhất 2 ký tự")
        return cleaned


class PortfolioPositionCreate(PortfolioPositionBase):
    pass


class PortfolioPositionUpdate(BaseModel):
    company_name: Optional[str] = None
    buy_price: Optional[float] = Field(None, ge=0.0)
    quantity: Optional[int] = Field(None, ge=0)
    tp_pct: Optional[float] = Field(None, ge=0.0, le=100.0)
    sl_pct: Optional[float] = Field(None, ge=0.0, le=100.0)
    is_active: Optional[bool] = None


class PortfolioPositionOut(PortfolioPositionBase):
    id: Optional[int] = None
    user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    current_price: Optional[float] = None
    volume: Optional[int] = None
    change_pct: Optional[float] = None
    pnl_pct: Optional[float] = None
    pnl_value: Optional[float] = None  # in VND (x1000)
    market_value: Optional[float] = None
    tp_price: Optional[float] = None
    sl_price: Optional[float] = None
    status: Optional[str] = "NORMAL"  # 'NORMAL', 'TAKE_PROFIT_TRIGGERED', 'STOP_LOSS_TRIGGERED'
    last_updated: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Price History Schemas ---
class PriceHistoryOut(BaseModel):
    id: int
    ticker: str
    price: float
    volume: int
    change_pct: float
    timestamp: datetime

    class Config:
        from_attributes = True


# --- System Setting Schemas ---
class SystemSettingItem(BaseModel):
    key: str
    value: str


class SystemSettingsUpdate(BaseModel):
    polling_interval_sec: Optional[int] = Field(None, ge=5, le=3600)
    bot_status: Optional[str] = Field(None, pattern="^(RUNNING|PAUSED)$")
    alert_cooldown_min: Optional[int] = Field(None, ge=1, le=1440)
    trade_hours_only: Optional[bool] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    gemini_api_key: Optional[str] = None


class SystemSettingsOut(BaseModel):
    polling_interval_sec: int
    bot_status: str
    alert_cooldown_min: int
    trade_hours_only: bool
    telegram_bot_token_set: bool
    telegram_chat_id: Optional[str] = None
    gemini_api_key_set: bool = False
    scheduler_running: bool


class TelegramTestRequest(BaseModel):
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None
    custom_message: Optional[str] = None


# --- AI Portfolio Allocation & Capital Strategy Schemas ---
class GeminiModelInfo(BaseModel):
    id: str
    name: str
    display_name: str
    description: Optional[str] = None
    input_token_limit: Optional[int] = None
    output_token_limit: Optional[int] = None
    is_recommended: bool = False


class AssetAllocationItem(BaseModel):
    asset_class: str = Field(..., description="Nhóm tài sản: VN30 / Bluechip, Midcap / HNX30, Penny / Smallcap")
    ticker: str = Field(..., description="Mã cổ phiếu")
    company_name: Optional[str] = Field(None, description="Tên công ty niêm yết")
    capital_percentage: float = Field(..., description="Tỷ lệ phân bổ vốn % (VD: 60, 30, 10)")
    allocated_amount: float = Field(..., description="Số tiền phân bổ (VND)")
    current_price: float = Field(..., description="Giá thị trường hiện tại (VND)")
    estimated_shares: int = Field(..., description="Số lượng cổ phiếu ước tính mua được (làm tròn lô 100)")
    strategic_position: str = Field(..., description="Vị thế chiến lược: Tích sản / Đón sóng / Lướt sóng T+")
    profit_target: str = Field(..., description="Mục tiêu chốt lời kỳ vọng (% và vùng giá)")
    stop_loss: Optional[str] = Field(None, description="Ngưỡng cắt lỗ an toàn")


class DetailedPositionStrategy(BaseModel):
    ticker: str = Field(..., description="Mã cổ phiếu")
    asset_class: str = Field(..., description="Nhóm tài sản")
    percentage: float = Field(..., description="Tỷ trọng vốn %")
    title: str = Field(..., description="Tiêu đề chiến lược vị thế")
    badge_type: str = Field("SAFE", description="'SAFE', 'MEDIUM', 'HIGH_RISK'")
    position_analysis: str = Field(..., description="Phân tích chi tiết vị thế kỹ thuật & cơ bản")
    execution_strategy: str = Field(..., description="Chiến lược giải ngân chi tiết (DCA, gom hàng, chia vốn)")
    buy_zone: str = Field(..., description="Vùng giá mua gom tối ưu")
    profit_target_zone: str = Field(..., description="Vùng giá chốt lời kỳ vọng")
    stop_loss_zone: str = Field(..., description="Vùng giá cắt lỗ vi phạm")
    risk_notes: str = Field(..., description="Lưu ý quản trị rủi ro & thanh khoản")


class PortfolioAllocationResult(BaseModel):
    total_capital: float = Field(..., description="Tổng vốn đầu tư (VND)")
    risk_profile: str = Field(..., description="Khẩu vị rủi ro: CONSERVATIVE, BALANCED, AGGRESSIVE")
    summary_table: List[AssetAllocationItem] = Field(..., description="Bảng tổng quan phân bổ vốn")
    detailed_strategies: List[DetailedPositionStrategy] = Field(..., description="Chi tiết chiến lược từng vị thế")
    executive_summary: str = Field(..., description="Tổng quan chiến lược danh mục & tỷ lệ phân bổ")
    market_cycle_assessment: str = Field(..., description="Đánh giá bối cảnh thị trường & xu hướng dòng tiền")
    risk_management_rules: List[str] = Field(default=[], description="Quy tắc quản trị vốn & kỷ luật giao dịch")
    estimated_portfolio_yield: Optional[str] = Field(None, description="Kỳ vọng lợi nhuận danh mục trung hạn")


class PortfolioAllocationRequest(BaseModel):
    model_config = {"protected_namespaces": ()}

    total_capital: float = Field(..., gt=0, description="Tổng số vốn đầu tư dự kiến (VND)")
    vn30_tickers: Optional[List[str]] = Field(default=[], description="Danh sách các mã Bluechip / VN30")
    midcap_tickers: Optional[List[str]] = Field(default=[], description="Danh sách các mã Midcap / HNX30")
    penny_tickers: Optional[List[str]] = Field(default=[], description="Danh sách các mã Penny / Smallcap")
    # Fallback cho single string nếu client gửi phiên bản cũ
    vn30_ticker: Optional[str] = None
    midcap_ticker: Optional[str] = None
    penny_ticker: Optional[str] = None
    ai_provider: Optional[str] = Field("gemini", description="Nhà cung cấp: gemini | openai | local")
    custom_api_key: Optional[str] = Field(None, description="API Key tùy chọn")
    custom_base_url: Optional[str] = Field(None, description="Base URL cho Local AI (mặc định http://localhost:11434/v1)")
    model_name: Optional[str] = Field(None, description="Tên model AI lựa chọn")
    risk_profile: Optional[str] = Field("BALANCED", description="Khẩu vị rủi ro: CONSERVATIVE, BALANCED, AGGRESSIVE")
    custom_weights: Optional[dict] = Field(None, description="Tùy chỉnh tỷ lệ: {'vn30': 60, 'midcap': 30, 'penny': 10}")

    def get_vn30_list(self) -> List[str]:
        res = [t.strip().upper() for t in self.vn30_tickers if t and t.strip()]
        if not res and self.vn30_ticker:
            res = [self.vn30_ticker.strip().upper()]
        return res

    def get_midcap_list(self) -> List[str]:
        res = [t.strip().upper() for t in self.midcap_tickers if t and t.strip()]
        if not res and self.midcap_ticker:
            res = [self.midcap_ticker.strip().upper()]
        return res

    def get_penny_list(self) -> List[str]:
        res = [t.strip().upper() for t in self.penny_tickers if t and t.strip()]
        if not res and self.penny_ticker:
            res = [self.penny_ticker.strip().upper()]
        return res


class PortfolioAllocationOut(BaseModel):
    id: Optional[int] = None
    user_id: Optional[int] = None
    total_capital: float
    data: PortfolioAllocationResult
    created_at: datetime


class ApplyAllocationPositionItem(BaseModel):
    ticker: str
    company_name: Optional[str] = None
    buy_price: float = Field(..., description="Giá mua (x1,000 VND)")
    quantity: int = Field(..., description="Số lượng cổ phiếu")
    tp_pct: float = Field(default=7.0, ge=0.0)
    sl_pct: float = Field(default=5.0, ge=0.0)


class ApplyAllocationRequest(BaseModel):
    positions: List[ApplyAllocationPositionItem] = Field(..., min_length=1)



# --- Alert Log Schemas ---
class AlertLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    ticker: str
    alert_type: str
    triggered_price: float
    pnl_pct: float
    sent_at: datetime

    class Config:
        from_attributes = True


# --- Market Trading Hours Status ---
class MarketStatusOut(BaseModel):
    is_open: bool
    session_name: str
    session_code: str  # 'MORNING_SESSION', 'LUNCH_BREAK', 'AFTERNOON_SESSION', 'CLOSED', 'WEEKEND'
    description: str
    current_vn_time: str


# --- Screener Schemas ---
class ScreenerSignalOut(BaseModel):
    ticker: str
    name: Optional[str] = None
    exchange: Optional[str] = None
    price: float
    change_pct: float
    volume: int
    sma20_volume: float
    volume_spike_ratio: float
    rsi_14: Optional[float] = None
    ma_20: Optional[float] = None
    signal_type: str  # 'VOLUME_BREAKOUT', 'RSI_OVERSOLD_REBOUND', 'MA20_BREAKOUT', 'GOLDEN_CROSS'
    signal_strength: str  # 'STRONG', 'MEDIUM'
    reason: str
    timestamp: datetime


# --- Dashboard Summary ---
class DashboardSummary(BaseModel):
    total_positions: int
    active_positions: int
    total_investment: float
    current_portfolio_value: float
    total_pnl_value: float
    total_pnl_pct: float
    top_gainer: Optional[PortfolioPositionOut] = None
    top_loser: Optional[PortfolioPositionOut] = None
    bot_status: str
    polling_interval_sec: int
    trade_hours_only: bool = True
    market_status: Optional[MarketStatusOut] = None
    last_scan_time: Optional[datetime] = None
    recent_alerts: List[AlertLogOut] = []
