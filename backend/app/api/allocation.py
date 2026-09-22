import logging
import os
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import PortfolioAllocation, PortfolioPosition, SystemSetting, User, PriceHistory, UserAISetting
from app.schemas import (
    PortfolioAllocationRequest,
    PortfolioAllocationOut,
    PortfolioAllocationResult,
    ApplyAllocationRequest,
    PortfolioPositionOut,
    GeminiModelInfo,
)
from app.auth import get_current_user, get_optional_current_user
from app.crawler import stock_crawler
from app.services.gemini_service import gemini_advisor_service
from app.services.openai_service import openai_advisor_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/allocation", tags=["AI Portfolio Allocation"])


async def _resolve_provider_credentials(
    db: AsyncSession,
    current_user: Optional[User],
    provider: str,
    custom_api_key: Optional[str] = None,
    custom_base_url: Optional[str] = None,
) -> tuple[str, str]:
    """
    Xác định API Key và Base URL cho từng provider:
    - KHÔNG fallback về key hệ thống!
    - Ưu tiên: Custom Key/URL gửi trực tiếp > Cấu hình riêng của User trong user_ai_settings.
    """
    api_key = (custom_api_key or "").strip()
    base_url = (custom_base_url or "").strip()

    user_setting = None
    if current_user:
        stmt = select(UserAISetting).where(UserAISetting.user_id == current_user.id)
        res = await db.execute(stmt)
        user_setting = res.scalars().first()

    provider_clean = (provider or "gemini").lower()

    if provider_clean == "gemini":
        if (not api_key or api_key.startswith("****")) and user_setting and user_setting.gemini_api_key:
            api_key = user_setting.gemini_api_key.strip()
        return api_key, "https://generativelanguage.googleapis.com/v1beta/models"

    elif provider_clean == "openai":
        if (not api_key or api_key.startswith("****")) and user_setting and user_setting.openai_api_key:
            api_key = user_setting.openai_api_key.strip()
        base_url = "https://api.openai.com/v1"
        return api_key, base_url

    elif provider_clean == "local":
        if not base_url:
            base_url = user_setting.local_ai_base_url.strip() if (user_setting and user_setting.local_ai_base_url) else ""
        if (not api_key or api_key.startswith("****")) and user_setting and user_setting.local_ai_api_key:
            api_key = user_setting.local_ai_api_key.strip()
        return api_key, base_url

    return api_key, base_url


