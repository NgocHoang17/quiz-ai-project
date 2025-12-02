from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func 
from .database import Base 

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    
    # Quan hệ
    quizzes = relationship("Quiz", back_populates="owner")
    folders = relationship("Folder", back_populates="owner") # ✅ MỚI

class Folder(Base): # ✅ CLASS MỚI
    __tablename__ = "folders"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    # Quan hệ
    owner = relationship("User", back_populates="folders")
    quizzes = relationship("Quiz", back_populates="folder")

class Quiz(Base):
    __tablename__ = "quizzes"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, default="Bộ quiz mới")
    created_at = Column(TIMESTAMP, server_default=func.now())
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # ✅ THÊM CỘT FOLDER_ID (Cho phép NULL = nằm ở thư mục gốc)
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)

    # Quan hệ
    owner = relationship("User", back_populates="quizzes")
    folder = relationship("Folder", back_populates="quizzes") # ✅ MỚI
    questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan")

class Question(Base):
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True, index=True)
    question_text = Column(Text, nullable=False)
    choice_a = Column(String(255), nullable=False)
    choice_b = Column(String(255), nullable=False)
    choice_c = Column(String(255), nullable=False)
    choice_d = Column(String(255), nullable=False)
    correct_answer = Column(String(1), nullable=False) 
    
    explanation = Column(Text, nullable=True)
    citation = Column(Text, nullable=True)
    
    quiz_id = Column(Integer, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False) # Đã có cascade

    quiz = relationship("Quiz", back_populates="questions")

class UserQuestionStats(Base):
    __tablename__ = "user_question_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # Lưu ý: ondelete="CASCADE" ở đây để tránh lỗi khi xóa câu hỏi
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    
    correct_attempts = Column(Integer, default=0)    
    incorrect_attempts = Column(Integer, default=0)  
    last_attempted_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    user = relationship("User")
    question = relationship("Question")