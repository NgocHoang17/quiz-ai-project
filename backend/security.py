from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from . import schemas # Import schemas để dùng TokenData

# --- Cấu hình mã hóa Password ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

# --- Cấu hình JWT (JSON Web Token) ---
# BẠN NÊN THAY CHUỖI NÀY BẰNG MỘT CHUỖI BÍ MẬT KHÁC
# (Có thể tạo bằng lệnh: openssl rand -hex 32)
SECRET_KEY = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
ALGORITHM = "HS256"
# Token hết hạn sau 60 phút
ACCESS_TOKEN_EXPIRE_MINUTES = 60 

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        # Mặc định hết hạn sau 15 phút nếu không truyền
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
        
    # Cập nhật thời gian hết hạn
    to_encode.update({"exp": expire})
    
    # Tạo token
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Hàm này sẽ được dùng để xác thực token ở các API cần bảo vệ
def verify_token(token: str, credentials_exception):
    try:
        # Giải mã token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Lấy email (subject) từ token
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = schemas.TokenData(email=email)
    except JWTError:
        raise credentials_exception
    return token_data # Trả về dữ liệu người dùng (email)