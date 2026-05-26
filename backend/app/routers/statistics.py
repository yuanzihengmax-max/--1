"""统计：日报 / 周报 / 渠道电话量"""
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models import Candidate
from app.schemas import StatisticsResult, DailyStatsResponse, WeeklyStatsResponse, ChannelCallsResponse

router = APIRouter()
METRIC_KEYS = ["pushed_to_dept", "dept_eval_passed", "first_interview_show", "interview_invited", "second_interview", "second_interview_show", "offer_sent"]
CHANNEL_MAP = {
    "boss_call": ["BOSS", "Boss", "boss"],
    "zhilian_call": ["智联"],
    "wuyou_call": ["前程无忧"],
    "moka_call": ["内推", "Moka", "moka", "MOKA"],
    "other_call": ["猎聘", "新媒体（小红书、抖音等）", "校招线下双选会", "实习僧", "其他"],
}


def _count(cands):
    r = StatisticsResult()
    for c in cands:
        for k in METRIC_KEYS:
            if getattr(c, k, False):
                setattr(r, k, getattr(r, k) + 1)
    return r


@router.get("/daily", response_model=DailyStatsResponse, tags=["统计"])
def daily_stats(
    date: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    position: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    d = date or datetime.now().strftime("%Y-%m-%d")
    y = (datetime.strptime(d, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")

    today = db.query(Candidate).filter(Candidate.communicate_time >= d, Candidate.communicate_time < d + "T99").all()
    yesterday = db.query(Candidate).filter(Candidate.communicate_time >= y, Candidate.communicate_time < y + "T99").all()

    if department:
        today = [c for c in today if c.department == department]
        yesterday = [c for c in yesterday if c.department == department]
    if position:
        today = [c for c in today if c.position == position]
        yesterday = [c for c in yesterday if c.position == position]

    ts = _count(today)
    ys = _count(yesterday)
    changes = StatisticsResult(**{k: getattr(ts, k) - getattr(ys, k) for k in METRIC_KEYS})
    rates = {}
    for k in METRIC_KEYS:
        yv, tv = getattr(ys, k), getattr(ts, k)
        if yv == 0:
            rates[k] = "+100%" if tv > 0 else "0%"
        else:
            r = (tv - yv) / yv * 100
            rates[k] = f"{'+' if r >= 0 else ''}{r:.1f}%"

    by_dept: dict = defaultdict(lambda: StatisticsResult())
    by_pos: dict = defaultdict(lambda: StatisticsResult())
    for c in today:
        dept = c.department or "未知"
        pos = c.position or "未知"
        for k in METRIC_KEYS:
            if getattr(c, k, False):
                setattr(by_dept[dept], k, getattr(by_dept[dept], k) + 1)
                setattr(by_pos[pos], k, getattr(by_pos[pos], k) + 1)

    return DailyStatsResponse(date=d, today=ts, yesterday=ys, changes=changes, changeRates=rates,
                               byDepartment={k: v.model_dump() for k, v in by_dept.items()},
                               byPosition={k: v.model_dump() for k, v in by_pos.items()})


@router.get("/weekly", response_model=WeeklyStatsResponse, tags=["统计"])
def weekly_stats(date: Optional[str] = Query(None), db: Session = Depends(get_db)):
    d = date or datetime.now().strftime("%Y-%m-%d")
    monday = datetime.strptime(d, "%Y-%m-%d") - timedelta(days=datetime.strptime(d, "%Y-%m-%d").weekday())
    wd = [(monday + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]

    all_c = db.query(Candidate).filter(
        Candidate.communicate_time >= wd[0], Candidate.communicate_time <= wd[-1] + "T99"
    ).all()

    daily_data = {}
    for w in wd:
        day = [c for c in all_c if c.communicate_time and c.communicate_time.startswith(w)]
        daily_data[w] = _count(day)

    total = _count(all_c)
    days_with = sum(1 for w in wd if any(getattr(daily_data[w], k) > 0 for k in METRIC_KEYS))
    avg = StatisticsResult(**{k: round(getattr(total, k) / max(days_with, 1), 2) for k in METRIC_KEYS})

    by_int: dict = defaultdict(lambda: StatisticsResult())
    by_d: dict = defaultdict(lambda: StatisticsResult())
    by_p: dict = defaultdict(lambda: StatisticsResult())
    by_idp: dict = defaultdict(lambda: StatisticsResult())
    for c in all_c:
        iname = c.intern_name or "未知"
        dept = c.department or "未知"
        pos = c.position or "未知"
        for k in METRIC_KEYS:
            if getattr(c, k, False):
                setattr(by_int[iname], k, getattr(by_int[iname], k) + 1)
                setattr(by_d[dept], k, getattr(by_d[dept], k) + 1)
                setattr(by_p[pos], k, getattr(by_p[pos], k) + 1)
                setattr(by_idp[f"{iname} / {dept} / {pos}"], k, getattr(by_idp[f"{iname} / {dept} / {pos}"], k) + 1)

    return WeeklyStatsResponse(weekStart=wd[0], weekEnd=wd[-1],
                                dailyData={k: v.model_dump() for k, v in daily_data.items()},
                                weeklyTotal=total, dailyAvg=avg,
                                byIntern={k: v.model_dump() for k, v in by_int.items()},
                                byDepartment={k: v.model_dump() for k, v in by_d.items()},
                                byPosition={k: v.model_dump() for k, v in by_p.items()},
                                byInternDeptPosition={k: v.model_dump() for k, v in by_idp.items()})


@router.get("/channel-calls", response_model=ChannelCallsResponse, tags=["统计"])
def channel_calls(
    date: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    ds = start_date or date or datetime.now().strftime("%Y-%m-%d")
    de = end_date or date or ds
    cands = db.query(Candidate).filter(
        Candidate.communicate_time >= ds, Candidate.communicate_time <= de + "T99", Candidate.result.in_(["推荐", "淘汰"])
    ).all()

    counts = {k: 0 for k in CHANNEL_MAP}
    for c in cands:
        ch = c.channel or "其他"
        matched = False
        for col, channels in CHANNEL_MAP.items():
            if ch in channels:
                counts[col] += 1
                matched = True
                break
        if not matched:
            counts["other_call"] += 1
    return ChannelCallsResponse(**counts)


@router.get("/weekly-channel-stats", tags=["统计"])
def weekly_channel_stats(
    start_date: str = Query(...),
    end_date: str = Query(...),
    db: Session = Depends(get_db),
):
    """Returns per-channel contact & referral counts for a week range.
    contact = candidates with result IN (推荐, 淘汰)
    refer = candidates with result = 推荐
    """
    cands = db.query(Candidate).filter(
        Candidate.communicate_time >= start_date,
        Candidate.communicate_time <= end_date + "T99",
        Candidate.result.in_(["推荐", "淘汰"]),
    ).all()

    contact = {"boss": 0, "zhilian": 0, "wuyou": 0, "moka": 0}
    refer = {"boss": 0, "zhilian": 0, "wuyou": 0, "moka": 0}

    for c in cands:
        ch = c.channel or ""
        col = None
        if ch in ("BOSS", "Boss", "boss"):
            col = "boss"
        elif ch == "智联":
            col = "zhilian"
        elif ch == "前程无忧":
            col = "wuyou"
        elif ch in ("内推", "Moka", "moka", "MOKA"):
            col = "moka"
        if col:
            contact[col] += 1
            if c.result == "推荐":
                refer[col] += 1

    return {"contact": contact, "refer": refer}


@router.get("/pipeline-stats", tags=["统计"])
def pipeline_stats(
    start_date: str = Query(...),
    end_date: str = Query(...),
    db: Session = Depends(get_db),
):
    """Returns counts for all 7 pipeline stages in a week range."""
    cands = db.query(Candidate).filter(
        Candidate.communicate_time >= start_date,
        Candidate.communicate_time <= end_date + "T99",
    ).all()
    return {
        "pushed_to_dept": sum(1 for c in cands if c.pushed_to_dept),
        "dept_eval_passed": sum(1 for c in cands if c.dept_eval_passed),
        "first_interview_show": sum(1 for c in cands if c.first_interview_show),
        "interview_invited": sum(1 for c in cands if c.interview_invited),
        "second_interview": sum(1 for c in cands if c.second_interview),
        "second_interview_show": sum(1 for c in cands if c.second_interview_show),
        "offer_sent": sum(1 for c in cands if c.offer_sent),
    }
