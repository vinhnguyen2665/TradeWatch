import logging
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, PortfolioPosition, AlertLog, UserAISetting
from app.auth import get_current_admin_user, hash_password
from app.schemas import (
    UserAdminItem,
    UserAdminStats,
    UserGrowthPoint,
    TopActiveUser,
    UserAdminCreate,
    UserAdminUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin Management & Statistics"])


@router.get("/stats", response_model=UserAdminStats)
async def get_admin_stats(
    current_admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Thống kê tổng quan hệ thống dành riêng cho Admin:
    - Tổng số người dùng, số admin, số user thường
    - Tổng số vị thế cổ phiếu đang theo dõi trong toàn hệ thống
    - Tổng số cảnh báo đã gửi
    - Lịch sử tăng trưởng người dùng
    - Top người dùng tích cực nhất
    """
    # 1. Đếm tổng số user và phân loại role
    total_users_res = await db.execute(select(func.count(User.id)))
    total_users = total_users_res.scalar_one_or_none() or 0

    total_admins_res = await db.execute(select(func.count(User.id)).where(User.role == "admin"))
    total_admins = total_admins_res.scalar_one_or_none() or 0

    total_regular = max(0, total_users - total_admins)

    # 2. Tổng số vị thế & tổng alerts
    total_pos_res = await db.execute(select(func.count(PortfolioPosition.id)))
    total_positions = total_pos_res.scalar_one_or_none() or 0

    total_alerts_res = await db.execute(select(func.count(AlertLog.id)))
    total_alerts = total_alerts_res.scalar_one_or_none() or 0

    # 3. Lịch sử tăng trưởng người dùng (User Growth Timeline)
    # Lấy các users và group theo ngày
    users_stmt = select(User.created_at).order_by(User.created_at.asc())
    users_res = await db.execute(users_stmt)
    created_dates = users_res.scalars().all()

    growth_map = {}
    cumulative = 0
    for dt in created_dates:
        if dt:
            date_str = dt.strftime("%d/%m/%Y")
            cumulative += 1
            growth_map[date_str] = cumulative

    user_growth = [
        UserGrowthPoint(date=d, users_count=c)
        for d, c in growth_map.items()
    ]

    # Nếu ít hơn 2 điểm, thêm điểm bắt đầu để đồ thị Recharts hiển thị đẹp
    if len(user_growth) == 1:
        user_growth.insert(0, UserGrowthPoint(date="Bắt đầu", users_count=0))

    # 4. Top người dùng tích cực nhất (theo số lượng cổ phiếu đang theo dõi)
    user_pos_subq = (
        select(
            User.id,
            User.username,
            User.full_name,
            User.role,
            func.count(PortfolioPosition.id).label("positions_count"),
        )
        .outerjoin(PortfolioPosition, PortfolioPosition.user_id == User.id)
        .group_by(User.id, User.username, User.full_name, User.role)
        .order_by(desc("positions_count"), User.created_at.asc())
        .limit(5)
    )
    top_res = await db.execute(user_pos_subq)
    top_rows = top_res.all()

    top_users = []
    for row in top_rows:
        # Lấy thêm số lượng alert của từng user
        u_alerts = await db.execute(
            select(func.count(AlertLog.id)).where(AlertLog.user_id == row.id)
        )
        alerts_count = u_alerts.scalar_one_or_none() or 0

        top_users.append(
            TopActiveUser(
                id=row.id,
                username=row.username,
                full_name=row.full_name,
                role=row.role,
                positions_count=row.positions_count,
                alerts_count=alerts_count,
            )
        )

    return UserAdminStats(
        total_users=total_users,
        total_admins=total_admins,
        total_regular_users=total_regular,
        total_positions_tracked=total_positions,
        total_alerts_sent=total_alerts,
        user_growth=user_growth,
        top_users=top_users,
    )


@router.get("/users", response_model=List[UserAdminItem])
async def get_admin_users(
    q: Optional[str] = Query(None, description="Tìm kiếm username, email, full_name"),
    role: Optional[str] = Query(None, description="'all' | 'admin' | 'user'"),
    current_admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy danh sách người dùng hệ thống kèm số vị thế và số cảnh báo.
    Hỗ trợ tìm kiếm theo tên, email và lọc theo vai trò.
    """
    stmt = select(User).order_by(User.id.asc())

    if q and q.strip():
        search = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.username).like(search),
                func.lower(User.email).like(search),
                func.lower(User.full_name).like(search),
            )
        )

    if role and role.strip() and role.strip().lower() in ("admin", "user"):
        stmt = stmt.where(User.role == role.strip().lower())

    res = await db.execute(stmt)
    users = res.scalars().all()

    items = []
    for u in users:
        # Đếm số positions
        p_res = await db.execute(
            select(func.count(PortfolioPosition.id)).where(PortfolioPosition.user_id == u.id)
        )
        pos_cnt = p_res.scalar_one_or_none() or 0

        # Đếm số alerts
        a_res = await db.execute(
            select(func.count(AlertLog.id)).where(AlertLog.user_id == u.id)
        )
        alert_cnt = a_res.scalar_one_or_none() or 0

        # Lấy thông tin AI setting
        ai_res = await db.execute(
            select(UserAISetting.ai_provider).where(UserAISetting.user_id == u.id)
        )
        ai_provider = ai_res.scalar_one_or_none() or "gemini"

        items.append(
            UserAdminItem(
                id=u.id,
                username=u.username,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                telegram_chat_id=u.telegram_chat_id,
                created_at=u.created_at,
                updated_at=u.updated_at,
                positions_count=pos_cnt,
                alerts_count=alert_cnt,
                ai_provider=ai_provider,
            )
        )

    return items


