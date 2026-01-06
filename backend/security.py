from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from . import schemas

#  Cấu hình mã hóa Password 
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def _truncate_password(password: str) -> str:
    """Cắt mật khẩu về tối đa 72 bytes (theo quy định bcrypt)"""
    password_bytes = password.encode("utf-8")

    if len(password_bytes) > 72:
        # Cắt theo byte nhưng giữ nguyên tính hợp lệ UTF-8
        truncated = password_bytes[:72]
        password = truncated.decode("utf-8", errors="ignore")

    return password

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Kiểm tra mật khẩu khi đăng nhập"""
    password_trimmed = _truncate_password(plain_password)
    try:
        return pwd_context.verify(password_trimmed, hashed_password)
    except Exception as e:
        print(f"ERROR verify_password: {e}")
        return False

def get_password_hash(password: str) -> str:
    """Hash mật khẩu khi đăng ký"""
    password_trimmed = _truncate_password(password)
    return pwd_context.hash(password_trimmed)

# --- JWT (JSON Web Token) ---
SECRET_KEY = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str, credentials_exception):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = schemas.TokenData(email=email)
    except JWTError:
        raise credentials_exception
    return token_data
