import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User, UserAISetting
from app.schemas import (
    UserRegister,
    UserLogin,
    UserOut,
    TokenOut,
    UserProfileUpdate,
    UserAIConfigUpdate,
    UserAIConfigOut,
)
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication & User Management"])


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    """Đăng ký tài khoản người dùng mới và trả về Access Token."""
    # Kiểm tra username hoặc email đã tồn tại chưa
    stmt = select(User).where(or_(User.username == payload.username, User.email == payload.email))
    res = await db.execute(stmt)
    existing_user = res.scalars().first()

    if existing_user:
        if existing_user.username == payload.username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên khác.",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Địa chỉ email này đã được đăng ký tài khoản.",
            )

    new_user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        telegram_chat_id=payload.telegram_chat_id,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    token = create_access_token(subject=new_user.id, extra_data={"username": new_user.username})
    return TokenOut(access_token=token, token_type="bearer", user=UserOut.model_validate(new_user))


@router.post("/login", response_model=TokenOut)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    """Đăng nhập bằng username hoặc email, trả về JWT Access Token."""
    identifier = payload.username_or_email.strip().lower()
    stmt = select(User).where(or_(User.username == identifier, User.email == identifier))
    res = await db.execute(stmt)
    user = res.scalars().first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác.",
        )

    token = create_access_token(subject=user.id, extra_data={"username": user.username})
    return TokenOut(access_token=token, token_type="bearer", user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Lấy thông tin tài khoản hiện tại."""
    return current_user


@router.put("/profile", response_model=UserOut)
async def update_profile(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật thông tin cá nhân (Họ tên, Telegram Chat ID, Mật khẩu)."""
    if payload.full_name is not None:
        current_user.full_name = payload.full_name

    if payload.telegram_chat_id is not None:
        current_user.telegram_chat_id = payload.telegram_chat_id.strip()

    if payload.new_password:
        if not payload.current_password or not verify_password(payload.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mật khẩu hiện tại không đúng.",
            )
        current_user.hashed_password = hash_password(payload.new_password)

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.get("/ai-config", response_model=UserAIConfigOut)
async def get_user_ai_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy cấu hình AI Engine riêng biệt của người dùng hiện tại."""
    stmt = select(UserAISetting).where(UserAISetting.user_id == current_user.id)
    res = await db.execute(stmt)
    setting = res.scalars().first()

    if not setting:
        return UserAIConfigOut()

    return UserAIConfigOut(
        ai_provider=setting.ai_provider or "gemini",
        gemini_api_key_set=bool(setting.gemini_api_key and setting.gemini_api_key.strip()),
        gemini_api_key_masked="****************" if (setting.gemini_api_key and setting.gemini_api_key.strip()) else None,
        openai_api_key_set=bool(setting.openai_api_key and setting.openai_api_key.strip()),
        openai_api_key_masked="****************" if (setting.openai_api_key and setting.openai_api_key.strip()) else None,
        local_ai_base_url=setting.local_ai_base_url.strip() if (setting.local_ai_base_url and setting.local_ai_base_url.strip()) else None,
        local_ai_api_key_set=bool(setting.local_ai_api_key and setting.local_ai_api_key.strip()),
        local_ai_api_key_masked="****************" if (setting.local_ai_api_key and setting.local_ai_api_key.strip()) else None,
        selected_model=setting.selected_model,
    )


@router.put("/ai-config", response_model=UserAIConfigOut)
async def update_user_ai_config(
    payload: UserAIConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật cấu hình AI Engine riêng biệt cho người dùng hiện tại."""
    stmt = select(UserAISetting).where(UserAISetting.user_id == current_user.id)
    res = await db.execute(stmt)
    setting = res.scalars().first()

    if not setting:
        setting = UserAISetting(user_id=current_user.id)
        db.add(setting)

    if payload.ai_provider:
        setting.ai_provider = payload.ai_provider

    # Chỉ cập nhật nếu user nhập key mới, nếu user gửi chuỗi '****************' thì giữ nguyên key cũ
    if payload.gemini_api_key is not None:
        if payload.gemini_api_key.strip() and not payload.gemini_api_key.strip().startswith("****"):
            setting.gemini_api_key = payload.gemini_api_key.strip()
        elif payload.gemini_api_key.strip() == "":
            setting.gemini_api_key = None

    if payload.openai_api_key is not None:
        if payload.openai_api_key.strip() and not payload.openai_api_key.strip().startswith("****"):
            setting.openai_api_key = payload.openai_api_key.strip()
        elif payload.openai_api_key.strip() == "":
            setting.openai_api_key = None

    if payload.local_ai_base_url is not None:
        setting.local_ai_base_url = payload.local_ai_base_url.strip() if payload.local_ai_base_url.strip() else None

    if payload.local_ai_api_key is not None:
        if payload.local_ai_api_key.strip() and not payload.local_ai_api_key.strip().startswith("****"):
            setting.local_ai_api_key = payload.local_ai_api_key.strip()
        elif payload.local_ai_api_key.strip() == "":
            setting.local_ai_api_key = None

    if payload.selected_model is not None:
        setting.selected_model = payload.selected_model.strip()

    await db.commit()
    await db.refresh(setting)

    return UserAIConfigOut(
        ai_provider=setting.ai_provider,
        gemini_api_key_set=bool(setting.gemini_api_key and setting.gemini_api_key.strip()),
        gemini_api_key_masked="****************" if (setting.gemini_api_key and setting.gemini_api_key.strip()) else None,
        openai_api_key_set=bool(setting.openai_api_key and setting.openai_api_key.strip()),
        openai_api_key_masked="****************" if (setting.openai_api_key and setting.openai_api_key.strip()) else None,
        local_ai_base_url=setting.local_ai_base_url.strip() if (setting.local_ai_base_url and setting.local_ai_base_url.strip()) else None,
        local_ai_api_key_set=bool(setting.local_ai_api_key and setting.local_ai_api_key.strip()),
        local_ai_api_key_masked="****************" if (setting.local_ai_api_key and setting.local_ai_api_key.strip()) else None,
        selected_model=setting.selected_model,
    )

