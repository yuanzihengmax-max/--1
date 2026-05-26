"""数据库连接与会话管理"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from sqlalchemy.pool import NullPool

from app.config import DATA_DIR

Base = declarative_base()

# 每个用户独立一个引擎，按 user_id 缓存
_engines = {}
_session_makers = {}


def get_db_path(user_id: str) -> str:
    return str(DATA_DIR / f"recruitment_{user_id}.db")


def _create_engine(user_id: str):
    db_path = get_db_path(user_id)
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        poolclass=NullPool,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    return engine


def get_engine(user_id: str):
    """获取或创建用户专属的数据库引擎"""
    if user_id not in _engines:
        engine = _create_engine(user_id)
        _engines[user_id] = engine
        _session_makers[user_id] = sessionmaker(
            bind=engine, autocommit=False, autoflush=False
        )
        # 首次使用自动建表
        Base.metadata.create_all(bind=engine)
    return _engines[user_id]


def get_session(user_id: str) -> Session:
    """创建用户专属的数据库会话"""
    get_engine(user_id)
    return _session_makers[user_id]()


# ── 系统级共享数据库（用于 users 表）──

_system_engine = None
_SystemSession = None


def get_system_engine():
    global _system_engine, _SystemSession
    if _system_engine is None:
        db_path = str(DATA_DIR / "recruitment_system.db")
        _system_engine = create_engine(
            f"sqlite:///{db_path}",
            connect_args={"check_same_thread": False},
            poolclass=NullPool,
        )
        _SystemSession = sessionmaker(
            bind=_system_engine, autocommit=False, autoflush=False
        )
        Base.metadata.create_all(bind=_system_engine)
    return _system_engine


def get_system_session() -> Session:
    get_system_engine()
    return _SystemSession()