@router.get("/models", response_model=List[GeminiModelInfo])
async def get_available_ai_models(
    provider: str = "gemini",
    base_url: Optional[str] = None,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Đồng bộ và trả về danh sách mô hình AI khả dụng trực tiếp từ Provider đã chọn
    (Google Gemini, OpenAI ChatGPT, hoặc Local AI Ollama/LM Studio).
    """
    api_key, resolved_base = await _resolve_provider_credentials(
        db, current_user, provider, custom_base_url=base_url
    )

    provider_clean = (provider or "gemini").lower()
    if provider_clean == "gemini":
        if not api_key:
            return []
        models = await gemini_advisor_service.list_available_models(api_key)
        return [GeminiModelInfo(**m) for m in models]
    elif provider_clean == "openai":
        if not api_key:
            return []
        models = await openai_advisor_service.list_available_models(api_key, base_url=resolved_base)
        return [GeminiModelInfo(**m) for m in models]
    else:
        # Local AI (Ollama / LM Studio)
        if not resolved_base:
            return []
        models = await openai_advisor_service.list_available_models(api_key, base_url=resolved_base)
        return [GeminiModelInfo(**m) for m in models]


@router.post("/generate", response_model=PortfolioAllocationOut)
async def generate_allocation(
    payload: PortfolioAllocationRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Sinh chiến lược phân bổ danh mục và hoạch định vốn AI dựa trên 3 nhóm cổ phiếu (VN30, Midcap, Penny).
    Hỗ trợ đa nhà cung cấp: Google Gemini, OpenAI (ChatGPT) hoặc Local AI (Ollama, LM Studio).
    """
    if payload.total_capital <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tổng vốn đầu tư dự kiến phải lớn hơn 0 VND",
        )

    provider = (payload.ai_provider or "gemini").lower()

    # 1. Giải quyết API Key & Base URL riêng biệt cho User (KHÔNG fallback về hệ thống)
    api_key, base_url = await _resolve_provider_credentials(
        db, current_user, provider, payload.custom_api_key, payload.custom_base_url
    )

    if provider in ("gemini", "openai") and not api_key:
        prov_name = "Google Gemini" if provider == "gemini" else "OpenAI (ChatGPT)"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tài khoản của bạn chưa cấu hình API Key cho {prov_name}. Vui lòng mở Cài đặt AI và nhập API Key của bạn.",
        )

    if provider == "local" and not base_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản của bạn chưa cấu hình Endpoint Base URL cho Local AI. Vui lòng mở Cài đặt AI và nhập địa chỉ máy chủ (VD: http://localhost:11434/v1).",
        )

    # 2. Lấy danh sách mã của 3 nhóm
    vn30_list = payload.get_vn30_list()
    midcap_list = payload.get_midcap_list()
    penny_list = payload.get_penny_list()

    all_tickers = list(set(vn30_list + midcap_list + penny_list))
    if not all_tickers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng chọn ít nhất 1 mã cổ phiếu trong danh mục",
        )

    try:
        quotes = await stock_crawler.fetch_realtime_quotes(all_tickers)
    except Exception as e:
        logger.warning(f"Error fetching realtime quotes: {e}")
        quotes = {}

    ticker_details = {}
    for t in all_tickers:
        t_clean = t.upper()
        comp_name = await stock_crawler.get_company_name(t_clean)
        t_quote = quotes.get(t_clean, {})
        price_k = float(t_quote.get("price", 25.0))
        ticker_details[t_clean] = {
            "name": comp_name,
            "price": price_k,
            "volume": t_quote.get("volume", 0),
            "change_pct": t_quote.get("change_pct", 0.0),
        }

    # 3. Gọi AI Service tương ứng (Gemini hoặc OpenAI / Local AI)
    try:
        if provider == "gemini":
            allocation_result = await gemini_advisor_service.generate_allocation_strategy(
                api_key=api_key,
                total_capital=payload.total_capital,
                vn30_tickers=vn30_list,
                midcap_tickers=midcap_list,
                penny_tickers=penny_list,
                ticker_details=ticker_details,
                risk_profile=payload.risk_profile or "BALANCED",
                custom_weights=payload.custom_weights,
                model_name=payload.model_name,
            )
        else:
            allocation_result = await openai_advisor_service.generate_allocation_strategy(
                api_key=api_key,
                total_capital=payload.total_capital,
                vn30_tickers=vn30_list,
                midcap_tickers=midcap_list,
                penny_tickers=penny_list,
                ticker_details=ticker_details,
                risk_profile=payload.risk_profile or "BALANCED",
                custom_weights=payload.custom_weights,
                model_name=payload.model_name,
                base_url=base_url,
            )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except TimeoutError as te:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=str(te))
    except Exception as e:
        logger.error(f"Unexpected error in allocation generation: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Lỗi khi xử lý dữ liệu AI: {str(e)}")

    # 4. Lưu lịch sử vào database
    allocation_record = PortfolioAllocation(
        user_id=current_user.id if current_user else None,
        total_capital=payload.total_capital,
        allocation_json=allocation_result.model_dump(),
        created_at=datetime.now(timezone.utc),
    )
    db.add(allocation_record)
    await db.commit()
    await db.refresh(allocation_record)

    return PortfolioAllocationOut(
        id=allocation_record.id,
        user_id=allocation_record.user_id,
        total_capital=float(allocation_record.total_capital),
        data=allocation_result,
        created_at=allocation_record.created_at,
    )


