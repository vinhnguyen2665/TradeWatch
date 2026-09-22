import logging
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import PortfolioPosition, PriceHistory
from app.schemas import (
    PortfolioPositionCreate,
    PortfolioPositionUpdate,
    PortfolioPositionOut,
)
from app.crawler import stock_crawler

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/positions", tags=["Portfolio Positions"])


@router.get("", response_model=List[PortfolioPositionOut])
async def get_positions(db: AsyncSession = Depends(get_db)):
    """
    Lấy toàn bộ danh mục theo dõi, kèm tên công ty, tính toán giá hiện tại mới nhất,
    % PnL, giá mục tiêu Chốt lời / Cắt lỗ tuyệt đối.
    """
    stmt = select(PortfolioPosition).order_by(PortfolioPosition.created_at.desc())
    res = await db.execute(stmt)
    positions = res.scalars().all()

    output_list: List[PortfolioPositionOut] = []
    need_commit = False

    for pos in positions:
        # Tự động điền tên công ty nếu chưa có trong DB
        comp_name = pos.company_name
        if not comp_name:
            comp_name = await stock_crawler.get_company_name(pos.ticker)
            pos.company_name = comp_name
            need_commit = True

        # Lấy giá mới nhất từ bảng price_histories tối ưu qua Composite Index (ticker, timestamp DESC)
        hist_stmt = (
            select(PriceHistory)
            .where(PriceHistory.ticker == pos.ticker)
            .order_by(desc(PriceHistory.timestamp))
            .limit(1)
        )
        hist_res = await db.execute(hist_stmt)
        latest_hist = hist_res.scalars().first()

        buy_price = float(pos.buy_price)
        qty = int(pos.quantity)
        tp_pct = float(pos.tp_pct)
        sl_pct = float(pos.sl_pct)

        # Giá tuyệt đối TP / SL
        tp_price = round(buy_price * (1.0 + tp_pct / 100.0), 2)
        sl_price = round(buy_price * (1.0 - sl_pct / 100.0), 2)

        if latest_hist:
            curr_price = float(latest_hist.price)
            volume = int(latest_hist.volume)
            change_pct = float(latest_hist.change_pct)
            last_updated = latest_hist.timestamp
        else:
            # Fallback lấy giá realtime từ crawler
            quote = await stock_crawler.fetch_realtime_quotes([pos.ticker])
            t_quote = quote.get(pos.ticker, {})
            curr_price = float(t_quote.get("price", buy_price))
            volume = int(t_quote.get("volume", 0))
            change_pct = float(t_quote.get("change_pct", 0.0))
            last_updated = datetime.now(timezone.utc)

        # Tính toán PnL
        pnl_pct = round(((curr_price - buy_price) / buy_price) * 100.0, 2)
        pnl_value = round((curr_price - buy_price) * qty, 2)  # nghìn VND
        market_value = round(curr_price * qty, 2)

        # Xác định trạng thái chạm ngưỡng
        pos_status = "NORMAL"
        if pnl_pct >= tp_pct:
            pos_status = "TAKE_PROFIT_TRIGGERED"
        elif pnl_pct <= -sl_pct:
            pos_status = "STOP_LOSS_TRIGGERED"

        output_list.append(
            PortfolioPositionOut(
                ticker=pos.ticker,
                company_name=comp_name,
                buy_price=buy_price,
                quantity=qty,
                tp_pct=tp_pct,
                sl_pct=sl_pct,
                is_active=pos.is_active,
                created_at=pos.created_at,
                updated_at=pos.updated_at,
                current_price=curr_price,
                volume=volume,
                change_pct=change_pct,
                pnl_pct=pnl_pct,
                pnl_value=pnl_value,
                market_value=market_value,
                tp_price=tp_price,
                sl_price=sl_price,
                status=pos_status,
                last_updated=last_updated,
            )
        )

    if need_commit:
        await db.commit()

    return output_list


