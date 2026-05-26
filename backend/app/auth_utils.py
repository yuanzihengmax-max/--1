"""认证工具函数（独立模块，避免循环引用）"""
import hashlib
import hmac
import os
import json
import time
from base64 import urlsafe_b64encode, urlsafe_b64decode
from app.config import SECRET_KEY


# ── Password helpers ──

def hash_password(password: str) -> str:
    salt = os.urandom(32)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
    return salt.hex() + ":" + key.hex()


def check_password(password: str, hashed: str) -> bool:
    try:
        salt_hex, key_hex = hashed.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
        return key.hex() == key_hex
    except Exception:
        return False


# ── Token helpers ──

def _b64(data: bytes) -> str:
    return urlsafe_b64encode(data).rstrip(b"=").decode()


def _deb64(s: str) -> bytes:
    s += "=" * (4 - len(s) % 4)
    return urlsafe_b64decode(s)


def create_token(username: str, role: str) -> str:
    header = _b64(json.dumps({"alg": "HS256"}).encode())
    payload = _b64(json.dumps({
        "sub": username,
        "role": role,
        "exp": int(time.time()) + 7 * 86400,
    }).encode())
    sig = _b64(hmac.new(SECRET_KEY.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
    return f"{header}.{payload}.{sig}"


def verify_token(token: str) -> dict:
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("invalid token")
    sig_expected = _b64(hmac.new(SECRET_KEY.encode(), f"{parts[0]}.{parts[1]}".encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(parts[2], sig_expected):
        raise ValueError("invalid signature")
    payload = json.loads(_deb64(parts[1]))
    if payload.get("exp", 0) < time.time():
        raise ValueError("token expired")
    return payload
