import logging
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import PortfolioPosition, PriceHistory, SystemSetting, AlertLog
from app.schemas import DashboardSummary, PortfolioPositionOut, AlertLogOut
from app.scheduler import scheduler_service, get_vietnam_market_status
from app.api.positions import get_positions

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(db: AsyncSession = Depends(get_db)):
    """
    Thống kê tổng quan danh mục đầu tư:
    - Tổng số mã, mã active
    - Tổng vốn đầu tư (x1,000 VND), giá trị thị trường hiện tại, tổng Lãi/Lỗ
    - Mã tăng mạnh nhất (Top Gainer) & Mã giảm sâu nhất (Top Loser)
    - Trạng thái Bot, Trạng thái Phiên giao dịch (Market Status) & Các cảnh báo gần nhất
    """
    # Lấy danh sách positions đã tính toán đầy đủ
    positions: List[PortfolioPositionOut] = await get_positions(db)

    total_positions = len(positions)
    active_positions = sum(1 for p in positions if p.is_active)

    total_investment = sum(p.buy_price * p.quantity for p in positions)
    current_portfolio_value = sum((p.current_price or p.buy_price) * p.quantity for p in positions)
    total_pnl_value = current_portfolio_value - total_investment
    total_pnl_pct = round((total_pnl_value / total_investment) * 100.0, 2) if total_investment > 0 else 0.0

    # Top Gainer & Loser
    sorted_by_pnl = sorted(positions, key=lambda p: p.pnl_pct or 0.0, reverse=True)
    top_gainer = sorted_by_pnl[0] if sorted_by_pnl else None
    top_loser = sorted_by_pnl[-1] if sorted_by_pnl and len(sorted_by_pnl) > 1 else None

    # Bot Status & Settings
    res_status = await db.execute(select(SystemSetting.value).where(SystemSetting.key == "bot_status"))
    bot_status = res_status.scalars().first() or "RUNNING"

    res_interval = await db.execute(select(SystemSetting.value).where(SystemSetting.key == "polling_interval_sec"))
    interval_val = res_interval.scalars().first() or "30"

    res_trade_hours = await db.execute(select(SystemSetting.value).where(SystemSetting.key == "trade_hours_only"))
    trade_hours_val = res_trade_hours.scalars().first() or "true"
    trade_hours_only = trade_hours_val.strip().lower() in ("true", "1", "yes")

    market_status = get_vietnam_market_status()

    # Lấy 10 alert logs gần nhất
    alert_stmt = select(AlertLog).order_by(desc(AlertLog.sent_at)).limit(10)
    alert_res = await db.execute(alert_stmt)
    alert_logs = alert_res.scalars().all()

    return DashboardSummary(
        total_positions=total_positions,
        active_positions=active_positions,
        total_investment=round(total_investment, 2),
        current_portfolio_value=round(current_portfolio_value, 2),
        total_pnl_value=round(total_pnl_value, 2),
        total_pnl_pct=total_pnl_pct,
        top_gainer=top_gainer,
        top_loser=top_loser,
        bot_status=bot_status,
        polling_interval_sec=int(interval_val) if interval_val.isdigit() else 30,
        trade_hours_only=trade_hours_only,
        market_status=market_status,
        last_scan_time=scheduler_service.last_run_time,
        recent_alerts=[
            AlertLogOut(
                id=a.id,
                ticker=a.ticker,
                alert_type=a.alert_type,
                triggered_price=float(a.triggered_price),
                pnl_pct=float(a.pnl_pct),
                sent_at=a.sent_at,
            )
            for a in alert_logs
        ],
    )


@router.post("/toggle-bot")
async def toggle_bot_status(db: AsyncSession = Depends(get_db)):
    """Chuyển đổi trạng thái Bot giữa RUNNING và PAUSED nhanh chóng."""
    stmt = select(SystemSetting).where(SystemSetting.key == "bot_status")
    res = await db.execute(stmt)
    setting = res.scalars().first()

    if not setting:
        setting = SystemSetting(key="bot_status", value="RUNNING")
        db.add(setting)

    current_status = setting.value.upper()
    new_status = "PAUSED" if current_status == "RUNNING" else "RUNNING"
    setting.value = new_status
    await db.commit()

    return {"success": True, "bot_status": new_status, "message": f"Đã chuyển trạng thái Bot sang {new_status}"}
