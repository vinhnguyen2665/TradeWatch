import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import SystemSetting, User
from app.auth import get_current_admin_user, get_current_user
from app.schemas import (
    SystemSettingsOut,
    SystemSettingsUpdate,
    TelegramTestRequest,
)
from app.scheduler import scheduler_service
from app.telegram_bot import telegram_notifier

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/settings", tags=["System Settings"])

DEFAULT_SETTINGS = {
    "polling_interval_sec": "30",
    "bot_status": "RUNNING",
    "alert_cooldown_min": "15",
    "telegram_bot_token": "",
    "telegram_chat_id": "",
}


async def _get_or_create_setting(db: AsyncSession, key: str, default: str) -> str:
    stmt = select(SystemSetting).where(SystemSetting.key == key)
    res = await db.execute(stmt)
    item = res.scalars().first()
    if not item:
        item = SystemSetting(key=key, value=default)
        db.add(item)
        await db.commit()
        await db.refresh(item)
    return item.value


@router.get("", response_model=SystemSettingsOut)
async def get_settings(
    current_admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy toàn bộ thông số cấu hình hệ thống hiện tại (Dành riêng cho Quản Trị Viên)."""
    interval_val = await _get_or_create_setting(db, "polling_interval_sec", "30")
    bot_status_val = await _get_or_create_setting(db, "bot_status", "RUNNING")
    cooldown_val = await _get_or_create_setting(db, "alert_cooldown_min", "15")
    trade_hours_val = await _get_or_create_setting(db, "trade_hours_only", "true")
    token_val = await _get_or_create_setting(db, "telegram_bot_token", "")
    chat_id_val = await _get_or_create_setting(db, "telegram_chat_id", "")
    gemini_key_val = await _get_or_create_setting(db, "GEMINI_API_KEY", "")

    return SystemSettingsOut(
        polling_interval_sec=int(interval_val) if interval_val.isdigit() else 30,
        bot_status=bot_status_val,
        alert_cooldown_min=int(cooldown_val) if cooldown_val.isdigit() else 15,
        trade_hours_only=trade_hours_val.strip().lower() in ("true", "1", "yes"),
        telegram_bot_token_set=bool(token_val.strip()),
        telegram_chat_id=chat_id_val,
        gemini_api_key_set=bool(gemini_key_val.strip()),
        scheduler_running=scheduler_service.is_running,
    )


@router.post("", response_model=SystemSettingsOut)
async def update_settings(
    payload: SystemSettingsUpdate,
    current_admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Cập nhật cấu hình hệ thống.
    Đặc biệt: Tự động hot-reload APScheduler khi polling_interval_sec thay đổi.
    """
    if payload.polling_interval_sec is not None:
        stmt = select(SystemSetting).where(SystemSetting.key == "polling_interval_sec")
        res = await db.execute(stmt)
        item = res.scalars().first()
        if item:
            item.value = str(payload.polling_interval_sec)
        else:
            db.add(SystemSetting(key="polling_interval_sec", value=str(payload.polling_interval_sec)))
        
        # Hot-reload Scheduler ngay lập tức không cần restart
        scheduler_service.reschedule(payload.polling_interval_sec)

    if payload.bot_status is not None:
        stmt = select(SystemSetting).where(SystemSetting.key == "bot_status")
        res = await db.execute(stmt)
        item = res.scalars().first()
        if item:
            item.value = payload.bot_status.upper()
        else:
            db.add(SystemSetting(key="bot_status", value=payload.bot_status.upper()))

    if payload.alert_cooldown_min is not None:
        stmt = select(SystemSetting).where(SystemSetting.key == "alert_cooldown_min")
        res = await db.execute(stmt)
        item = res.scalars().first()
        if item:
            item.value = str(payload.alert_cooldown_min)
        else:
            db.add(SystemSetting(key="alert_cooldown_min", value=str(payload.alert_cooldown_min)))

    if payload.trade_hours_only is not None:
        stmt = select(SystemSetting).where(SystemSetting.key == "trade_hours_only")
        res = await db.execute(stmt)
        item = res.scalars().first()
        val_str = "true" if payload.trade_hours_only else "false"
        if item:
            item.value = val_str
        else:
            db.add(SystemSetting(key="trade_hours_only", value=val_str))

    if payload.telegram_bot_token is not None:
        stmt = select(SystemSetting).where(SystemSetting.key == "telegram_bot_token")
        res = await db.execute(stmt)
        item = res.scalars().first()
        if item:
            item.value = payload.telegram_bot_token.strip()
        else:
            db.add(SystemSetting(key="telegram_bot_token", value=payload.telegram_bot_token.strip()))

    if payload.telegram_chat_id is not None:
        stmt = select(SystemSetting).where(SystemSetting.key == "telegram_chat_id")
        res = await db.execute(stmt)
        item = res.scalars().first()
        if item:
            item.value = payload.telegram_chat_id.strip()
        else:
            db.add(SystemSetting(key="telegram_chat_id", value=payload.telegram_chat_id.strip()))

    if payload.gemini_api_key is not None:
        stmt = select(SystemSetting).where(SystemSetting.key == "GEMINI_API_KEY")
        res = await db.execute(stmt)
        item = res.scalars().first()
        if item:
            item.value = payload.gemini_api_key.strip()
        else:
            db.add(SystemSetting(key="GEMINI_API_KEY", value=payload.gemini_api_key.strip()))

    await db.commit()

    # Trả về cấu hình mới
    return await get_settings(current_admin=current_admin, db=db)


@router.post("/test-telegram")
async def test_telegram_connection(
    payload: TelegramTestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Gửi tin nhắn thử nghiệm tới Telegram để kiểm tra Token và Chat ID."""
    token = payload.bot_token
    chat_id = payload.chat_id

    # Nếu không gửi kèm trong body, lấy bot token của hệ thống từ Database
    if not token:
        stmt = select(SystemSetting.value).where(SystemSetting.key == "telegram_bot_token")
        res = await db.execute(stmt)
        token = res.scalars().first()

    # Nếu không gửi kèm chat_id, lấy từ profile của user hiện tại hoặc chat_id admin
    if not chat_id:
        chat_id = current_user.telegram_chat_id
        if not chat_id and current_user.role == "admin":
            stmt = select(SystemSetting.value).where(SystemSetting.key == "telegram_chat_id")
            res = await db.execute(stmt)
            chat_id = res.scalars().first()

    if not token or not chat_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng cung cấp Telegram Chat ID để nhận tin thử nghiệm (hoặc liên hệ Quản trị viên cấu hình Telegram Bot Token hệ thống).",
        )

    result = await telegram_notifier.send_test_message(
        bot_token=token,
        chat_id=chat_id,
        custom_text=payload.custom_message,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["message"],
        )

    return result
