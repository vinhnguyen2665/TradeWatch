import logging
from datetime import datetime, timezone
from typing import List, Dict, Any
import numpy as np
import pandas as pd
from app.crawler import stock_crawler
from app.schemas import ScreenerSignalOut

logger = logging.getLogger(__name__)

# Danh sách mã chứng khoán theo dõi thanh khoản cao (VN30 + Top Midcaps)
WATCHLIST_TICKERS = [
    "FPT", "SSI", "HPG", "TCB", "MWG", "VNM", "MBB", "DGC",
    "VND", "STB", "VPB", "ACB", "MSN", "KDH", "PVD", "GAS",
    "VIC", "VHM", "CTG", "VCB", "REE", "GEX", "DIG", "PDR",
    "VCI", "HCM", "HSG", "NKG", "VRE", "TPB"
]

TICKER_INFO = {
    "FPT": {"name": "CTCP FPT", "exchange": "HOSE"},
    "SSI": {"name": "CTCP Chứng khoán SSI", "exchange": "HOSE"},
    "HPG": {"name": "CTCP Tập đoàn Hòa Phát", "exchange": "HOSE"},
    "TCB": {"name": "Ngân hàng TMCP Kỹ thương Việt Nam", "exchange": "HOSE"},
    "MWG": {"name": "CTCP Đầu tư Thế Giới Di Động", "exchange": "HOSE"},
    "VNM": {"name": "CTCP Sữa Việt Nam (Vinamilk)", "exchange": "HOSE"},
    "MBB": {"name": "Ngân hàng TMCP Quân đội", "exchange": "HOSE"},
    "DGC": {"name": "CTCP Tập đoàn Hóa chất Đức Giang", "exchange": "HOSE"},
    "VND": {"name": "CTCP Chứng khoán VNDIRECT", "exchange": "HOSE"},
    "STB": {"name": "Ngân hàng TMCP Sài Gòn Thương Tín", "exchange": "HOSE"},
    "VPB": {"name": "Ngân hàng TMCP Việt Nam Thịnh Vượng", "exchange": "HOSE"},
    "ACB": {"name": "Ngân hàng TMCP Á Châu", "exchange": "HOSE"},
    "MSN": {"name": "CTCP Tập đoàn Masan", "exchange": "HOSE"},
    "KDH": {"name": "CTCP Đầu tư và Kinh doanh Nhà Khang Điền", "exchange": "HOSE"},
    "PVD": {"name": "Tổng CTCP Khoan và Dịch vụ Khoan Dầu khí", "exchange": "HOSE"},
    "GAS": {"name": "Tổng Công ty Khí Việt Nam", "exchange": "HOSE"},
    "VIC": {"name": "Tập đoàn Vingroup", "exchange": "HOSE"},
    "VHM": {"name": "CTCP Vinhomes", "exchange": "HOSE"},
    "CTG": {"name": "Ngân hàng TMCP Công Thương Việt Nam", "exchange": "HOSE"},
    "VCB": {"name": "Ngân hàng TMCP Ngoại thương Việt Nam", "exchange": "HOSE"},
    "REE": {"name": "CTCP Cơ Điện Lạnh", "exchange": "HOSE"},
    "GEX": {"name": "CTCP Tập đoàn GELEX", "exchange": "HOSE"},
    "DIG": {"name": "Tổng CTCP Đầu tư Phát triển Xây dựng", "exchange": "HOSE"},
    "PDR": {"name": "CTCP Phát triển Bất động sản Phát Đạt", "exchange": "HOSE"},
    "VCI": {"name": "CTCP Chứng khoán Vietcap", "exchange": "HOSE"},
    "HCM": {"name": "CTCP Chứng khoán TP.HCM (HSC)", "exchange": "HOSE"},
    "HSG": {"name": "CTCP Tập đoàn Hoa Sen", "exchange": "HOSE"},
    "NKG": {"name": "CTCP Thép Nam Kim", "exchange": "HOSE"},
    "VRE": {"name": "CTCP Vincom Retail", "exchange": "HOSE"},
    "TPB": {"name": "Ngân hàng TMCP Tiên Phong", "exchange": "HOSE"},
}