def _sanitize_allocation_result(data: PortfolioAllocationResult, total_capital: float) -> PortfolioAllocationResult:
    """Tự động kiểm tra và chuẩn hóa số học: Số tiền phân bổ = total_capital * (capital_percentage / 100)."""
    if not data or not data.summary_table:
        return data
    for item in data.summary_table:
        correct_amount = round(total_capital * (item.capital_percentage / 100.0))
        item.allocated_amount = correct_amount
        if item.current_price > 0:
            item.estimated_shares = max(100, int((correct_amount / item.current_price) // 100) * 100)
    return data


@router.get("/latest", response_model=Optional[PortfolioAllocationOut])
async def get_latest_allocation(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy bản kế hoạch phân bổ vốn danh mục AI gần nhất của người dùng hoặc hệ thống."""
    query = select(PortfolioAllocation)
    if current_user:
        query = query.where(
            (PortfolioAllocation.user_id == current_user.id) | (PortfolioAllocation.user_id.is_(None))
        )
    query = query.order_by(desc(PortfolioAllocation.created_at)).limit(1)

    res = await db.execute(query)
    record = res.scalars().first()

    if not record:
        return None

    try:
        data_parsed = PortfolioAllocationResult(**record.allocation_json)
        data_sanitized = _sanitize_allocation_result(data_parsed, float(record.total_capital))
        return PortfolioAllocationOut(
            id=record.id,
            user_id=record.user_id,
            total_capital=float(record.total_capital),
            data=data_sanitized,
            created_at=record.created_at,
        )
    except Exception as e:
        logger.error(f"Error parsing saved allocation json {record.id}: {e}")
        return None


@router.get("/history", response_model=List[PortfolioAllocationOut])
async def get_allocation_history(
    limit: int = 10,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách các lần lập kế hoạch phân bổ vốn gần đây."""
    query = select(PortfolioAllocation)
    if current_user:
        query = query.where(
            (PortfolioAllocation.user_id == current_user.id) | (PortfolioAllocation.user_id.is_(None))
        )
    query = query.order_by(desc(PortfolioAllocation.created_at)).limit(limit)

    res = await db.execute(query)
    records = res.scalars().all()

    output = []
    for r in records:
        try:
            data_parsed = PortfolioAllocationResult(**r.allocation_json)
            data_sanitized = _sanitize_allocation_result(data_parsed, float(r.total_capital))
            output.append(
                PortfolioAllocationOut(
                    id=r.id,
                    user_id=r.user_id,
                    total_capital=float(r.total_capital),
                    data=data_sanitized,
                    created_at=r.created_at,
                )
            )
        except Exception as e:
            logger.debug(f"Skip invalid allocation record {r.id}: {e}")
            continue

    return output


@router.delete("/{allocation_id}")
async def delete_allocation(
    allocation_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Xóa một bản ghi lịch sử phân bổ vốn."""
    stmt = select(PortfolioAllocation).where(PortfolioAllocation.id == allocation_id)
    if current_user:
        stmt = stmt.where(
            (PortfolioAllocation.user_id == current_user.id) | (PortfolioAllocation.user_id.is_(None))
        )
    res = await db.execute(stmt)
    record = res.scalars().first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bản ghi phân bổ vốn")

    await db.delete(record)
    await db.commit()
    return {"success": True, "message": f"Đã xóa bản ghi phân bổ #{allocation_id}"}


@router.post("/apply-to-portfolio", response_model=List[PortfolioPositionOut])
async def apply_allocation_to_portfolio(
    payload: ApplyAllocationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Áp dụng nhanh kết quả phân bổ vốn vào danh mục theo dõi của người dùng.
    Thêm/cập nhật cả 3 mã vào `portfolio_positions` để Bot Telegram bắt đầu canh TP/SL tự động.
    """
    added_positions: List[PortfolioPositionOut] = []

    for item in payload.positions:
        ticker = item.ticker.strip().upper()
        if len(ticker) < 2:
            continue

        comp_name = item.company_name or await stock_crawler.get_company_name(ticker)

        # Kiểm tra xem đã có mã này chưa
        stmt = select(PortfolioPosition).where(
            PortfolioPosition.user_id == current_user.id,
            PortfolioPosition.ticker == ticker,
        )
        res = await db.execute(stmt)
        existing = res.scalars().first()

        if existing:
            existing.company_name = comp_name
            existing.buy_price = item.buy_price
            existing.quantity = item.quantity
            existing.tp_pct = item.tp_pct
            existing.sl_pct = item.sl_pct
            existing.is_active = True
            existing.updated_at = datetime.now(timezone.utc)
            pos_target = existing
        else:
            pos_target = PortfolioPosition(
                user_id=current_user.id,
                ticker=ticker,
                company_name=comp_name,
                buy_price=item.buy_price,
                quantity=item.quantity,
                tp_pct=item.tp_pct,
                sl_pct=item.sl_pct,
                is_active=True,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            db.add(pos_target)

        await db.commit()
        await db.refresh(pos_target)

        # Lấy giá realtime
        quotes = await stock_crawler.fetch_realtime_quotes([ticker])
        t_quote = quotes.get(ticker, {})
        curr_price = float(t_quote.get("price", item.buy_price))
        buy_p = float(pos_target.buy_price)

        # Thêm vào price history
        db.add(
            PriceHistory(
                ticker=ticker,
                price=curr_price,
                volume=int(t_quote.get("volume", 0)),
                change_pct=float(t_quote.get("change_pct", 0.0)),
                timestamp=datetime.now(timezone.utc),
            )
        )
        await db.commit()

        pnl_pct = round(((curr_price - buy_p) / buy_p) * 100.0, 2)
        added_positions.append(
            PortfolioPositionOut(
                id=pos_target.id,
                user_id=pos_target.user_id,
                ticker=pos_target.ticker,
                company_name=pos_target.company_name,
                buy_price=buy_p,
                quantity=pos_target.quantity,
                tp_pct=float(pos_target.tp_pct),
                sl_pct=float(pos_target.sl_pct),
                is_active=pos_target.is_active,
                created_at=pos_target.created_at,
                updated_at=pos_target.updated_at,
                current_price=curr_price,
                volume=int(t_quote.get("volume", 0)),
                change_pct=float(t_quote.get("change_pct", 0.0)),
                pnl_pct=pnl_pct,
                pnl_value=round((curr_price - buy_p) * pos_target.quantity, 2),
                market_value=round(curr_price * pos_target.quantity, 2),
                tp_price=round(buy_p * (1.0 + float(pos_target.tp_pct) / 100.0), 2),
                sl_price=round(buy_p * (1.0 - float(pos_target.sl_pct) / 100.0), 2),
                status="NORMAL",
                last_updated=datetime.now(timezone.utc),
            )
        )

    return added_positions
