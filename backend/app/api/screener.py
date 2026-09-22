import logging
from typing import List
from fastapi import APIRouter
from app.schemas import ScreenerSignalOut
from app.screener import screener_engine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/screener", tags=["Market Screener"])


@router.get("/suggest", response_model=List[ScreenerSignalOut])
async def get_screener_suggestions():
    """
    Quét thị trường theo các tiêu chí kỹ thuật chuyên sâu:
    1. Khối lượng đột biến (Volume >= 1.5x SMA20) kèm giá tăng.
    2. RSI(14) vùng quá bán (<35) phân kỳ / đảo chiều đi lên.
    3. Giá vượt đường trung bình động MA20 (Breakout).
    """
    signals = await screener_engine.scan_market()
    return signals
