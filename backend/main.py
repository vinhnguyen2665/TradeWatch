import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import settings
from app.database import init_db, AsyncSessionLocal
from app.models import SystemSetting, PortfolioPosition, PriceHistory
from app.scheduler import scheduler_service
from app.crawler import stock_crawler

# Routers
from app.api.auth import router as auth_router
from app.api.positions import router as positions_router
from app.api.history import router as history_router
from app.api.settings import router as settings_router
from app.api.screener import router as screener_router
from app.api.dashboard import router as dashboard_router
from app.api.allocation import router as allocation_router
from app.api.admin import router as admin_router


# Cấu hình logging chuyên nghiệp
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("TradeWatch")


async def seed_initial_data():
    """Tạo các cấu hình mặc định và danh mục mẫu khởi tạo ban đầu nếu DB rỗng."""
    async with AsyncSessionLocal() as db:
        try:
            # 1. Cấu hình mặc định
            default_settings = {
                "polling_interval_sec": str(settings.DEFAULT_POLLING_INTERVAL_SEC),
                "bot_status": "RUNNING",
                "alert_cooldown_min": str(settings.DEFAULT_ALERT_COOLDOWN_MIN),
                "telegram_bot_token": settings.DEFAULT_TELEGRAM_BOT_TOKEN or "",
                "telegram_chat_id": settings.DEFAULT_TELEGRAM_CHAT_ID or "",
            }

            for k, v in default_settings.items():
                stmt = select(SystemSetting).where(SystemSetting.key == k)
                res = await db.execute(stmt)
                if not res.scalars().first():
                    db.add(SystemSetting(key=k, value=v))

            # 2. Danh mục mẫu (FPT, HPG, SSI, TCB, MWG) nếu chưa có vị thế nào
            pos_stmt = select(PortfolioPosition)
            pos_res = await db.execute(pos_stmt)
            # if not pos_res.scalars().first():
            #     sample_positions = [
            #         PortfolioPosition(ticker="FPT", buy_price=132.0, quantity=1000, tp_pct=8.0, sl_pct=5.0, is_active=True),
            #         PortfolioPosition(ticker="HPG", buy_price=28.5, quantity=2000, tp_pct=7.0, sl_pct=5.0, is_active=True),
            #         PortfolioPosition(ticker="SSI", buy_price=33.0, quantity=1500, tp_pct=9.0, sl_pct=6.0, is_active=True),
            #         PortfolioPosition(ticker="TCB", buy_price=23.8, quantity=2500, tp_pct=7.5, sl_pct=5.0, is_active=True),
            #         PortfolioPosition(ticker="MWG", buy_price=64.0, quantity=1000, tp_pct=10.0, sl_pct=5.0, is_active=True),
            #     ]
            #     db.add_all(sample_positions)
            #     logger.info("Created sample initial portfolio positions (FPT, HPG, SSI, TCB, MWG).")

            await db.commit()
        except Exception as e:
            logger.error(f"Error seeding initial data: {e}")
            await db.rollback()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Quản lý vòng đời ứng dụng FastAPI: Khởi tạo DB, Seed Data & Bật APScheduler."""
    logger.info("Initializing TradeWatch Financial Monitoring Backend...")
    await init_db()
    await seed_initial_data()
    
    # Khởi động background scheduler
    await scheduler_service.start(default_interval_sec=settings.DEFAULT_POLLING_INTERVAL_SEC)
    
    # Chạy quét lần đầu ngay khi start server
    asyncio.create_task(scheduler_service.scan_portfolio_job())
    
    yield

    # Tắt scheduler an toàn khi dừng server
    logger.info("Shutting down TradeWatch Backend...")
    await scheduler_service.shutdown()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Hệ thống giám sát chứng khoán Việt Nam (HOSE/HNX), theo dõi danh mục, lịch sử biến động và cảnh báo Telegram.",
    lifespan=lifespan,
)

# Cấu hình CORS mở rộng cho Frontend kết nối
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount các Router
app.include_router(auth_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(positions_router, prefix="/api")
app.include_router(history_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(screener_router, prefix="/api")
app.include_router(allocation_router, prefix="/api")
app.include_router(admin_router, prefix="/api")



@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "online",
        "docs_url": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
