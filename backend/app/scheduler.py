import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import PortfolioPosition, PriceHistory, SystemSetting
from app.crawler import stock_crawler
from app.telegram_bot import telegram_notifier

logger = logging.getLogger(__name__)

JOB_ID_STOCK_POLLING = "stock_portfolio_scanner"


def get_vietnam_market_status() -> Dict[str, Any]:
    """
    Kiểm tra trạng thái khung giờ giao dịch chứng khoán Việt Nam (HOSE, HNX, UPCoM)
    theo múi giờ chuẩn UTC+7 (Asia/Ho_Chi_Minh):
    - Thứ 2 đến Thứ 6
    - Phiên sáng: 09:00 - 11:30
    - Nghỉ trưa:  11:30 - 13:00
    - Phiên chiều: 13:00 - 15:00
    """
    vn_now = datetime.now(timezone.utc) + timedelta(hours=7)
    weekday = vn_now.weekday()  # 0 = Monday, 6 = Sunday
    current_time_str = vn_now.strftime("%H:%M:%S")
    now_minutes = vn_now.hour * 60 + vn_now.minute

    # 1. Kiểm tra cuối tuần (Thứ 7 & Chủ Nhật)
    if weekday >= 5:
        return {
            "is_open": False,
            "session_name": "Cuối tuần (Nghỉ giao dịch)",
            "session_code": "WEEKEND",
            "description": "Thị trường chứng khoán nghỉ giao dịch vào Thứ 7 và Chủ Nhật.",
            "current_vn_time": current_time_str,
        }

    # 2. Các mốc thời gian trong ngày (tính theo phút từ 00:00)
    m_09_00 = 9 * 60
    m_11_30 = 11 * 60 + 30
    m_13_00 = 13 * 60
    m_15_00 = 15 * 60

    if now_minutes < m_09_00:
        return {
            "is_open": False,
            "session_name": "Trước giờ mở cửa",
            "session_code": "PRE_MARKET",
            "description": "Phiên sáng sẽ bắt đầu mở cửa từ 09:00.",
            "current_vn_time": current_time_str,
        }
    elif m_09_00 <= now_minutes <= m_11_30:
        return {
            "is_open": True,
            "session_name": "Phiên Sáng (09:00 - 11:30)",
            "session_code": "MORNING_SESSION",
            "description": "Thị trường đang mở cửa giao dịch phiên sáng (ATO / Khớp lệnh liên tục).",
            "current_vn_time": current_time_str,
        }
    elif m_11_30 < now_minutes < m_13_00:
        return {
            "is_open": False,
            "session_name": "Nghỉ trưa (11:30 - 13:00)",
            "session_code": "LUNCH_BREAK",
            "description": "Thị trường tạm nghỉ trưa. Phiên chiều sẽ tiếp tục lúc 13:00.",
            "current_vn_time": current_time_str,
        }
    elif m_13_00 <= now_minutes <= m_15_00:
        return {
            "is_open": True,
            "session_name": "Phiên Chiều (13:00 - 15:00)",
            "session_code": "AFTERNOON_SESSION",
            "description": "Thị trường đang mở cửa giao dịch phiên chiều (Khớp lệnh liên tục / ATC / PLO).",
            "current_vn_time": current_time_str,
        }
    else:
        return {
            "is_open": False,
            "session_name": "Đóng cửa phiên (Sau 15:00)",
            "session_code": "CLOSED",
            "description": "Thị trường đã kết thúc ngày giao dịch lúc 15:00.",
            "current_vn_time": current_time_str,
        }


