"""应用配置管理"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
CONFIG_DIR = BASE_DIR / "config"

DATA_DIR.mkdir(exist_ok=True)
CONFIG_DIR.mkdir(exist_ok=True)


class Settings(BaseSettings):
    """应用配置"""

    APP_NAME: str = "招聘助手"
    DEBUG: bool = False

    # 数据库
    DATABASE_URL_TEMPLATE: str = "sqlite:///{data_dir}/recruitment_{{user_id}}.db"

    # AI 配置
    AI_BASE_URL: str = ""
    AI_API_KEY: str = ""
    AI_MODEL: str = ""
    SILICONFLOW_API_KEY: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "allow"


settings = Settings()

# JWT 密钥
SECRET_KEY = os.getenv("SECRET_KEY", "recruitment-assistant-secret-key-change-in-prod")

# 管理员初始化：张文华:008680,袁子恒:114514
ADMIN_USERS = os.getenv("ADMIN_USERS", "张文华:008680,袁子恒:114514")
