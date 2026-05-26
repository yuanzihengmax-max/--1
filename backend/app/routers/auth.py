"""认证路由 — 30 用户初始化 + 登录 + 当前用户 + 修改密码"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_system_session
from app.models import User
from app.auth_utils import hash_password, check_password, create_token
from app.dependencies import get_current_user, get_current_username
from app.schemas import LoginRequest, ChangePasswordRequest

router = APIRouter()

NEW_USERS = [
    {"username": "张文华", "display_name": "张文华", "role": "admin", "password": "008680"},
    {"username": "袁子恒", "display_name": "袁子恒", "role": "admin", "password": "114514"},
    {"username": "testintern", "display_name": "testintern", "role": "intern", "password": "123456"},
    {"username": "宁子月", "display_name": "宁子月", "role": "intern", "password": "123456"},
    {"username": "徐晶晶", "display_name": "徐晶晶", "role": "intern", "password": "123456"},
    {"username": "王睿", "display_name": "王睿", "role": "intern", "password": "123456"},
    {"username": "杨思曼", "display_name": "杨思曼", "role": "intern", "password": "123456"},
    {"username": "张佩萱", "display_name": "张佩萱", "role": "intern", "password": "123456"},
    {"username": "毕慧雯", "display_name": "毕慧雯", "role": "intern", "password": "123456"},
    {"username": "汪会琴", "display_name": "汪会琴", "role": "intern", "password": "123456"},
    {"username": "王翠梅", "display_name": "王翠梅", "role": "intern", "password": "123456"},
    {"username": "张晨", "display_name": "张晨", "role": "intern", "password": "123456"},
    {"username": "赵奔驰", "display_name": "赵奔驰", "role": "intern", "password": "123456"},
    {"username": "秦华杰", "display_name": "秦华杰", "role": "intern", "password": "123456"},
    {"username": "钱思雨", "display_name": "钱思雨", "role": "intern", "password": "123456"},
    {"username": "余硕", "display_name": "余硕", "role": "intern", "password": "123456"},
    {"username": "田琪", "display_name": "田琪", "role": "intern", "password": "123456"},
    {"username": "朱泽", "display_name": "朱泽", "role": "intern", "password": "123456"},
    {"username": "贾雯雯", "display_name": "贾雯雯", "role": "intern", "password": "123456"},
    {"username": "冯晨灿", "display_name": "冯晨灿", "role": "intern", "password": "123456"},
    {"username": "赵若彤", "display_name": "赵若彤", "role": "intern", "password": "123456"},
    {"username": "冶百合", "display_name": "冶百合", "role": "intern", "password": "123456"},
    {"username": "沈诗垚", "display_name": "沈诗垚", "role": "intern", "password": "123456"},
    {"username": "朱雨轩", "display_name": "朱雨轩", "role": "intern", "password": "123456"},
    {"username": "周墨", "display_name": "周墨", "role": "intern", "password": "123456"},
    {"username": "李辉", "display_name": "李辉", "role": "intern", "password": "123456"},
    {"username": "罗焉宁", "display_name": "罗焉宁", "role": "intern", "password": "123456"},
    {"username": "邓栩晗", "display_name": "邓栩晗", "role": "intern", "password": "123456"},
    {"username": "杨蕊荧", "display_name": "杨蕊荧", "role": "intern", "password": "123456"},
    {"username": "黄紫琼", "display_name": "黄紫琼", "role": "intern", "password": "123456"},
]


def init_all_users():
    db = get_system_session()
    try:
        existing = db.query(User).count()
        if existing > 0:
            return
        for u in NEW_USERS:
            db.add(User(
                username=u["username"],
                password_hash=hash_password(u["password"]),
                role=u["role"],
                display_name=u["display_name"],
                password_changed=0,
            ))
        db.commit()
    finally:
        db.close()


@router.post("/auth/login", tags=["认证"])
def login(body: LoginRequest, db: Session = Depends(get_system_session)):
    user = db.query(User).filter(
        User.username == body.username, User.is_active == True
    ).first()
    if not user or not check_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = create_token(user.username, user.role)
    return {
        "token": token,
        "user": {
            "username": user.username,
            "display_name": user.display_name,
            "role": user.role,
            "password_changed": bool(user.password_changed),
        }
    }


@router.get("/auth/me", tags=["认证"])
def me(user: dict = Depends(get_current_user)):
    db = get_system_session()
    try:
        u = db.query(User).filter(User.username == user["username"]).first()
        if not u:
            raise HTTPException(status_code=404)
        return {
            "username": u.username,
            "display_name": u.display_name,
            "role": u.role,
            "password_changed": bool(u.password_changed),
        }
    finally:
        db.close()


@router.post("/auth/change-password", tags=["认证"])
def change_password(
    body: ChangePasswordRequest,
    username: str = Depends(get_current_username),
):
    db = get_system_session()
    try:
        u = db.query(User).filter(User.username == username).first()
        if not u:
            raise HTTPException(status_code=404)
        if not check_password(body.old_password, u.password_hash):
            raise HTTPException(status_code=400, detail="旧密码不正确")
        u.password_hash = hash_password(body.new_password)
        u.password_changed = 1
        db.commit()
        return {"success": True}
    finally:
        db.close()
