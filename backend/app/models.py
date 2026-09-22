from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    BigInteger,
    Numeric,
    Boolean,
    DateTime,
    Index,
    ForeignKey,
    UniqueConstraint,
    desc,
    JSON,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    """Bảng người dùng hệ thống phục vụ xác thực JWT và phân quyền danh mục."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    telegram_chat_id = Column(String(100), nullable=True, comment="Telegram Chat ID riêng của từng người dùng")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    positions = relationship("PortfolioPosition", back_populates="user", cascade="all, delete-orphan")
    alerts = relationship("AlertLog", back_populates="user", cascade="all, delete-orphan")
    allocations = relationship("PortfolioAllocation", back_populates="user", cascade="all, delete-orphan")
    ai_setting = relationship("UserAISetting", back_populates="user", uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User id={self.id} username={self.username} email={self.email}>"


class PortfolioPosition(Base):
    """Bảng lưu trữ danh mục cổ phiếu cần theo dõi và ngưỡng TP/SL của từng người dùng."""
    __tablename__ = "portfolio_positions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    ticker = Column(String(10), nullable=False, index=True)
    company_name = Column(String(255), nullable=True, comment="Tên công ty niêm yết")
    buy_price = Column(Numeric(10, 2), nullable=False, comment="Giá vốn (x1,000 VND)")
    quantity = Column(Integer, nullable=False, default=100, comment="Số lượng cổ phiếu")
    tp_pct = Column(Numeric(5, 2), nullable=False, default=7.00, comment="Ngưỡng chốt lời %")
    sl_pct = Column(Numeric(5, 2), nullable=False, default=5.00, comment="Ngưỡng cắt lỗ %")
    is_active = Column(Boolean, nullable=False, default=True, index=True, comment="Trạng thái theo dõi")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("user_id", "ticker", name="uq_user_ticker"),
    )

    user = relationship("User", back_populates="positions")

    def __repr__(self):
        return f"<PortfolioPosition user={self.user_id} {self.ticker} ({self.company_name}): Buy={self.buy_price} Qty={self.quantity} TP={self.tp_pct}% SL={self.sl_pct}%>"


class PriceHistory(Base):
    """Bảng lưu trữ toàn bộ lịch sử biến động giá qua mỗi chu kỳ quét."""
    __tablename__ = "price_histories"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    ticker = Column(String(10), nullable=False, index=True)
    price = Column(Numeric(10, 2), nullable=False, comment="Giá khớp lệnh (x1,000 VND)")
    volume = Column(BigInteger, nullable=False, default=0, comment="Khối lượng giao dịch")
    change_pct = Column(Numeric(5, 2), nullable=False, default=0.00, comment="% Biến động so với tham chiếu")
    timestamp = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        # Composite Index hỗn hợp bắt buộc: tối ưu truy vấn đồ thị chuỗi thời gian & lấy giá mới nhất
        Index("ix_price_histories_ticker_timestamp_desc", ticker, desc("timestamp")),
    )

    def __repr__(self):
        return f"<PriceHistory {self.ticker}: Price={self.price} Vol={self.volume} Time={self.timestamp}>"


class SystemSetting(Base):
    """Bảng lưu trữ cấu hình hệ thống (polling interval, alert cooldown, bot status...)."""
    __tablename__ = "system_settings"

    key = Column(String(50), primary_key=True)
    value = Column(String(255), nullable=False)

    def __repr__(self):
        return f"<SystemSetting {self.key}={self.value}>"


class AlertLog(Base):
    """Bảng ghi nhận nhật ký các cảnh báo đã gửi để kiểm soát cooldown chống spam."""
    __tablename__ = "alert_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    ticker = Column(String(10), nullable=False, index=True)
    alert_type = Column(
        String(20),
        nullable=False,
        comment="'TAKE_PROFIT', 'STOP_LOSS', 'PRICE_SPIKE', 'BUY_SIGNAL'",
    )
    triggered_price = Column(Numeric(10, 2), nullable=False)
    pnl_pct = Column(Numeric(5, 2), nullable=False)
    sent_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    user = relationship("User", back_populates="alerts")

    def __repr__(self):
        return f"<AlertLog user={self.user_id} {self.ticker} [{self.alert_type}] Price={self.triggered_price} PnL={self.pnl_pct}% Time={self.sent_at}>"


class PortfolioAllocation(Base):
    """Bảng lưu trữ lịch sử các kế hoạch phân bổ vốn và chiến lược danh mục AI (Gemini Robo-Advisor)."""
    __tablename__ = "portfolio_allocations"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    total_capital = Column(Numeric(15, 2), nullable=False, comment="Tổng số vốn đầu tư dự kiến (VND)")
    allocation_json = Column(JSON, nullable=False, comment="Dữ liệu phân bổ & chiến lược chi tiết định dạng JSON từ Gemini")
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    user = relationship("User", back_populates="allocations")

    def __repr__(self):
        return f"<PortfolioAllocation id={self.id} user={self.user_id} capital={self.total_capital} time={self.created_at}>"


class UserAISetting(Base):
    """Bảng lưu trữ cấu hình AI riêng biệt của từng người dùng (Gemini, OpenAI, Local AI)."""
    __tablename__ = "user_ai_settings"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    ai_provider = Column(String(50), nullable=False, default="gemini", comment="'gemini' | 'openai' | 'local'")
    gemini_api_key = Column(String(255), nullable=True)
    openai_api_key = Column(String(255), nullable=True)
    local_ai_base_url = Column(String(255), nullable=True, default=None)
    local_ai_api_key = Column(String(255), nullable=True)
    selected_model = Column(String(100), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship("User", back_populates="ai_setting")

    def __repr__(self):
        return f"<UserAISetting user_id={self.user_id} provider={self.ai_provider} model={self.selected_model}>"


