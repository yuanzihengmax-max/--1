"""日报 / 周报 CRUD"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user, get_current_role, get_all_user_dbs
from app.models import DailyReport, WeeklyReport
from app.schemas import (
    DailyReportCreate, DailyReportUpdate, DailyReportResponse,
    WeeklyReportCreate, WeeklyReportUpdate, WeeklyReportResponse,
)

router = APIRouter()


# ─── Daily Reports ────────────────────────────────────────────

@router.get("/daily-reports", response_model=list[DailyReportResponse], tags=["日报"])
def list_daily(
    owner_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
    role: str = Depends(get_current_role),
):
    if role == "admin":
        if owner_id:
            dbs = get_all_user_dbs(user)
            try:
                target = next((s for u, s in dbs if u == owner_id), None)
                if not target:
                    return []
                return target.query(DailyReport).order_by(DailyReport.sort_order).all()
            finally:
                for _, s in dbs:
                    s.close()
        # Admin without filter: aggregate all users
        dbs = get_all_user_dbs(user)
        all_rows = []
        try:
            for _, s in dbs:
                all_rows.extend(s.query(DailyReport).order_by(DailyReport.sort_order).all())
        finally:
            for _, s in dbs:
                if s is not db:
                    s.close()
        all_rows.sort(key=lambda r: r.sort_order)
        return all_rows
    rows = db.query(DailyReport).order_by(DailyReport.sort_order).all()
    return rows


@router.post("/daily-reports", response_model=DailyReportResponse, status_code=201, tags=["日报"])
def create_daily(data: DailyReportCreate, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    r = DailyReport(owner_id=user["username"], **data.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.put("/daily-reports/{report_id}", response_model=DailyReportResponse, tags=["日报"])
def update_daily(report_id: int, data: DailyReportUpdate, db: Session = Depends(get_db),
                  user: dict = Depends(get_current_user), role: str = Depends(get_current_role)):
    r = db.query(DailyReport).filter(DailyReport.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404)
    if role != "admin" and r.owner_id != user["username"]:
        raise HTTPException(status_code=403)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r


@router.delete("/daily-reports/{report_id}", tags=["日报"])
def delete_daily(report_id: int, db: Session = Depends(get_db),
                  user: dict = Depends(get_current_user), role: str = Depends(get_current_role)):
    r = db.query(DailyReport).filter(DailyReport.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404)
    if role != "admin" and r.owner_id != user["username"]:
        raise HTTPException(status_code=403)
    db.delete(r)
    db.commit()
    return {"ok": True}


# ─── Weekly Reports ───────────────────────────────────────────

@router.get("/weekly-reports", response_model=list[WeeklyReportResponse], tags=["周报"])
def list_weekly(
    owner_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
    role: str = Depends(get_current_role),
):
    if role == "admin":
        if owner_id:
            dbs = get_all_user_dbs(user)
            try:
                target = next((s for u, s in dbs if u == owner_id), None)
                if not target:
                    return []
                return target.query(WeeklyReport).order_by(WeeklyReport.sort_order).all()
            finally:
                for _, s in dbs:
                    s.close()
        # Admin without filter: aggregate all users
        dbs = get_all_user_dbs(user)
        all_rows = []
        try:
            for _, s in dbs:
                all_rows.extend(s.query(WeeklyReport).order_by(WeeklyReport.sort_order).all())
        finally:
            for _, s in dbs:
                if s is not db:
                    s.close()
        all_rows.sort(key=lambda r: r.sort_order)
        return all_rows
    rows = db.query(WeeklyReport).order_by(WeeklyReport.sort_order).all()
    return rows


@router.post("/weekly-reports", response_model=WeeklyReportResponse, status_code=201, tags=["周报"])
def create_weekly(data: WeeklyReportCreate, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    r = WeeklyReport(owner_id=user["username"], **data.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.put("/weekly-reports/{report_id}", response_model=WeeklyReportResponse, tags=["周报"])
def update_weekly(report_id: int, data: WeeklyReportUpdate, db: Session = Depends(get_db),
                   user: dict = Depends(get_current_user), role: str = Depends(get_current_role)):
    r = db.query(WeeklyReport).filter(WeeklyReport.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404)
    if role != "admin" and r.owner_id != user["username"]:
        raise HTTPException(status_code=403)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r


@router.delete("/weekly-reports/{report_id}", tags=["周报"])
def delete_weekly(report_id: int, db: Session = Depends(get_db),
                   user: dict = Depends(get_current_user), role: str = Depends(get_current_role)):
    r = db.query(WeeklyReport).filter(WeeklyReport.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404)
    if role != "admin" and r.owner_id != user["username"]:
        raise HTTPException(status_code=403)
    db.delete(r)
    db.commit()
    return {"ok": True}
