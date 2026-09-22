import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

logger = logging.getLogger(__name__)

# Normalize DATABASE_URL for asyncpg if standard postgresql:// prefix is used
db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif db_url.startswith("sqlite:///"):
    db_url = db_url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)

engine = create_async_engine(
    db_url,
    echo=settings.DEBUG,
    future=True,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    """Dependency for injecting async database session into FastAPI endpoints."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


from sqlalchemy import text


async def init_db():
    """Create all database tables if they do not exist, and safely alter columns if needed."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Tự động thêm cột company_name nếu bảng đã tồn tại từ trước
        try:
            await conn.execute(text("ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);"))
        except Exception:
            pass
    logger.info("Database schema initialized successfully.")
