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
    desc,
)
from sqlalchemy.sql import func
from app.database import Base


class PortfolioPosition(Base):
    """Bảng lưu trữ danh mục cổ phiếu cần theo dõi và ngưỡng TP/SL."""
    __tablename__ = "portfolio_positions"

    ticker = Column(String(10), primary_key=True, index=True)
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

    def __repr__(self):
        return f"<PortfolioPosition {self.ticker} ({self.company_name}): Buy={self.buy_price} Qty={self.quantity} TP={self.tp_pct}% SL={self.sl_pct}%>"


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

    def __repr__(self):
        return f"<AlertLog {self.ticker} [{self.alert_type}] Price={self.triggered_price} PnL={self.pnl_pct}% Time={self.sent_at}>"