@router.post("/users", response_model=UserAdminItem, status_code=status.HTTP_201_CREATED)
async def create_user_by_admin(
    payload: UserAdminCreate,
    current_admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin tạo tài khoản người dùng mới trực tiếp với vai trò chỉ định (admin/user)."""
    # Kiểm tra username hoặc email trùng lặp
    check_stmt = select(User).where(or_(User.username == payload.username, User.email == payload.email))
    check_res = await db.execute(check_stmt)
    if check_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên đăng nhập hoặc email đã tồn tại trên hệ thống.",
        )

    new_user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        telegram_chat_id=payload.telegram_chat_id.strip() if payload.telegram_chat_id else None,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return UserAdminItem(
        id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role,
        telegram_chat_id=new_user.telegram_chat_id,
        created_at=new_user.created_at,
        updated_at=new_user.updated_at,
        positions_count=0,
        alerts_count=0,
        ai_provider="gemini",
    )


@router.put("/users/{user_id}", response_model=UserAdminItem)
async def update_user_by_admin(
    user_id: int,
    payload: UserAdminUpdate,
    current_admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin cập nhật thông tin người dùng:
    - Đổi họ tên, email, Telegram Chat ID
    - Đổi phân quyền role (admin <-> user)
    - Đặt lại mật khẩu mới cho user
    """
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    target_user = res.scalars().first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy người dùng này trong hệ thống.",
        )

    # Nếu hạ quyền admin thành user: kiểm tra xem có phải là admin duy nhất không
    if payload.role and payload.role != target_user.role:
        if target_user.role == "admin" and payload.role == "user":
            admin_count_res = await db.execute(select(func.count(User.id)).where(User.role == "admin"))
            admin_count = admin_count_res.scalar_one_or_none() or 0
            if admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Không thể hạ quyền Quản trị viên cuối cùng của hệ thống.",
                )
        target_user.role = payload.role

    if payload.full_name is not None:
        target_user.full_name = payload.full_name.strip()

    if payload.email is not None and payload.email != target_user.email:
        # Kiểm tra email trùng
        email_check = await db.execute(select(User).where(User.email == payload.email, User.id != user_id))
        if email_check.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Địa chỉ email này đã được sử dụng bởi tài khoản khác.",
            )
        target_user.email = payload.email

    if payload.telegram_chat_id is not None:
        target_user.telegram_chat_id = payload.telegram_chat_id.strip() if payload.telegram_chat_id.strip() else None

    if payload.password and payload.password.strip():
        target_user.hashed_password = hash_password(payload.password.strip())

    await db.commit()
    await db.refresh(target_user)

    # Lấy thêm positions & alerts count
    p_res = await db.execute(
        select(func.count(PortfolioPosition.id)).where(PortfolioPosition.user_id == target_user.id)
    )
    pos_cnt = p_res.scalar_one_or_none() or 0

    a_res = await db.execute(
        select(func.count(AlertLog.id)).where(AlertLog.user_id == target_user.id)
    )
    alert_cnt = a_res.scalar_one_or_none() or 0

    ai_res = await db.execute(
        select(UserAISetting.ai_provider).where(UserAISetting.user_id == target_user.id)
    )
    ai_provider = ai_res.scalar_one_or_none() or "gemini"

    return UserAdminItem(
        id=target_user.id,
        username=target_user.username,
        email=target_user.email,
        full_name=target_user.full_name,
        role=target_user.role,
        telegram_chat_id=target_user.telegram_chat_id,
        created_at=target_user.created_at,
        updated_at=target_user.updated_at,
        positions_count=pos_cnt,
        alerts_count=alert_cnt,
        ai_provider=ai_provider,
    )


@router.delete("/users/{user_id}")
async def delete_user_by_admin(
    user_id: int,
    current_admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin xóa người dùng khỏi hệ thống.
    Tự động cascade xóa toàn bộ vị thế, cảnh báo và cấu hình AI liên quan.
    """
    if current_admin.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bạn không thể tự xóa tài khoản quản trị viên đang đăng nhập của chính mình.",
        )

    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    target_user = res.scalars().first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy người dùng cần xóa.",
        )

    # Nếu là admin, kiểm tra không để hệ thống không còn admin nào
    if target_user.role == "admin":
        admin_count_res = await db.execute(select(func.count(User.id)).where(User.role == "admin"))
        admin_count = admin_count_res.scalar_one_or_none() or 0
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể xóa Quản trị viên duy nhất còn lại của hệ thống.",
            )

    username = target_user.username
    await db.delete(target_user)
    await db.commit()

    return {"success": True, "message": f"Đã xóa thành công tài khoản người dùng '{username}'."}
