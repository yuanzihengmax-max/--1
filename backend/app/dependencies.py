"""FastAPI 依赖注入"""
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session

from app.database import get_session, get_system_session
from app.auth_utils import verify_token


async def get_current_user(
    authorization: str = Header(None),
) -> dict:
    """获取当前用户信息。使用 Bearer token 认证。"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        try:
            payload = verify_token(token)
            return {
                "username": payload["sub"],
                "role": payload.get("role", "intern"),
            }
        except ValueError as e:
            msg = str(e)
            if "expired" in msg:
                raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
            raise HTTPException(status_code=401, detail="无效的登录凭证")

    raise HTTPException(status_code=401, detail="请先登录")


def get_db(
    user: dict = Depends(get_current_user),
) -> Session:
    """获取用户专属数据库会话"""
    session = get_session(user["username"])
    try:
        yield session
    finally:
        session.close()


def get_system_db() -> Session:
    """获取系统级数据库会话（users 表）"""
    session = get_system_session()
    try:
        yield session
    finally:
        session.close()


def require_admin(user: dict = Depends(get_current_user)):
    """要求管理员权限"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可操作")
    return user


def get_current_username(user: dict = Depends(get_current_user)) -> str:
    return user["username"]


def get_current_role(user: dict = Depends(get_current_user)) -> str:
    return user.get("role", "intern")


def get_all_user_dbs(user: dict = Depends(get_current_user)) -> list:
    """Returns list of (username, session) tuples.
    Admin sees all users, non-admin sees only themselves."""
    from app.models import User as UserModel

    username = user["username"]
    role = user.get("role", "intern")

    if role != "admin":
        s = get_session(username)
        return [(username, s)]

    sys_db = get_system_session()
    try:
        users = sys_db.query(UserModel).all()
    finally:
        sys_db.close()

    result = []
    for u in users:
        try:
            s = get_session(u.username)
            result.append((u.username, s))
        except Exception:
            pass
    return result
