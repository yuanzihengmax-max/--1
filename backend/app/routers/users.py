"""用户管理（仅管理员）"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_system_session
from app.models import User
from app.auth_utils import hash_password
from app.dependencies import require_admin
from app.schemas import UserResponse, CreateUserRequest, ResetPasswordRequest

router = APIRouter()


@router.get("/users", response_model=list[UserResponse], tags=["用户管理"])
def list_users(db: Session = Depends(get_system_session), _=Depends(require_admin)):
    return db.query(User).order_by(User.created_at).all()


@router.post("/users", tags=["用户管理"])
def create_user(body: CreateUserRequest, db: Session = Depends(get_system_session), _=Depends(require_admin)):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="用户名已存在")
    u = User(
        username=body.username, password_hash=hash_password(body.password),
        display_name=body.display_name, role=body.role, password_changed=0,
    )
    db.add(u); db.commit()
    return {"ok": True}


@router.delete("/users/{user_id}", tags=["用户管理"])
def delete_user(user_id: int, db: Session = Depends(get_system_session), _=Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u: raise HTTPException(status_code=404)
    db.delete(u); db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/reset-password", tags=["用户管理"])
def reset_password(user_id: int, body: ResetPasswordRequest, db: Session = Depends(get_system_session), _=Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u: raise HTTPException(status_code=404)
    u.password_hash = hash_password(body.new_password)
    u.password_changed = 0; db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/toggle-active", tags=["用户管理"])
def toggle_active(user_id: int, db: Session = Depends(get_system_session), _=Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u: raise HTTPException(status_code=404)
    u.is_active = not u.is_active; db.commit()
    return {"ok": True, "is_active": u.is_active}
