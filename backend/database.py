from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# --- CHUỖI KẾT NỐI MYSQL ---
#
# Đảm bảo bạn đã CẬP NHẬT mật khẩu 'root' (ví dụ: '123' trong code)
# và tên database (ví dụ: 'quizai_db') khớp với MySQL của bạn.
#
# Định dạng: mysql+pymysql://<TÊN_USER>:<MẬT_KHẨU>@<HOST_IP>/<TÊN_DATABASE>
#
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:123@127.0.0.1/quizai_db"

# -----------------------------

# Phần code còn lại
engine = create_engine(
    SQLALCHEMY_DATABASE_URL
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()