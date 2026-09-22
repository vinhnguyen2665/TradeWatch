import logging
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AlertLog, SystemSetting

logger = logging.getLogger(__name__)


class TelegramNotifier:
    """
    Module gửi cảnh báo Telegram tự động với cơ chế chống spam (Cooldown)
    và định dạng Markdown FinTech sắc nét.
    Hỗ trợ multi-tenant: gửi cảnh báo tới Telegram Chat ID riêng của từng người dùng.
    """

    def __init__(self):
        self.api_base = "https://api.telegram.org"

    async def get_setting_value(self, db: AsyncSession, key: str, default: str = "") -> str:
        """Lấy giá trị cấu hình từ bảng system_settings."""
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        setting = result.scalars().first()
        return setting.value if setting and setting.value else default

    async def check_cooldown(
        self,
        db: AsyncSession,
        ticker: str,
        alert_type: str,
        cooldown_min: int,
        user_id: Optional[int] = None,
    ) -> bool:
        """
        Kiểm tra xem cảnh báo loại alert_type của ticker cho user_id đã được gửi trong vòng cooldown_min phút chưa.
        Trả về True nếu ĐÃ ĐƯỢC PHÉP GỬI (hết cooldown hoặc chưa từng gửi), False nếu đang trong cooldown (spam).
        """
        threshold_time = datetime.now(timezone.utc) - timedelta(minutes=cooldown_min)

        stmt = (
            select(AlertLog)
            .where(
                AlertLog.ticker == ticker,
                AlertLog.alert_type == alert_type,
                AlertLog.sent_at >= threshold_time,
            )
        )
        if user_id is not None:
            stmt = stmt.where(AlertLog.user_id == user_id)

        stmt = stmt.order_by(desc(AlertLog.sent_at)).limit(1)
        result = await db.execute(stmt)
        recent_log = result.scalars().first()

        if recent_log:
            logger.info(
                f"Cooldown active for user={user_id} {ticker} [{alert_type}]. Last sent at {recent_log.sent_at}. Skipping alert."
            )
            return False
        return True

    def format_alert_message(
        self,
        ticker: str,
        alert_type: str,
        current_price: float,
        buy_price: float,
        pnl_pct: float,
        company_name: str = "",
        extra_note: str = "",
        user_name: str = "",
    ) -> str:
        """
        Định dạng tin nhắn cảnh báo Markdown đẹp mắt và chuyên nghiệp.
        """
        now_str = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M:%S UTC")

        if alert_type == "TAKE_PROFIT":
            header = "🎯 *[TRADEWATCH] CẢNH BÁO CHỐT LỜI (TAKE PROFIT)*"
            icon = "🟢"
            action = "Khuyến nghị: *Cân nhắc chốt lời từng phần hoặc nâng Trailing Stop để bảo toàn lợi nhuận.*"
        elif alert_type == "STOP_LOSS":
            header = "⚠️ *[TRADEWATCH] CẢNH BÁO CẮT LỖ (STOP LOSS)*"
            icon = "🔴"
            action = "Khuyến nghị: *Chạm ngưỡng cắt lỗ phòng thủ. Cân nhắc hạ tỷ trọng/thoát vị thế quản trị rủi ro.*"
        elif alert_type == "PRICE_SPIKE":
            header = "🚀 *[TRADEWATCH] BIẾN ĐỘNG GIÁ ĐỘT BIẾN*"
            icon = "⚡"
            action = "Khuyến nghị: *Dòng tiền đẩy mạnh bất thường. Theo dõi sát diễn biến phiên.*"
        else:
            header = "💡 *[TRADEWATCH] TÍN HIỆU THỊ TRƯỜNG*"
            icon = "📊"
            action = "Khuyến nghị: *Theo dõi các tiêu chí kỹ thuật.*"

        pnl_sign = "+" if pnl_pct >= 0 else ""
        pnl_emoji = "📈" if pnl_pct >= 0 else "📉"
        comp_str = f"🏢 *Doanh nghiệp:* _{company_name}_\n" if company_name else ""
        user_str = f"👤 *Nhà đầu tư:* `{user_name}`\n" if user_name else ""

        msg = (
            f"{header}\n\n"
            f"{user_str}"
            f"{icon} *Mã Cổ Phiếu:* `{ticker.upper()}`\n"
            f"{comp_str}"
            f"💵 *Giá Hiện Tại:* `{current_price:,.2f}` (nghìn VNĐ)\n"
            f"🏷️ *Giá Vốn:* `{buy_price:,.2f}` (nghìn VNĐ)\n"
            f"{pnl_emoji} *Lãi / Lỗ:* `{pnl_sign}{pnl_pct:.2f}%`\n"
            f"⏱️ *Thời gian:* `{now_str}`\n\n"
            f"{action}"
        )
        if extra_note:
            msg += f"\n\n📝 *Ghi chú:* {extra_note}"

        return msg

    async def send_alert(
        self,
        db: AsyncSession,
        ticker: str,
        alert_type: str,
        current_price: float,
        buy_price: float,
        pnl_pct: float,
        company_name: str = "",
        extra_note: str = "",
        user_id: Optional[int] = None,
        override_chat_id: Optional[str] = None,
        user_name: str = "",
    ) -> bool:
        """
        Thực thi kiểm tra cooldown, gửi tin nhắn tới Telegram và ghi nhận vào alert_logs cho user.
        """
        # 1. Đọc cấu hình bot token và chat id
        bot_token = await self.get_setting_value(db, "telegram_bot_token")
        target_chat_id = override_chat_id or await self.get_setting_value(db, "telegram_chat_id")
        cooldown_val = await self.get_setting_value(db, "alert_cooldown_min", "15")

        try:
            cooldown_min = int(cooldown_val)
        except ValueError:
            cooldown_min = 15

        if not bot_token or not target_chat_id:
            logger.warning(f"Telegram Bot Token or Chat ID is not configured for user={user_id}. Skipping alert.")
            return False

        # 2. Kiểm tra Cooldown chống spam
        is_allowed = await self.check_cooldown(db, ticker, alert_type, cooldown_min, user_id=user_id)
        if not is_allowed:
            return False

        # 3. Định dạng và gửi tin nhắn
        message = self.format_alert_message(
            ticker=ticker,
            alert_type=alert_type,
            current_price=current_price,
            buy_price=buy_price,
            pnl_pct=pnl_pct,
            company_name=company_name,
            extra_note=extra_note,
            user_name=user_name,
        )

        success = await self._send_raw_message(bot_token, target_chat_id, message)

        # 4. Ghi log nếu gửi thành công
        if success:
            log_entry = AlertLog(
                user_id=user_id,
                ticker=ticker.upper(),
                alert_type=alert_type,
                triggered_price=current_price,
                pnl_pct=pnl_pct,
                sent_at=datetime.now(timezone.utc),
            )
            db.add(log_entry)
            await db.commit()
            logger.info(f"Telegram alert sent and logged for user={user_id} {ticker} [{alert_type}]")
            return True

        return False

    async def _send_raw_message(self, bot_token: str, chat_id: str, text: str) -> bool:
        """Gửi HTTP POST không block tới Telegram Bot API."""
        url = f"{self.api_base}/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown",
            "disable_web_page_preview": True,
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    return True
                else:
                    logger.error(f"Telegram API error {resp.status_code}: {resp.text}")
                    return False
        except Exception as e:
            logger.error(f"Exception when sending Telegram message: {e}")
            return False

    async def send_test_message(
        self,
        bot_token: str,
        chat_id: str,
        custom_text: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Gửi tin nhắn thử nghiệm để kiểm tra cấu hình bot."""
        if not bot_token or not chat_id:
            return {"success": False, "message": "Bot Token hoặc Chat ID không được để trống"}

        text = custom_text or (
            "🔔 *[TRADEWATCH] TEST NOTIFICATION*\n\n"
            "✅ Kết nối Telegram Bot thành công!\n"
            "Hệ thống giám sát chứng khoán TradeWatch đã sẵn sàng gửi cảnh báo chốt lời/cắt lỗ cho bạn."
        )

        success = await self._send_raw_message(bot_token, chat_id, text)
        if success:
            return {"success": True, "message": "Gửi tin nhắn kiểm tra thành công"}
        else:
            return {"success": False, "message": "Gửi tin nhắn thất bại, vui lòng kiểm tra lại Token và Chat ID"}


telegram_notifier = TelegramNotifier()
