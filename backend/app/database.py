import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
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


async def init_db():
    """Create all database tables if they do not exist, and safely alter columns if needed."""
    # Import all models to ensure metadata is populated
    from app.models import (
        User,
        PortfolioPosition,
        PriceHistory,
        SystemSetting,
        AlertLog,
        PortfolioAllocation,
        UserAISetting,
    )
    from app.auth import hash_password

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # Migration helper for portfolio_positions & users
        try:
            # Check if user_id column exists
            await conn.execute(text("ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;"))
            await conn.execute(text("ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);"))
            await conn.execute(text("ALTER TABLE alert_logs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';"))
        except Exception as e:
            logger.debug(f"Migration notice: {e}")

    # Tạo tài khoản demo mặc định hoặc tài khoản admin nếu chưa có
    async with AsyncSessionLocal() as session:
        try:
            from sqlalchemy import select
            # 1. Đảm bảo user 'vinhn' là admin nếu tồn tại
            vinhn_user = (await session.execute(select(User).where(User.username == "vinhn"))).scalars().first()
            if vinhn_user:
                vinhn_user.role = "admin"
                await session.commit()
                logger.info("Assigned admin role to existing user 'vinhn'")

            # 2. Đảm bảo có tài khoản quản trị viên 'admin'
            admin_check = await session.execute(select(User).where(User.username == "admin"))
            if not admin_check.scalars().first():
                admin_user = User(
                    username="admin",
                    email="admin@tradewatch.vn",
                    hashed_password=hash_password("admin123"),
                    full_name="Quản Trị Viên Hệ Thống",
                    role="admin",
                    telegram_chat_id="",
                )
                session.add(admin_user)
                await session.commit()
                logger.info("Created default system admin user: username='admin', password='admin123'")

            # 3. Tạo tài khoản demo nếu DB rỗng
            user_check = await session.execute(select(User).limit(1))
            if not user_check.scalars().first():
                demo_user = User(
                    username="demo",
                    email="demo@tradewatch.vn",
                    hashed_password=hash_password("123456"),
                    full_name="Nhà Đầu Tư Demo",
                    role="user",
                    telegram_chat_id="",
                )
                session.add(demo_user)
                await session.commit()
                await session.refresh(demo_user)
                logger.info(f"Created default demo user: username='demo', password='123456'")

                # Gán các position cũ nếu có cho demo user
                await session.execute(
                    text(f"UPDATE portfolio_positions SET user_id = {demo_user.id} WHERE user_id IS NULL")
                )
                await session.commit()
        except Exception as e:
            logger.debug(f"User initialization notice: {e}")

    logger.info("Database schema initialized successfully.")