class StockSchedulerService:
    """
    Dịch vụ quản lý APScheduler cho tác vụ quét danh mục định kỳ và hot-reload thời gian polling.
    Hỗ trợ cơ chế kiểm tra giờ giao dịch tự động.
    """

    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.last_run_time: datetime = None
        self.is_running: bool = False

    async def scan_portfolio_job(self):
        """
        Job chạy ngầm theo chu kỳ:
        1. Kiểm tra trạng thái bot_status ('RUNNING' hay 'PAUSED').
        2. Kiểm tra cấu hình trade_hours_only (nếu bật, chỉ quét trong giờ giao dịch 09:00-11:30 & 13:00-15:00 T2-T6).
        3. Lấy danh sách cổ phiếu active trong bảng portfolio_positions.
        4. Thu thập giá realtime qua Async HTTP Crawler (không dùng Browser).
        5. Lưu bản ghi vào price_histories.
        6. So sánh PnL với ngưỡng TP/SL và kích hoạt Telegram Alert khi thỏa mãn.
        """
        self.last_run_time = datetime.now(timezone.utc)

        async with AsyncSessionLocal() as db:
            try:
                # 1. Kiểm tra Bot Status
                status_res = await db.execute(
                    select(SystemSetting.value).where(SystemSetting.key == "bot_status")
                )
                bot_status = status_res.scalars().first() or "RUNNING"
                if bot_status.upper() == "PAUSED":
                    logger.info("[Scheduler] Bot đang ở trạng thái PAUSED. Bỏ qua chu kỳ quét.")
                    return

                # 2. Kiểm tra Cấu hình Quét theo Giờ Giao Dịch
                trade_hours_res = await db.execute(
                    select(SystemSetting.value).where(SystemSetting.key == "trade_hours_only")
                )
                trade_hours_val = trade_hours_res.scalars().first() or "true"
                trade_hours_only = trade_hours_val.strip().lower() in ("true", "1", "yes")

                market_status = get_vietnam_market_status()

                if trade_hours_only and not market_status["is_open"]:
                    logger.info(
                        f"[Scheduler] Ngoài giờ giao dịch ({market_status['session_name']}). "
                        f"Tạm nghỉ quét danh mục theo cấu hình Trade Hours Only."
                    )
                    return

                logger.info(f"--- [Scheduler] Bắt đầu chu kỳ quét danh mục ({market_status['session_name']}) ---")

                # 3. Lấy các vị thế active
                stmt = select(PortfolioPosition).where(PortfolioPosition.is_active == True)
                res = await db.execute(stmt)
                positions = res.scalars().all()

                if not positions:
                    logger.info("[Scheduler] Không có mã cổ phiếu active nào trong danh mục.")
                    return

                tickers = [p.ticker for p in positions]
                logger.info(f"[Scheduler] Đang quét {len(tickers)} mã: {tickers}")

                # 4. Thu thập giá thời gian thực
                quotes = await stock_crawler.fetch_realtime_quotes(tickers)

                # 5. Ghi nhận lịch sử giá và kiểm tra TP/SL
                new_histories = []
                for pos in positions:
                    quote = quotes.get(pos.ticker)
                    if not quote:
                        continue

                    current_price = float(quote["price"])
                    volume = int(quote["volume"])
                    change_pct = float(quote["change_pct"])
                    buy_price = float(pos.buy_price)
                    tp_pct = float(pos.tp_pct)
                    sl_pct = float(pos.sl_pct)

                    # Thêm vào bulk price_histories
                    new_histories.append(
                        PriceHistory(
                            ticker=pos.ticker,
                            price=current_price,
                            volume=volume,
                            change_pct=change_pct,
                            timestamp=datetime.now(timezone.utc),
                        )
                    )

                    # Tính toán PnL %
                    pnl_pct = ((current_price - buy_price) / buy_price) * 100.0

                    # 6. Kích hoạt Cảnh báo TP / SL
                    if pnl_pct >= tp_pct:
                        logger.info(f"🎯 [TP TRIGGER] {pos.ticker}: PnL +{pnl_pct:.2f}% >= TP +{tp_pct:.2f}%")
                        await telegram_notifier.send_alert(
                            db=db,
                            ticker=pos.ticker,
                            alert_type="TAKE_PROFIT",
                            current_price=current_price,
                            buy_price=buy_price,
                            pnl_pct=round(pnl_pct, 2),
                            company_name=pos.company_name or "",
                            extra_note=f"Đạt mục tiêu chốt lời (+{tp_pct}%).",
                        )
                    elif pnl_pct <= -sl_pct:
                        logger.info(f"⚠️ [SL TRIGGER] {pos.ticker}: PnL {pnl_pct:.2f}% <= SL -{sl_pct:.2f}%")
                        await telegram_notifier.send_alert(
                            db=db,
                            ticker=pos.ticker,
                            alert_type="STOP_LOSS",
                            current_price=current_price,
                            buy_price=buy_price,
                            pnl_pct=round(pnl_pct, 2),
                            company_name=pos.company_name or "",
                            extra_note=f"Chạm ngưỡng cắt lỗ phòng hộ (-{sl_pct}%).",
                        )

                # Lưu toàn bộ price history trong chu kỳ
                if new_histories:
                    db.add_all(new_histories)
                    await db.commit()
                    logger.info(f"[Scheduler] Đã lưu {len(new_histories)} bản ghi giá mới vào price_histories.")

            except Exception as e:
                logger.error(f"[Scheduler] Lỗi trong quá trình chạy chu kỳ quét: {e}", exc_info=True)
                await db.rollback()

    async def start(self, default_interval_sec: int = 30):
        """Khởi động scheduler và nạp polling interval từ DB."""
        if self.is_running:
            return

        interval_sec = default_interval_sec
        async with AsyncSessionLocal() as db:
            res = await db.execute(
                select(SystemSetting.value).where(SystemSetting.key == "polling_interval_sec")
            )
            val = res.scalars().first()
            if val:
                try:
                    interval_sec = int(val)
                except ValueError:
                    pass

        self.scheduler.add_job(
            self.scan_portfolio_job,
            trigger=IntervalTrigger(seconds=interval_sec),
            id=JOB_ID_STOCK_POLLING,
            name="Stock Portfolio Polling Worker",
            replace_existing=True,
        )
        self.scheduler.start()
        self.is_running = True
        logger.info(f"🚀 [Scheduler] Đã khởi động nền với chu kỳ quét {interval_sec} giây/lần.")

    def reschedule(self, new_interval_sec: int):
        """
        Hot-reload chu kỳ quét ngay lập tức bằng scheduler.reschedule_job
        mà không cần khởi động lại server.
        """
        if not self.scheduler.get_job(JOB_ID_STOCK_POLLING):
            self.scheduler.add_job(
                self.scan_portfolio_job,
                trigger=IntervalTrigger(seconds=new_interval_sec),
                id=JOB_ID_STOCK_POLLING,
                name="Stock Portfolio Polling Worker",
                replace_existing=True,
            )
        else:
            self.scheduler.reschedule_job(
                JOB_ID_STOCK_POLLING,
                trigger=IntervalTrigger(seconds=new_interval_sec),
            )
        logger.info(f"🔄 [Scheduler] Đã áp dụng chu kỳ quét mới: {new_interval_sec} giây/lần (Hot-reload thành công).")

    async def shutdown(self):
        """Dừng scheduler một cách an toàn."""
        if self.is_running:
            self.scheduler.shutdown(wait=False)
            self.is_running = False
            logger.info("🛑 [Scheduler] Đã dừng tiến trình quét ngầm.")


# Singleton instance
scheduler_service = StockSchedulerService()
