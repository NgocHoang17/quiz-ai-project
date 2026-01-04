from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Định dạng: mysql+pymysql://<TÊN_USER>:<MẬT_KHẨU>@<HOST_IP>/<TÊN_DATABASE>
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:123@127.0.0.1/quizai_db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()