@router.post("", response_model=PortfolioPositionOut, status_code=status.HTTP_201_CREATED)
async def create_or_update_position(
    payload: PortfolioPositionCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Thêm mới hoặc cập nhật vị thế cổ phiếu trong danh mục.
    Tự động xác định và lưu trữ tên công ty.
    """
    ticker = payload.ticker.strip().upper()
    company_name = payload.company_name
    if not company_name:
        company_name = await stock_crawler.get_company_name(ticker)

    stmt = select(PortfolioPosition).where(PortfolioPosition.ticker == ticker)
    res = await db.execute(stmt)
    existing = res.scalars().first()

    if existing:
        existing.company_name = company_name
        existing.buy_price = payload.buy_price
        existing.quantity = payload.quantity
        existing.tp_pct = payload.tp_pct
        existing.sl_pct = payload.sl_pct
        existing.is_active = payload.is_active
        existing.updated_at = datetime.now(timezone.utc)
        target_pos = existing
    else:
        target_pos = PortfolioPosition(
            ticker=ticker,
            company_name=company_name,
            buy_price=payload.buy_price,
            quantity=payload.quantity,
            tp_pct=payload.tp_pct,
            sl_pct=payload.sl_pct,
            is_active=payload.is_active,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(target_pos)

    await db.commit()
    await db.refresh(target_pos)

    # Lấy giá realtime ngay sau khi tạo để lưu price_histories
    quote = await stock_crawler.fetch_realtime_quotes([ticker])
    t_quote = quote.get(ticker, {})
    curr_price = float(t_quote.get("price", payload.buy_price))
    volume = int(t_quote.get("volume", 0))
    change_pct = float(t_quote.get("change_pct", 0.0))

    hist_entry = PriceHistory(
        ticker=ticker,
        price=curr_price,
        volume=volume,
        change_pct=change_pct,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(hist_entry)
    await db.commit()

    buy_p = float(target_pos.buy_price)
    pnl_pct = round(((curr_price - buy_p) / buy_p) * 100.0, 2)
    pnl_val = round((curr_price - buy_p) * target_pos.quantity, 2)

    return PortfolioPositionOut(
        ticker=target_pos.ticker,
        company_name=target_pos.company_name,
        buy_price=buy_p,
        quantity=target_pos.quantity,
        tp_pct=float(target_pos.tp_pct),
        sl_pct=float(target_pos.sl_pct),
        is_active=target_pos.is_active,
        created_at=target_pos.created_at,
        updated_at=target_pos.updated_at,
        current_price=curr_price,
        volume=volume,
        change_pct=change_pct,
        pnl_pct=pnl_pct,
        pnl_value=pnl_val,
        market_value=round(curr_price * target_pos.quantity, 2),
        tp_price=round(buy_p * (1.0 + float(target_pos.tp_pct) / 100.0), 2),
        sl_price=round(buy_p * (1.0 - float(target_pos.sl_pct) / 100.0), 2),
        status="NORMAL",
        last_updated=datetime.now(timezone.utc),
    )


@router.put("/{ticker}", response_model=PortfolioPositionOut)
async def update_position(
    ticker: str,
    payload: PortfolioPositionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật thông số của một vị thế đã có."""
    ticker = ticker.strip().upper()
    stmt = select(PortfolioPosition).where(PortfolioPosition.ticker == ticker)
    res = await db.execute(stmt)
    pos = res.scalars().first()

    if not pos:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy mã {ticker} trong danh mục",
        )

    if payload.company_name is not None:
        pos.company_name = payload.company_name
    elif not pos.company_name:
        pos.company_name = await stock_crawler.get_company_name(ticker)

    if payload.buy_price is not None:
        pos.buy_price = payload.buy_price
    if payload.quantity is not None:
        pos.quantity = payload.quantity
    if payload.tp_pct is not None:
        pos.tp_pct = payload.tp_pct
    if payload.sl_pct is not None:
        pos.sl_pct = payload.sl_pct
    if payload.is_active is not None:
        pos.is_active = payload.is_active

    pos.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(pos)

    # Lấy giá mới nhất
    hist_stmt = (
        select(PriceHistory)
        .where(PriceHistory.ticker == ticker)
        .order_by(desc(PriceHistory.timestamp))
        .limit(1)
    )
    hist_res = await db.execute(hist_stmt)
    latest_hist = hist_res.scalars().first()

    buy_p = float(pos.buy_price)
    curr_price = float(latest_hist.price) if latest_hist else buy_p
    pnl_pct = round(((curr_price - buy_p) / buy_p) * 100.0, 2)

    return PortfolioPositionOut(
        ticker=pos.ticker,
        company_name=pos.company_name,
        buy_price=buy_p,
        quantity=pos.quantity,
        tp_pct=float(pos.tp_pct),
        sl_pct=float(pos.sl_pct),
        is_active=pos.is_active,
        created_at=pos.created_at,
        updated_at=pos.updated_at,
        current_price=curr_price,
        volume=int(latest_hist.volume) if latest_hist else 0,
        change_pct=float(latest_hist.change_pct) if latest_hist else 0.0,
        pnl_pct=pnl_pct,
        pnl_value=round((curr_price - buy_p) * pos.quantity, 2),
        market_value=round(curr_price * pos.quantity, 2),
        tp_price=round(buy_p * (1.0 + float(pos.tp_pct) / 100.0), 2),
        sl_price=round(buy_p * (1.0 - float(pos.sl_pct) / 100.0), 2),
        status="NORMAL",
        last_updated=latest_hist.timestamp if latest_hist else datetime.now(timezone.utc),
    )


@router.delete("/{ticker}")
async def delete_position(ticker: str, db: AsyncSession = Depends(get_db)):
    """Xóa hoàn toàn vị thế cổ phiếu khỏi danh mục theo dõi."""
    ticker = ticker.strip().upper()
    stmt = select(PortfolioPosition).where(PortfolioPosition.ticker == ticker)
    res = await db.execute(stmt)
    pos = res.scalars().first()

    if not pos:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy mã {ticker} trong danh mục",
        )

    await db.delete(pos)
    await db.commit()
    return {"success": True, "message": f"Đã xóa mã {ticker} khỏi danh mục theo dõi"}
