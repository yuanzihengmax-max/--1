"""FastAPI 入口"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, get_system_engine, get_engine
from app.routers import auth, users, candidates, reports, statistics, resume


def _seed_scoring():
    from app.models import ScoringConfig, User
    from sqlalchemy.orm import Session

    defaults = [
        ("动机意愿", 0.15, 1), ("销售基础能力", 0.25, 2), ("沟通逻辑", 0.20, 3),
        ("抗压韧性", 0.15, 4), ("稳定性", 0.10, 5), ("自我驱动力", 0.15, 6),
    ]
    sys_engine = get_system_engine()
    with Session(sys_engine) as s:
        if s.query(ScoringConfig).count() == 0:
            for name, w, o in defaults:
                s.add(ScoringConfig(dimension_name=name, weight=w, sort_order=o))
            s.commit()

    with Session(sys_engine) as s:
        all_users = s.query(User.username).all()
    for (username,) in all_users:
        try:
            engine = get_engine(username)
            with Session(engine) as s2:
                if s2.query(ScoringConfig).count() == 0:
                    for name, w, o in defaults:
                        s2.add(ScoringConfig(dimension_name=name, weight=w, sort_order=o))
                    s2.commit()
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_system_engine()
    auth.init_all_users()
    _seed_scoring()
    yield


app = FastAPI(title="招聘简历数据自动化台账", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://8.149.143.126",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(candidates.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(statistics.router, prefix="/api/statistics")
app.include_router(resume.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
