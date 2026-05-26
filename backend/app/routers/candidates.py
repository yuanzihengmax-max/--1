"""候选人 CRUD + 导入"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
import openpyxl

from app.dependencies import get_db, get_current_user, get_current_role, get_current_username, require_admin, get_all_user_dbs
from app.models import Candidate
from app.schemas import CandidateCreate, CandidateUpdate, CandidateResponse, CandidateListResponse

router = APIRouter()


def _apply_filters(q, result, channel, education, evaluator, department, position, date_from, date_to):
    if result:
        q = q.filter(Candidate.result == result)
    if channel:
        q = q.filter(Candidate.channel == channel)
    if education:
        q = q.filter(Candidate.education == education)
    if evaluator:
        q = q.filter(Candidate.evaluator == evaluator)
    if department:
        q = q.filter(Candidate.department == department)
    if position:
        q = q.filter(Candidate.position == position)
    if date_from:
        q = q.filter(Candidate.communicate_time >= date_from)
    if date_to:
        q = q.filter(Candidate.communicate_time <= date_to + "T23:59:59")
    return q


@router.get("/candidates", response_model=CandidateListResponse, tags=["候选人"])
def list_candidates(
    result: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    education: Optional[str] = Query(None),
    evaluator: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    position: Optional[str] = Query(None),
    intern_name: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, alias="date_start"),
    date_to: Optional[str] = Query(None, alias="date_end"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
    role: str = Depends(get_current_role),
):
    # Admin without specific intern: aggregate across all user DBs
    if role == "admin" and not intern_name:
        dbs: List[tuple] = get_all_user_dbs(user)
        all_candidates: List[Candidate] = []
        sessions_to_close = []
        try:
            for uname, session in dbs:
                if session is not db:
                    sessions_to_close.append(session)
                q = _apply_filters(session.query(Candidate), result, channel, education, evaluator, department, position, date_from, date_to)
                all_candidates.extend(q.all())
        finally:
            for s in sessions_to_close:
                try:
                    s.close()
                except Exception:
                    pass

        all_candidates.sort(key=lambda c: c.communicate_time or "", reverse=True)
        total = len(all_candidates)
        total_pages = max(1, (total + page_size - 1) // page_size)
        start = (page - 1) * page_size
        items = all_candidates[start:start + page_size]
        return CandidateListResponse(items=items, total=total, page=page, page_size=page_size, total_pages=total_pages)

    # Single user DB path (non-admin, or admin with intern_name filter)
    if intern_name and role == "admin":
        from app.database import get_session
        session = get_session(intern_name)
        try:
            q = session.query(Candidate)
            q = _apply_filters(q, result, channel, education, evaluator, department, position, date_from, date_to)
            total = q.count()
            total_pages = max(1, (total + page_size - 1) // page_size)
            items = q.order_by(Candidate.communicate_time.desc()).offset((page - 1) * page_size).limit(page_size).all()
            return CandidateListResponse(items=items, total=total, page=page, page_size=page_size, total_pages=total_pages)
        finally:
            session.close()

    q = db.query(Candidate)
    if role != "admin":
        q = q.filter(Candidate.intern_name == user["username"])
    if intern_name:
        q = q.filter(Candidate.intern_name == intern_name)
    q = _apply_filters(q, result, channel, education, evaluator, department, position, date_from, date_to)

    total = q.count()
    total_pages = max(1, (total + page_size - 1) // page_size)
    items = q.order_by(Candidate.communicate_time.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return CandidateListResponse(items=items, total=total, page=page, page_size=page_size, total_pages=total_pages)


@router.get("/candidates/{candidate_id}", response_model=CandidateResponse, tags=["候选人"])
def get_candidate(candidate_id: int, db: Session = Depends(get_db)):
    c = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="候选人不存在")
    return c


def _normalize_date(v: str | None) -> str | None:
    if v and "/" in v:
        return v.replace("/", "-")
    return v


@router.post("/candidates", response_model=CandidateResponse, status_code=201, tags=["候选人"])
def create_candidate(
    data: CandidateCreate,
    db: Session = Depends(get_db),
    username: str = Depends(get_current_username),
):
    payload = data.model_dump()
    payload["communicate_time"] = _normalize_date(payload.get("communicate_time"))
    c = Candidate(intern_name=username, **payload)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def _find_candidate_in_dbs(candidate_id: int, db: Session, user: dict, role: str, intern_name: str = None) -> tuple:
    """Find candidate in the correct user DB. Returns (candidate, session)."""
    from app.database import get_session
    # If intern_name specified and different from current user, go to that user's DB directly
    if intern_name and intern_name != user.get("username"):
        session = get_session(intern_name)
        c = session.query(Candidate).filter(Candidate.id == candidate_id).first()
        if c:
            return c, session
        session.close()
        return None, db
    # Search current user's DB
    c = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if c:
        return c, db
    if role != "admin":
        return None, db
    # Admin without intern_name: search all other user DBs
    dbs = get_all_user_dbs(user)
    for uname, session in dbs:
        if session is db:
            continue
        try:
            c = session.query(Candidate).filter(Candidate.id == candidate_id).first()
            if c:
                return c, session
        finally:
            if not c:
                try:
                    session.close()
                except Exception:
                    pass
    return None, db


@router.put("/candidates/{candidate_id}", response_model=CandidateResponse, tags=["候选人"])
def update_candidate(
    candidate_id: int,
    data: CandidateUpdate,
    intern_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
    role: str = Depends(get_current_role),
):
    c, session = _find_candidate_in_dbs(candidate_id, db, user, role, intern_name)
    if not c:
        raise HTTPException(status_code=404)
    for k, v in data.model_dump(exclude_unset=True).items():
        if k == "communicate_time" and v and "/" in str(v):
            v = str(v).replace("/", "-")
        setattr(c, k, v)
    session.commit()
    session.refresh(c)
    return c


@router.delete("/candidates/{candidate_id}", tags=["候选人"])
def delete_candidate(
    candidate_id: int,
    intern_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
    role: str = Depends(get_current_role),
):
    c, session = _find_candidate_in_dbs(candidate_id, db, user, role, intern_name)
    if not c:
        raise HTTPException(status_code=404)
    session.delete(c)
    session.commit()
    return {"ok": True}


@router.post("/candidates/import", tags=["候选人"])
async def import_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    username: str = Depends(get_current_username),
):
    from io import BytesIO
    contents = await file.read()
    wb = openpyxl.load_workbook(BytesIO(contents), read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(min_row=2, values_only=True))
    wb.close()

    imported = 0
    errors = []
    for i, row in enumerate(rows):
        try:
            if not row or not row[0]:
                continue
            vals = [str(c) if c is not None else "" for c in row]
            db.add(Candidate(
                intern_name=username,
                name=vals[0] if len(vals) > 0 else "",
                department=vals[1] if len(vals) > 1 else None,
                position=vals[2] if len(vals) > 2 else None,
                evaluator=vals[3] if len(vals) > 3 else None,
                interviewer=vals[4] if len(vals) > 4 else None,
                communicate_time=vals[5] if len(vals) > 5 else None,
            ))
            imported += 1
        except Exception:
            errors.append(f"第{i + 2}行")
    db.commit()
    return {"imported": imported, "total": len(rows), "errors": errors}
