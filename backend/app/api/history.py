import logging
from typing import List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import PriceHistory
from app.schemas import PriceHistoryOut

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/history", tags=["Price History"])


@router.get("/{ticker}", response_model=List[PriceHistoryOut])
async def get_price_history(
    ticker: str,
    limit: int = Query(default=100, ge=1, le=1000, description="Số lượng điểm dữ liệu lịch sử tối đa"),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy lịch sử biến động giá của một mã cổ phiếu để vẽ biểu đồ kỹ thuật.
    Truy vấn được tối ưu hóa nhờ Composite Index (ticker, timestamp DESC).
    """
    ticker_norm = ticker.strip().upper()

    # Truy vấn lấy các bản ghi mới nhất theo Composite Index
    stmt = (
        select(PriceHistory)
        .where(PriceHistory.ticker == ticker_norm)
        .order_by(desc(PriceHistory.timestamp))
        .limit(limit)
    )
    res = await db.execute(stmt)
    histories = res.scalars().all()

    # Đảo ngược thứ tự thời gian tăng dần để Frontend vẽ biểu đồ từ quá khứ đến hiện tại
    reversed_histories = list(reversed(histories))

    return [
        PriceHistoryOut(
            id=h.id,
            ticker=h.ticker,
            price=float(h.price),
            volume=int(h.volume),
            change_pct=float(h.change_pct),
            timestamp=h.timestamp,
        )
        for h in reversed_histories
    ]