class StockScreener:
    """
    Bộ lọc kỹ thuật tự động phân tích thị trường:
    - Volume Breakout (Vol >= 1.5 * SMA20)
    - RSI Oversold Recovery (RSI14 < 35 và bật tăng)
    - MA20 Breakout (Giá cắt lên đường MA20)
    """

    def calculate_rsi(self, series: pd.Series, period: int = 14) -> pd.Series:
        """Tính toán Relative Strength Index (RSI 14) chuẩn kỹ thuật."""
        delta = series.diff()
        gain = delta.clip(lower=0)
        loss = -1 * delta.clip(upper=0)

        avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
        avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()

        rs = avg_gain / avg_loss.replace(0, np.nan)
        rsi = 100 - (100 / (1 + rs))
        return rsi.fillna(50.0)

    async def scan_market(self, tickers: List[str] = None) -> List[ScreenerSignalOut]:
        """Quét toàn bộ watchlist và trả về danh sách các tín hiệu kỹ thuật tiềm năng."""
        target_tickers = tickers or WATCHLIST_TICKERS
        signals: List[ScreenerSignalOut] = []

        # 1. Lấy giá realtime
        quotes = await stock_crawler.fetch_realtime_quotes(target_tickers)

        # 2. Phân tích chuỗi nến lịch sử cho từng mã
        for ticker in target_tickers:
            try:
                bars = await stock_crawler.fetch_historical_bars(ticker, count=40)
                if not bars or len(bars) < 20:
                    continue

                df = pd.DataFrame(bars)
                df["close"] = pd.to_numeric(df["close"])
                df["volume"] = pd.to_numeric(df["volume"])

                # Cập nhật giá và volume mới nhất nếu có
                if ticker in quotes:
                    df.loc[df.index[-1], "close"] = quotes[ticker]["price"]
                    df.loc[df.index[-1], "volume"] = quotes[ticker]["volume"]

                # Tính MA20, SMA20 Volume, RSI14
                df["ma_20"] = df["close"].rolling(window=20).mean()
                df["sma20_volume"] = df["volume"].rolling(window=20).mean()
                df["rsi_14"] = self.calculate_rsi(df["close"], period=14)

                latest = df.iloc[-1]
                prev = df.iloc[-2]

                curr_price = float(latest["close"])
                curr_vol = int(latest["volume"])
                sma20_vol = float(latest["sma20_volume"]) if not np.isnan(latest["sma20_volume"]) else curr_vol
                ma_20 = float(latest["ma_20"]) if not np.isnan(latest["ma_20"]) else curr_price
                rsi = float(latest["rsi_14"]) if not np.isnan(latest["rsi_14"]) else 50.0
                prev_rsi = float(prev["rsi_14"]) if not np.isnan(prev["rsi_14"]) else 50.0

                vol_ratio = round(curr_vol / sma20_vol, 2) if sma20_vol > 0 else 1.0
                change_pct = float(quotes.get(ticker, {}).get("change_pct", 0.0))

                comp_name = await stock_crawler.get_company_name(ticker)
                exchange = stock_crawler._company_directory.get(ticker, {}).get("exchange", "HOSE")

                # Tiêu chí 1: Khối lượng giao dịch đột biến (Vol >= 1.5 * SMA20) và giá xanh
                if vol_ratio >= 1.5 and change_pct > 0:
                    signals.append(
                        ScreenerSignalOut(
                            ticker=ticker,
                            name=comp_name,
                            exchange=exchange,
                            price=curr_price,
                            change_pct=change_pct,
                            volume=curr_vol,
                            sma20_volume=round(sma20_vol, 0),
                            volume_spike_ratio=vol_ratio,
                            rsi_14=round(rsi, 2),
                            ma_20=round(ma_20, 2),
                            signal_type="VOLUME_BREAKOUT",
                            signal_strength="STRONG" if vol_ratio >= 2.0 else "MEDIUM",
                            reason=f"Khối lượng bùng nổ gấp {vol_ratio}x so với SMA20 kèm giá tăng (+{change_pct}%)",
                            timestamp=datetime.now(timezone.utc),
                        )
                    )

                # Tiêu chí 2: RSI vùng quá bán hồi phục (RSI < 35 và bắt đầu quay đầu tăng)
                elif rsi < 35 and rsi > prev_rsi:
                    signals.append(
                        ScreenerSignalOut(
                            ticker=ticker,
                            name=comp_name,
                            exchange=exchange,
                            price=curr_price,
                            change_pct=change_pct,
                            volume=curr_vol,
                            sma20_volume=round(sma20_vol, 0),
                            volume_spike_ratio=vol_ratio,
                            rsi_14=round(rsi, 2),
                            ma_20=round(ma_20, 2),
                            signal_type="RSI_OVERSOLD_REBOUND",
                            signal_strength="STRONG" if rsi < 30 else "MEDIUM",
                            reason=f"RSI(14)={round(rsi, 1)} chạm vùng quá bán và phát tín hiệu đảo chiều tạo đáy",
                            timestamp=datetime.now(timezone.utc),
                        )
                    )

                # Tiêu chí 3: Giá vượt lên trên đường MA20 (Breakout MA20)
                elif prev["close"] <= prev["ma_20"] and curr_price > ma_20:
                    signals.append(
                        ScreenerSignalOut(
                            ticker=ticker,
                            name=comp_name,
                            exchange=exchange,
                            price=curr_price,
                            change_pct=change_pct,
                            volume=curr_vol,
                            sma20_volume=round(sma20_vol, 0),
                            volume_spike_ratio=vol_ratio,
                            rsi_14=round(rsi, 2),
                            ma_20=round(ma_20, 2),
                            signal_type="MA20_BREAKOUT",
                            signal_strength="MEDIUM",
                            reason=f"Giá vượt đường trung bình động MA20 ({round(ma_20, 2)}) xác nhận xu hướng tăng ngắn hạn",
                            timestamp=datetime.now(timezone.utc),
                        )
                    )

            except Exception as e:
                logger.error(f"Error evaluating screener for {ticker}: {e}")

        # Sắp xếp theo tỷ lệ đột biến volume giảm dần
        signals.sort(key=lambda s: (s.signal_strength == "STRONG", s.volume_spike_ratio), reverse=True)
        return signals


screener_engine = StockScreener()
